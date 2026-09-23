import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ADMIN_COOKIE } from '@/lib/admin-auth'

/**
 * The old shared-password `login` is now BREAK-GLASS only: off unless `ADMIN_BREAK_GLASS=on`
 * AND `ADMIN_PASSWORD` is set. Off, it sets no cookie even for the right password and sends the
 * caller to `/admin/sign-in`. `logout` clears both kinds of session.
 */

const cookieSet = vi.fn()
vi.mock('next/headers', () => ({
  cookies: async () => ({ set: (...a: unknown[]) => cookieSet(...a), get: vi.fn() }),
  headers: async () => new Headers(),
}))

const signOut = vi.fn()
vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: async () => ({ auth: { signOut: (...a: unknown[]) => signOut(...a) } }),
  currentUser: vi.fn(),
}))

vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: vi.fn() }))
vi.mock('@/lib/mailer', () => ({ mailCustomer: vi.fn(), mailFounders: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

class RedirectError extends Error {
  constructor(public to: string) {
    super(`REDIRECT:${to}`)
  }
}
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new RedirectError(to)
  },
}))

const { login, logout } = await import('@/app/admin/actions')

const PASSWORD = 'correct horse battery staple'

function pw(value: string) {
  const fd = new FormData()
  fd.set('password', value)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.GATE_SECRET = 'a'.repeat(64)
  process.env.ADMIN_PASSWORD = PASSWORD
  signOut.mockResolvedValue({ error: null })
})

afterEach(() => {
  delete process.env.ADMIN_PASSWORD
  delete process.env.ADMIN_BREAK_GLASS
  vi.restoreAllMocks()
})

describe('login while break-glass is OFF (the default)', () => {
  it('refuses even the correct password, sets no cookie, and points at /admin/sign-in', async () => {
    await expect(login(pw(PASSWORD))).rejects.toThrow('REDIRECT:/admin/sign-in')
    expect(cookieSet).not.toHaveBeenCalled()
  })
})

describe('login while break-glass is ON', () => {
  beforeEach(() => {
    process.env.ADMIN_BREAK_GLASS = 'on'
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('sets the admin cookie for the correct password', async () => {
    await expect(login(pw(PASSWORD))).rejects.toThrow('REDIRECT:/admin')
    expect(cookieSet).toHaveBeenCalledWith(ADMIN_COOKIE, expect.any(String), expect.objectContaining({ path: '/admin', httpOnly: true }))
  })

  it('refuses a wrong password', async () => {
    await expect(login(pw('nope'))).rejects.toThrow('REDIRECT:/admin?error=1')
    expect(cookieSet).not.toHaveBeenCalled()
  })

  it('logs a warning on a successful break-glass sign-in', async () => {
    await expect(login(pw(PASSWORD))).rejects.toThrow('REDIRECT:/admin')
    expect(console.warn).toHaveBeenCalled()
  })
})

describe('logout', () => {
  it('clears the break-glass cookie, signs the Supabase session out, and goes to sign-in', async () => {
    await expect(logout()).rejects.toThrow('REDIRECT:/admin/sign-in')
    expect(cookieSet).toHaveBeenCalledWith(ADMIN_COOKIE, '', expect.objectContaining({ maxAge: 0 }))
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('fails loud when Supabase will not sign out, rather than pretending it did', async () => {
    signOut.mockResolvedValue({ error: new Error('down') })
    await expect(logout()).rejects.toThrow('Admin sign-out failed')
  })
})
