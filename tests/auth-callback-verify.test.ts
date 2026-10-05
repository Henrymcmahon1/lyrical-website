import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The callback has to verify a link with the SAME type Supabase minted it as.
 *
 * Issue #384: a brand new account's first link carries a signup token, and verifying it as
 * `magiclink` looks in the wrong table, finds nothing, and reads to the customer as "expired".
 * These tests drive the route itself and check what it asks Supabase to do.
 */

process.env.NEXT_PUBLIC_SITE_URL = 'https://lyricalglobal.com'

const verifyOtp = vi.fn()
const exchangeCodeForSession = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: async () => ({
    auth: {
      verifyOtp: (...a: unknown[]) => verifyOtp(...a),
      exchangeCodeForSession: (...a: unknown[]) => exchangeCodeForSession(...a),
    },
    from: () => ({
      upsert: () => ({ select: async () => ({ data: [], error: null }) }),
    }),
  }),
}))

vi.mock('@/lib/mailer', () => ({ mailCustomer: vi.fn(), mailFounders: vi.fn() }))

const { GET } = await import('@/app/auth/callback/route')

const call = (query: string) => GET(new Request(`https://lyricalglobal.com/auth/callback?${query}`))
const landing = (res: Response) => res.headers.get('location') ?? ''

beforeEach(() => {
  vi.clearAllMocks()
  verifyOtp.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.example' } }, error: null })
})

describe('verifying a link', () => {
  it('verifies a first-time link as signup, which is how Supabase minted it', async () => {
    const res = await call('token_hash=FIRST&type=signup&next=%2Fstudio')
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'FIRST', type: 'signup' })
    expect(landing(res)).toBe('https://lyricalglobal.com/studio')
  })

  it('verifies a returning link as magiclink', async () => {
    await call('token_hash=BACK&type=magiclink')
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'BACK', type: 'magiclink' })
  })

  it('REFUSES a type it does not mint, without asking Supabase', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    for (const bad of ['type=recovery', 'type=email_change', 'type=', '']) {
      const res = await call(`token_hash=X&${bad}`)
      expect(landing(res), bad).toBe('https://lyricalglobal.com/studio/sign-in?error=link')
    }
    expect(verifyOtp).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it('logs WHY a link failed, so the next "expired" report has evidence', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    verifyOtp.mockResolvedValue({
      data: { user: null },
      error: { code: 'otp_expired', message: 'Email link is invalid or has expired' },
    })

    const res = await call('token_hash=SECRET&type=magiclink')

    expect(landing(res)).toBe('https://lyricalglobal.com/studio/sign-in?error=link')
    const logged = JSON.stringify(error.mock.calls)
    expect(logged).toContain('otp_expired')
    expect(logged).toContain('magiclink')
    // The hash is a live credential until it is used. It never goes in a log.
    expect(logged).not.toContain('SECRET')
    error.mockRestore()
  })
})
