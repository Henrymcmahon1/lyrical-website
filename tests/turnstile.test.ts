import { afterEach, describe, expect, it, vi } from 'vitest'
import { verifyTurnstile } from '@/lib/turnstile'

/**
 * The verifier is the load-bearing half: the widget only produces a token, this decides whether
 * to trust it. Two properties matter most and are easy to get wrong.
 *
 *   1. Unconfigured means OFF, not open-to-forgery. With no secret set the whole feature is
 *      skipped, so the forms behave exactly as they did before any of this existed.
 *   2. A Cloudflare outage must not lock real customers out. An error reaching siteverify fails
 *      OPEN, on Henry's call, while an explicit bot verdict fails closed.
 */

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/** Matches the `FetchLike` the verifier accepts, so `mock.calls` stays typed with no unused args. */
type FetchLike = (input: string, init: RequestInit) => Promise<Response>

afterEach(() => {
  vi.restoreAllMocks()
})

describe('when Turnstile is not configured', () => {
  it('skips verification so the form works unchanged', async () => {
    const fetchImpl = vi.fn()
    const r = await verifyTurnstile('anything', { secret: undefined, fetchImpl })
    expect(r.ok).toBe(true)
    expect(r.skipped).toBe(true)
    // The whole point: it never even calls Cloudflare when there is no secret.
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('when Turnstile is configured', () => {
  it('rejects a missing token rather than treating empty as valid', async () => {
    const fetchImpl = vi.fn()
    const r = await verifyTurnstile('', { secret: 'sk', fetchImpl })
    expect(r.ok).toBe(false)
    // No point asking Cloudflare about a token we do not have.
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('accepts a token Cloudflare confirms', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () =>
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    )
    const r = await verifyTurnstile('good-token', { secret: 'sk', fetchImpl })
    expect(r.ok).toBe(true)
    expect(r.skipped).toBeFalsy()
    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(fetchImpl.mock.calls[0][0]).toBe(SITEVERIFY)
  })

  it('rejects a token Cloudflare calls a bot', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () =>
      new Response(JSON.stringify({ success: false, 'error-codes': ['invalid-input-response'] }), {
        status: 200,
      }),
    )
    const r = await verifyTurnstile('bad-token', { secret: 'sk', fetchImpl })
    expect(r.ok).toBe(false)
    expect(r.skipped).toBeFalsy()
  })

  it('passes the secret, the token and the caller IP to Cloudflare', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () =>
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    )
    await verifyTurnstile('tok', { secret: 'sk', remoteip: '203.0.113.7', fetchImpl })
    const body = fetchImpl.mock.calls[0][1]?.body as URLSearchParams
    expect(body.get('secret')).toBe('sk')
    expect(body.get('response')).toBe('tok')
    expect(body.get('remoteip')).toBe('203.0.113.7')
  })

  it('fails open when siteverify throws, so an outage does not lock people out', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => {
      throw new Error('network down')
    })
    const r = await verifyTurnstile('tok', { secret: 'sk', fetchImpl })
    expect(r.ok).toBe(true)
    expect(r.skipped).toBe(true)
  })

  it('fails open when siteverify returns a non-200, same reasoning', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => new Response('gateway', { status: 502 }))
    const r = await verifyTurnstile('tok', { secret: 'sk', fetchImpl })
    expect(r.ok).toBe(true)
    expect(r.skipped).toBe(true)
  })
})
