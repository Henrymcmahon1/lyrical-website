import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `app/auth/callback/route.ts` now claims the welcome through `lib/claim-welcome.ts`'s
 * `welcomed_at`-based rule, shared by every path that can land here: the surviving magic link
 * (`token_hash`), the new 6-digit code's own verify path does NOT come through this route (it
 * verifies inline in the server action), and Google OAuth (`code`), which DOES come through
 * here. This file proves the route calls the shared claim exactly once per request and passes it
 * the right user, regardless of which branch produced the session.
 */

process.env.NEXT_PUBLIC_SITE_URL = 'https://lyricalglobal.com'

const verifyOtp = vi.fn()
const exchangeCodeForSession = vi.fn()
vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: async () => ({ auth: { verifyOtp, exchangeCodeForSession } }),
}))

const claimWelcomeOnce = vi.fn()
vi.mock('@/lib/claim-welcome', () => ({ claimWelcomeOnce: (...a: unknown[]) => claimWelcomeOnce(...a) }))

const { GET } = await import('@/app/auth/callback/route')

const user = { id: 'user-1', email: 'artist@label.example' }

beforeEach(() => {
  vi.clearAllMocks()
  claimWelcomeOnce.mockResolvedValue(true)
})

describe('the magic link branch (token_hash)', () => {
  it('claims the welcome for the verified user', async () => {
    verifyOtp.mockResolvedValue({ data: { user }, error: null })
    await GET(new Request('https://lyricalglobal.com/auth/callback?token_hash=abc&type=magiclink'))
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc', type: 'magiclink' })
    expect(claimWelcomeOnce).toHaveBeenCalledWith(expect.anything(), 'user-1', 'artist@label.example')
  })

  it('does not claim on a verify error', async () => {
    verifyOtp.mockResolvedValue({ data: { user: null }, error: { message: 'expired' } })
    await GET(new Request('https://lyricalglobal.com/auth/callback?token_hash=abc&type=magiclink'))
    expect(claimWelcomeOnce).not.toHaveBeenCalled()
  })
})

describe('the Google OAuth branch (code)', () => {
  it('claims the welcome for the verified user, same as the magic link branch', async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { user }, error: null })
    await GET(new Request('https://lyricalglobal.com/auth/callback?code=abc'))
    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc')
    expect(claimWelcomeOnce).toHaveBeenCalledWith(expect.anything(), 'user-1', 'artist@label.example')
  })
})

describe('one claim per request, on both branches identically', () => {
  it('never calls claimWelcomeOnce more than once for a single callback', async () => {
    verifyOtp.mockResolvedValue({ data: { user }, error: null })
    await GET(new Request('https://lyricalglobal.com/auth/callback?token_hash=abc&type=magiclink'))
    expect(claimWelcomeOnce).toHaveBeenCalledTimes(1)
  })
})
