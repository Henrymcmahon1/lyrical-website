import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ADMIN_COOKIE, signAdminSession } from '@/lib/admin-auth'
import { createHmac } from 'node:crypto'

/**
 * `requireAdmin()`: the one gate every admin surface goes through.
 *
 * Identity path: server-verified user (`currentUser()`, i.e. `getUser()`), allowlisted, and at
 * the required assurance level. Break-glass path: the old HMAC cookie, honoured ONLY when
 * `ADMIN_BREAK_GLASS=on` and `ADMIN_PASSWORD` is set.
 */

const currentUser = vi.fn()
const getAal = vi.fn()
vi.mock('@/lib/supabase-server', () => ({
  currentUser: () => currentUser(),
  supabaseServer: async () => ({
    auth: { mfa: { getAuthenticatorAssuranceLevel: () => getAal() } },
  }),
}))

let cookieValue: string | undefined
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (name === ADMIN_COOKIE && cookieValue ? { value: cookieValue } : undefined),
  }),
}))

const { requireAdmin } = await import('@/lib/admin-session')

const CONFIRMED = '2026-09-24T00:00:00Z'
const INFO = { id: 'uid-info', email: 'info@lyricalglobal.com', email_confirmed_at: CONFIRMED }

beforeEach(() => {
  vi.clearAllMocks()
  cookieValue = undefined
  process.env.GATE_SECRET = 'a'.repeat(64)
  process.env.ADMIN_EMAILS = 'info@lyricalglobal.com'
  currentUser.mockResolvedValue(null)
})

afterEach(() => {
  delete process.env.ADMIN_EMAILS
  delete process.env.ADMIN_REQUIRE_MFA
  delete process.env.ADMIN_BREAK_GLASS
  delete process.env.ADMIN_PASSWORD
  vi.restoreAllMocks()
})

describe('identity path', () => {
  it('admits an allowlisted, confirmed user', async () => {
    currentUser.mockResolvedValue(INFO)
    expect(await requireAdmin()).toEqual({
      ok: true,
      via: 'identity',
      user: { id: 'uid-info', email: 'info@lyricalglobal.com' },
    })
  })

  it('refuses nobody signed in with reason no-session', async () => {
    expect(await requireAdmin()).toEqual({ ok: false, reason: 'no-session' })
  })

  it('refuses a signed-in customer who is not on the list', async () => {
    currentUser.mockResolvedValue({ id: 'u2', email: 'fan@example.com', email_confirmed_at: CONFIRMED })
    expect(await requireAdmin()).toEqual({ ok: false, reason: 'not-allowlisted' })
  })

  it('refuses info@ when ADMIN_EMAILS is unset (fails closed)', async () => {
    delete process.env.ADMIN_EMAILS
    currentUser.mockResolvedValue(INFO)
    expect(await requireAdmin()).toEqual({ ok: false, reason: 'not-allowlisted' })
  })

  it('refuses an allowlisted address whose email is not confirmed', async () => {
    currentUser.mockResolvedValue({ ...INFO, email_confirmed_at: null })
    expect(await requireAdmin()).toEqual({ ok: false, reason: 'not-allowlisted' })
  })

  it('does not consult MFA at all while ADMIN_REQUIRE_MFA is off', async () => {
    currentUser.mockResolvedValue(INFO)
    await requireAdmin()
    expect(getAal).not.toHaveBeenCalled()
  })
})

describe('the AAL gate (ADMIN_REQUIRE_MFA=on)', () => {
  beforeEach(() => {
    process.env.ADMIN_REQUIRE_MFA = 'on'
    currentUser.mockResolvedValue(INFO)
  })

  it('admits an aal2 session', async () => {
    getAal.mockResolvedValue({ data: { currentLevel: 'aal2', nextLevel: 'aal2' }, error: null })
    expect((await requireAdmin()).ok).toBe(true)
  })

  it('refuses an aal1 session with reason mfa-required', async () => {
    getAal.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null })
    expect(await requireAdmin()).toEqual({ ok: false, reason: 'mfa-required' })
  })

  it('refuses when the assurance level cannot be read (fails closed)', async () => {
    getAal.mockResolvedValue({ data: null, error: new Error('boom') })
    expect(await requireAdmin()).toEqual({ ok: false, reason: 'mfa-required' })
  })

  it('never asks a non-allowlisted user for MFA', async () => {
    currentUser.mockResolvedValue({ id: 'u2', email: 'fan@example.com', email_confirmed_at: CONFIRMED })
    expect(await requireAdmin()).toEqual({ ok: false, reason: 'not-allowlisted' })
    expect(getAal).not.toHaveBeenCalled()
  })
})

describe('break-glass path', () => {
  it('ignores a VALID old cookie while break-glass is off (the default)', async () => {
    process.env.ADMIN_PASSWORD = 'correct horse battery staple'
    cookieValue = signAdminSession(Date.now())
    expect(await requireAdmin()).toEqual({ ok: false, reason: 'no-session' })
  })

  it('ignores a valid cookie when the flag is on but ADMIN_PASSWORD is unset', async () => {
    process.env.ADMIN_BREAK_GLASS = 'on'
    cookieValue = signAdminSession(Date.now())
    expect(await requireAdmin()).toEqual({ ok: false, reason: 'no-session' })
  })

  it('admits a valid cookie when enabled, and warns every time', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    process.env.ADMIN_BREAK_GLASS = 'on'
    process.env.ADMIN_PASSWORD = 'correct horse battery staple'
    cookieValue = signAdminSession(Date.now())
    expect(await requireAdmin()).toEqual({ ok: true, via: 'break-glass', user: null })
    await requireAdmin()
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('still rejects a gate token as an admin session (namespaced HMAC)', async () => {
    process.env.ADMIN_BREAK_GLASS = 'on'
    process.env.ADMIN_PASSWORD = 'correct horse battery staple'
    const payload = String(Date.now())
    const mac = createHmac('sha256', process.env.GATE_SECRET!).update(payload).digest('hex')
    cookieValue = `${Buffer.from(payload).toString('base64url')}.${mac}`
    expect(await requireAdmin()).toEqual({ ok: false, reason: 'no-session' })
  })

  it('prefers the identity when both are present', async () => {
    process.env.ADMIN_BREAK_GLASS = 'on'
    process.env.ADMIN_PASSWORD = 'correct horse battery staple'
    cookieValue = signAdminSession(Date.now())
    currentUser.mockResolvedValue(INFO)
    expect((await requireAdmin()).ok && (await requireAdmin())).toMatchObject({ via: 'identity' })
  })

  it('keeps the not-allowlisted reason for a customer with no valid break-glass cookie', async () => {
    process.env.ADMIN_BREAK_GLASS = 'on'
    process.env.ADMIN_PASSWORD = 'correct horse battery staple'
    currentUser.mockResolvedValue({ id: 'u2', email: 'fan@example.com', email_confirmed_at: CONFIRMED })
    expect(await requireAdmin()).toEqual({ ok: false, reason: 'not-allowlisted' })
  })
})
