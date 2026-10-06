import { afterEach, describe, expect, it, vi } from 'vitest'
import { turnstileMessage, turnstileTokenFrom, verifyTurnstile } from '@/lib/turnstile'

/**
 * The verifier decides whether to trust a Turnstile token. Since issue #392 it FAILS CLOSED:
 * a missing token, a bad token, a token minted for another form or another site, an outage at
 * Cloudflare, and a production deploy with no secret key are all refusals. Only local
 * development with no key configured is let through, so a developer can still use the forms.
 */

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
type FetchLike = (input: string, init: RequestInit) => Promise<Response>

const reply = (body: Record<string, unknown>, status = 200) =>
  vi.fn<FetchLike>(async () => new Response(JSON.stringify(body), { status }))
const good = (over: Record<string, unknown> = {}) =>
  reply({ success: true, action: 'sign-in', hostname: 'lyricalglobal.com', ...over })

const base = { secret: 'sk', action: 'sign-in', production: true, hostnames: ['lyricalglobal.com', 'www.lyricalglobal.com'] }

afterEach(() => {
  vi.restoreAllMocks()
})

describe('verifyTurnstile', () => {
  it('accepts a token Cloudflare confirms for this form on this site', async () => {
    const fetchImpl = good()
    expect(await verifyTurnstile('tok', { ...base, fetchImpl })).toEqual({ ok: true, reason: 'passed' })
    expect(fetchImpl.mock.calls[0][0]).toBe(SITEVERIFY)
  })

  it('accepts the www hostname too', async () => {
    expect((await verifyTurnstile('tok', { ...base, fetchImpl: good({ hostname: 'www.lyricalglobal.com' }) })).ok).toBe(true)
  })

  it('REFUSES a missing token without asking Cloudflare', async () => {
    const fetchImpl = vi.fn<FetchLike>()
    expect(await verifyTurnstile('', { ...base, fetchImpl })).toEqual({ ok: false, reason: 'missing-token' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('REFUSES a bad token', async () => {
    const r = await verifyTurnstile('tok', { ...base, fetchImpl: reply({ success: false, 'error-codes': ['invalid-input-response'] }) })
    expect(r).toEqual({ ok: false, reason: 'failed' })
  })

  it('REFUSES a token solved on a different form', async () => {
    const r = await verifyTurnstile('tok', { ...base, fetchImpl: good({ action: 'enquiry' }) })
    expect(r).toEqual({ ok: false, reason: 'wrong-action' })
  })

  it('REFUSES a token solved on another site', async () => {
    const r = await verifyTurnstile('tok', { ...base, fetchImpl: good({ hostname: 'evil.example' }) })
    expect(r).toEqual({ ok: false, reason: 'wrong-hostname' })
  })

  it('REFUSES during a siteverify outage: network error', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => {
      throw new Error('network down')
    })
    expect(await verifyTurnstile('tok', { ...base, fetchImpl })).toEqual({ ok: false, reason: 'error' })
  })

  it('REFUSES during a siteverify outage: non-200', async () => {
    expect(await verifyTurnstile('tok', { ...base, fetchImpl: reply({}, 502) })).toEqual({ ok: false, reason: 'error' })
  })

  it('REFUSES during a siteverify outage: a reply that is not JSON', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => new Response('<html>', { status: 200 }))
    expect(await verifyTurnstile('tok', { ...base, fetchImpl })).toEqual({ ok: false, reason: 'error' })
  })

  it('REFUSES in production when no secret key is configured, and says so loudly', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchImpl = vi.fn<FetchLike>()
    const r = await verifyTurnstile('tok', { ...base, secret: '', fetchImpl })
    expect(r).toEqual({ ok: false, reason: 'unconfigured' })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(JSON.stringify(err.mock.calls)).toContain('TURNSTILE_SECRET_KEY')
  })

  it('lets local development through when no key is configured', async () => {
    const r = await verifyTurnstile('', { ...base, secret: '', production: false })
    expect(r).toEqual({ ok: true, reason: 'dev-unconfigured' })
  })

  it('passes the secret, the token and the caller IP to Cloudflare', async () => {
    const fetchImpl = good()
    await verifyTurnstile('tok', { ...base, remoteip: '203.0.113.7', fetchImpl })
    const body = fetchImpl.mock.calls[0][1]?.body as URLSearchParams
    expect(body.get('secret')).toBe('sk')
    expect(body.get('response')).toBe('tok')
    expect(body.get('remoteip')).toBe('203.0.113.7')
  })

  it('reads the expected hostnames from TURNSTILE_EXPECTED_HOSTNAMES when set', async () => {
    vi.stubEnv('TURNSTILE_EXPECTED_HOSTNAMES', 'preview.example, lyricalglobal.com')
    const { hostnames: _h, ...noList } = base
    expect((await verifyTurnstile('tok', { ...noList, fetchImpl: good({ hostname: 'preview.example' }) })).ok).toBe(true)
    vi.unstubAllEnvs()
  })
})

describe('turnstileMessage', () => {
  it('speaks plainly, and tells an outage apart from a failed check', () => {
    expect(turnstileMessage('failed')).toBe('That did not look human. Refresh the page and try again.')
    expect(turnstileMessage('missing-token')).toBe('That did not look human. Refresh the page and try again.')
    expect(turnstileMessage('error')).toBe('We could not check that just now. Please try again in a minute.')
    expect(turnstileMessage('unconfigured')).toBe('This form is not available right now. Please try again later.')
  })
})

describe('turnstileTokenFrom', () => {
  it('reads the token the widget puts in a native form', () => {
    const fd = new FormData()
    fd.set('cf-turnstile-response', 'tok')
    expect(turnstileTokenFrom(fd)).toBe('tok')
    expect(turnstileTokenFrom(new FormData())).toBe('')
  })
})
