import { afterEach, describe, expect, it, vi } from 'vitest'
import { requireBearerSecret, requireSharedSecret } from '@/lib/hook-auth'

/**
 * The shared-secret gate both `app/api/hooks/**` routes use. One file so the "fail loud (503)
 * only on a missing secret in production" rule cannot drift between the two call sites.
 */

afterEach(() => {
  delete process.env.TEST_SECRET
  vi.unstubAllEnvs()
})

describe('requireSharedSecret (x-hook-secret style)', () => {
  it('passes when the header matches the configured secret', () => {
    process.env.TEST_SECRET = 'shh'
    expect(requireSharedSecret('shh', 'TEST_SECRET')).toEqual({ ok: true })
  })

  it('401s a wrong or missing header when a secret is configured', () => {
    process.env.TEST_SECRET = 'shh'
    expect(requireSharedSecret('nope', 'TEST_SECRET').ok).toBe(false)
    expect((requireSharedSecret('nope', 'TEST_SECRET') as { status: number }).status).toBe(401)
    expect(requireSharedSecret(null, 'TEST_SECRET').ok).toBe(false)
  })

  it('503s when unset in production: fail loud', () => {
    delete process.env.TEST_SECRET
    vi.stubEnv('NODE_ENV', 'production')
    const result = requireSharedSecret('anything', 'TEST_SECRET')
    expect(result.ok).toBe(false)
    expect((result as { status: number }).status).toBe(503)
  })

  it('passes when unset outside production, so local testing works with no secret configured', () => {
    delete process.env.TEST_SECRET
    expect(requireSharedSecret(null, 'TEST_SECRET')).toEqual({ ok: true })
  })
})

describe('requireBearerSecret (Vercel Cron Authorization header style)', () => {
  it('passes on "Bearer <secret>"', () => {
    process.env.TEST_SECRET = 'shh'
    expect(requireBearerSecret('Bearer shh', 'TEST_SECRET')).toEqual({ ok: true })
  })

  it('401s a wrong token, a missing Bearer prefix, or a missing header', () => {
    process.env.TEST_SECRET = 'shh'
    expect(requireBearerSecret('Bearer nope', 'TEST_SECRET').ok).toBe(false)
    expect(requireBearerSecret('shh', 'TEST_SECRET').ok).toBe(false)
    expect(requireBearerSecret(null, 'TEST_SECRET').ok).toBe(false)
  })

  it('503s when unset in production', () => {
    delete process.env.TEST_SECRET
    vi.stubEnv('NODE_ENV', 'production')
    expect((requireBearerSecret('Bearer anything', 'TEST_SECRET') as { status: number }).status).toBe(503)
  })
})
