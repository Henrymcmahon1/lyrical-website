import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const insert = vi.fn()
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({ from: () => ({ insert: (...a: unknown[]) => insert(...a) }) }),
}))
// The mailer is mocked at the module boundary, as tests/enquiry-route.test.ts does, so no
// real email leaves the test run.
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: vi.fn().mockResolvedValue({}) }
  },
}))

process.env.SUPABASE_URL = 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
process.env.ENQUIRY_TO_EMAIL = 'jordan@lyricalglobal.com'
process.env.ENQUIRY_FROM_EMAIL = 'onboarding@resend.dev'
process.env.RESEND_API_KEY = 'test-key'

const { POST: adapter } = await import('@/app/artists/eoi/route')
const { POST: enquiry } = await import('@/app/api/enquiry/route')
const { resetAllLimits } = await import('@/lib/rate-limit')
const { toEnquiry, EoiSchema } = await import('@/lib/eoi-schema')

const fields: Record<string, string> = {
  name: 'Coffey Anderson',
  artistName: 'Coffey Anderson',
  email: 'coffey@example.com',
  role: 'artist',
  catalogue_size: '11-100',
  monthlyStreamsBand: '100k-1m',
  links: 'https://open.spotify.com/artist/abc',
  message: 'Ready when you are.',
  elapsed_ms: '9000',
  website: '',
}

const formPost = (extra: Record<string, string> = {}) => {
  const fd = new FormData()
  for (const [k, v] of Object.entries({ ...fields, ...extra })) fd.set(k, v)
  fd.append('target_languages', 'ES')
  return adapter(
    new Request('http://localhost:3000/artists/eoi', {
      method: 'POST',
      body: fd,
      headers: { 'x-forwarded-for': '203.0.113.9' },
    }),
  )
}

const jsonPost = (body: unknown) =>
  enquiry(
    new Request('http://localhost:3000/api/enquiry', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )

beforeEach(() => {
  insert.mockReset()
  insert.mockResolvedValue({ error: null })
  resetAllLimits()
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('POST /artists/eoi (the no-JS path)', () => {
  it('writes an artist_eoi enquiry with the labelled lines and redirects back to /artists', async () => {
    const res = await formPost()
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('http://localhost:3000/artists?eoi=sent#eoi')
    expect(insert).toHaveBeenCalledOnce()
    expect(insert.mock.calls[0][0]).toMatchObject({
      source: 'artist_eoi',
      company: 'Coffey Anderson',
      target_languages: ['ES'],
      email: 'coffey@example.com',
    })
    expect(insert.mock.calls[0][0].message).toContain('Monthly streams: 100k to 1m')
    expect(insert.mock.calls[0][0].message).toContain('Links: https://open.spotify.com/artist/abc')
  })

  it('redirects to the error state on an invalid submission or a filled honeypot, writing nothing', async () => {
    const bads: Record<string, string>[] = [{ email: 'nope' }, { website: 'http://spam.example' }]
    for (const bad of bads) {
      const res = await formPost(bad)
      expect(res.status).toBe(303)
      expect(res.headers.get('location')).toBe('http://localhost:3000/artists?eoi=error#eoi')
    }
    expect(insert).not.toHaveBeenCalled()
  })
})

describe('Turnstile on the JSON path', () => {
  const payload = {
    ...toEnquiry(EoiSchema.parse({ ...fields, target_languages: ['ES'] })),
    elapsed_ms: 9000,
    website: '',
  }

  it('is skipped when unconfigured', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '')
    expect((await jsonPost(payload)).status).toBe(200)
  })

  it('rejects an artist_eoi JSON post with no token when configured', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret')
    expect((await jsonPost(payload)).status).toBe(400)
    expect(insert).not.toHaveBeenCalled()
  })

  it('does not gate other sources (the contact form sends no token)', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret')
    expect((await jsonPost({ ...payload, source: 'contact' })).status).toBe(200)
  })
})
