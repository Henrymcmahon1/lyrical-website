import { describe, expect, it, vi, beforeEach } from 'vitest'

/**
 * The 6-digit code sign in, replacing the magic link (`tests/sign-in-link.test.ts`, now deleted).
 * `requestSignInCode` asks Supabase to mint and send the code (no `emailRedirectTo`, which is
 * what makes Supabase send a code rather than a link); `verifySignInCode` redeems it and claims
 * the welcome exactly the way the callback route does for the other two sign-in paths.
 */

const signInWithOtp = vi.fn()
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({ auth: { signInWithOtp: (...a: unknown[]) => signInWithOtp(...a) } }),
}))

const verifyOtp = vi.fn()
vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: async () => ({ auth: { verifyOtp: (...a: unknown[]) => verifyOtp(...a) } }),
}))

const claimWelcomeOnce = vi.fn()
vi.mock('@/lib/claim-welcome', () => ({ claimWelcomeOnce: (...a: unknown[]) => claimWelcomeOnce(...a) }))

/** A fresh client IP per call by default, same trick as the old link tests: the limiter is
 * module-level and in-memory, and a shared IP across unrelated tests would make an unrelated
 * test start failing once the throttle itself has been exercised once. */
let ipCounter = 0
let pinnedIp: string | null = null
const pinIp = (ip: string) => {
  pinnedIp = ip
}
vi.mock('next/headers', () => ({
  headers: async () =>
    new Headers({ 'x-forwarded-for': pinnedIp ?? `198.51.100.${++ipCounter % 250}` }),
}))

const { requestSignInCode, verifySignInCode } = await import('@/app/(public)/studio/sign-in/actions')

beforeEach(() => {
  vi.clearAllMocks()
  pinnedIp = null
  signInWithOtp.mockResolvedValue({ data: {}, error: null })
  verifyOtp.mockResolvedValue({ data: { user: { id: 'user-1', email: 'artist@label.example' } }, error: null })
  claimWelcomeOnce.mockResolvedValue(true)
})

describe('requestSignInCode', () => {
  it('asks Supabase for a code with no emailRedirectTo, which is what makes it a code not a link', async () => {
    await requestSignInCode('artist@label.example')
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'artist@label.example',
      options: { shouldCreateUser: true },
    })
    const call = signInWithOtp.mock.calls[0][0]
    expect(call.options).not.toHaveProperty('emailRedirectTo')
  })

  it('normalises the address', async () => {
    await requestSignInCode('  Artist@Label.Example  ')
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'artist@label.example',
      options: { shouldCreateUser: true },
    })
  })

  it('rejects something that is not an email address without touching Supabase', async () => {
    for (const bad of ['', '   ', 'nope', 'a@b']) {
      const result = await requestSignInCode(bad)
      expect(result.ok).toBe(false)
    }
    expect(signInWithOtp).not.toHaveBeenCalled()
  })

  it('reports a failure to send rather than claiming success', async () => {
    signInWithOtp.mockResolvedValue({ data: null, error: { message: 'rate limited' } })
    const result = await requestSignInCode('artist@label.example')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/could not send/i)
  })

  it('throttles a loop requesting codes for the same IP', async () => {
    pinIp('198.51.100.253')
    for (let i = 0; i < 3; i++) {
      expect((await requestSignInCode('artist@label.example')).ok).toBe(true)
    }
    const blocked = await requestSignInCode('artist@label.example')
    expect(blocked.ok).toBe(false)
    expect(blocked.error).toMatch(/too many/i)
    expect(signInWithOtp).toHaveBeenCalledTimes(3)
  })
})

describe('verifySignInCode', () => {
  it('redeems a 6-digit code with Supabase, type email', async () => {
    await verifySignInCode('artist@label.example', '123456')
    expect(verifyOtp).toHaveBeenCalledWith({
      email: 'artist@label.example',
      token: '123456',
      type: 'email',
    })
  })

  it('rejects anything that is not exactly 6 digits, without touching Supabase', async () => {
    for (const bad of ['', '12345', '1234567', 'abcdef']) {
      const result = await verifySignInCode('artist@label.example', bad)
      expect(result.ok, `should reject "${bad}"`).toBe(false)
    }
    expect(verifyOtp).not.toHaveBeenCalled()
  })

  it('trims surrounding whitespace on an otherwise valid code', async () => {
    const result = await verifySignInCode('artist@label.example', ' 123456 ')
    expect(result.ok).toBe(true)
    expect(verifyOtp).toHaveBeenCalledWith({
      email: 'artist@label.example',
      token: '123456',
      type: 'email',
    })
  })

  it('reports a wrong or expired code plainly, rather than the raw Supabase message', async () => {
    verifyOtp.mockResolvedValue({ data: { user: null }, error: { message: 'Token has expired or is invalid' } })
    const result = await verifySignInCode('artist@label.example', '000000')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/wrong or has expired/i)
  })

  it('claims the welcome on success, the same shared rule the callback route uses', async () => {
    const result = await verifySignInCode('artist@label.example', '123456')
    expect(result.ok).toBe(true)
    expect(claimWelcomeOnce).toHaveBeenCalledWith(expect.anything(), 'user-1', 'artist@label.example')
  })

  it('does not claim a welcome on a failed verify', async () => {
    verifyOtp.mockResolvedValue({ data: { user: null }, error: { message: 'nope' } })
    await verifySignInCode('artist@label.example', '000000')
    expect(claimWelcomeOnce).not.toHaveBeenCalled()
  })

  it('throttles a loop guessing codes for the same IP', async () => {
    pinIp('198.51.100.200')
    for (let i = 0; i < 8; i++) {
      await verifySignInCode('artist@label.example', '123456')
    }
    const blocked = await verifySignInCode('artist@label.example', '123456')
    expect(blocked.ok).toBe(false)
    expect(blocked.error).toMatch(/too many/i)
  })
})
