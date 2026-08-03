import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CONTACT_EMAIL } from '@/lib/enquiry-email'

const insert = vi.fn()
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({ from: () => ({ insert: (...a: unknown[]) => insert(...a) }) }),
}))

const send = vi.fn()
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: (...a: unknown[]) => send(...a) }
  },
}))

process.env.GATE_SECRET = 'test-secret'
process.env.SUPABASE_URL = 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
// Two recipients on purpose: the notification goes to both founders, and a single-address
// value would not exercise the comma splitting that keeps Resend from seeing one bad address.
process.env.ENQUIRY_TO_EMAIL = 'jordan@lyricalglobal.com, henry@lyricalglobal.com'
process.env.ENQUIRY_FROM_EMAIL = 'onboarding@resend.dev'
process.env.RESEND_API_KEY = 'test-key'

const { POST } = await import('@/app/api/enquiry/route')
const { resetAllLimits } = await import('@/lib/rate-limit')

const valid = {
  name: 'Jordan Brock',
  email: 'Jordan@Example.com',
  role: 'label',
  source: 'hero',
  elapsed_ms: 5000,
  unlocked_audio: true,
}

const req = (body: unknown) =>
  new Request('http://localhost:3000/api/enquiry', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

beforeEach(() => {
  insert.mockReset()
  send.mockReset()
  insert.mockResolvedValue({ error: null })
  send.mockResolvedValue({})
  // The route is rate limited per IP. Every request here comes from the same (absent) IP,
  // so without this the sixth test in the file would start getting 429s from the fifth.
  resetAllLimits()
})

describe('POST /api/enquiry', () => {
  it('stores a valid enquiry and returns 200', async () => {
    const res = await POST(req(valid))
    expect(res.status).toBe(200)
    expect(insert).toHaveBeenCalledOnce()
  })

  it('normalises the email to lowercase before storing', async () => {
    await POST(req(valid))
    expect(insert.mock.calls[0][0]).toMatchObject({ email: 'jordan@example.com' })
  })

  it('emails both founders, with reply-to set to the enquirer', async () => {
    await POST(req(valid))
    expect(send.mock.calls[0][0]).toMatchObject({
      // An array, never the raw comma-separated string. Resend treats that string as a
      // single malformed address and rejects the send, which loses the lead silently.
      to: ['jordan@lyricalglobal.com', 'henry@lyricalglobal.com'],
      replyTo: 'jordan@example.com',
    })
  })

  it('sets the unlock cookie when the submission came from the gate', async () => {
    const res = await POST(req(valid))
    expect(res.headers.get('set-cookie') ?? '').toContain('lyr_unlocked=')
  })

  it('marks the cookie HttpOnly so script cannot read it', async () => {
    const res = await POST(req(valid))
    expect(res.headers.get('set-cookie') ?? '').toContain('HttpOnly')
  })

  it('does not set a cookie for an ordinary enquiry', async () => {
    const res = await POST(req({ ...valid, unlocked_audio: false }))
    expect(res.headers.get('set-cookie')).toBeNull()
  })

  it('rejects a malformed email with 400 and writes nothing', async () => {
    const res = await POST(req({ ...valid, email: 'nope' }))
    expect(res.status).toBe(400)
    expect(insert).not.toHaveBeenCalled()
  })

  it('rejects an unknown role', async () => {
    const res = await POST(req({ ...valid, role: 'ceo' }))
    expect(res.status).toBe(400)
  })

  it('rejects an unknown language code', async () => {
    const res = await POST(req({ ...valid, target_languages: ['XX'] }))
    expect(res.status).toBe(400)
  })

  it('silently drops a filled honeypot without writing', async () => {
    const res = await POST(req({ ...valid, website: 'http://spam.example' }))
    expect(res.status).toBe(400) // z.literal('') rejects a non-empty value
    expect(insert).not.toHaveBeenCalled()
  })

  it('drops a submission filled faster than two seconds', async () => {
    const res = await POST(req({ ...valid, elapsed_ms: 300 }))
    expect(res.status).toBe(200)
    expect(insert).not.toHaveBeenCalled()
  })

  it('STILL RETURNS 200 WHEN THE EMAIL FAILS — never lose the lead', async () => {
    send.mockRejectedValue(new Error('resend is down'))
    const res = await POST(req(valid))
    expect(res.status).toBe(200)
    expect(insert).toHaveBeenCalledOnce()
  })

  it('returns 500 when the database write fails', async () => {
    insert.mockResolvedValue({ error: { message: 'db down' } })
    const res = await POST(req(valid))
    expect(res.status).toBe(500)
  })

  it('accepts a native form post and redirects (the no-JS path)', async () => {
    const fd = new FormData()
    fd.set('name', 'Henry McMahon')
    fd.set('email', 'henry@example.com')
    fd.set('role', 'artist')
    fd.set('source', 'footer')
    fd.set('elapsed_ms', '9000')
    const res = await POST(
      new Request('http://localhost:3000/api/enquiry', { method: 'POST', body: fd }),
    )
    expect(res.status).toBe(303)
    expect(insert).toHaveBeenCalledOnce()
  })
})

describe('degrading when the site is deployed before its services exist', () => {
  const bare = { ...valid, unlocked_audio: false }

  it('still succeeds with no database, as long as the email goes', async () => {
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const res = await POST(req(bare))
    expect(res.status).toBe(200)
    expect(insert).not.toHaveBeenCalled()
    expect(send).toHaveBeenCalledOnce()
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
  })

  it('FAILS LOUDLY when there is no database and the email also fails', async () => {
    // The email is the only record here, so silently returning success would lose the lead.
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    send.mockRejectedValue(new Error('resend down'))
    const res = await POST(req(bare))
    expect(res.status).toBe(502)
    const body = await res.json()
    // The public contact address, not a founder's personal one: this string is shown to a
    // visitor whose enquiry just failed, so it has to be somewhere they can actually reach.
    expect(body.error).toContain(CONTACT_EMAIL)
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
  })

  it('tells the visitor where to go when nothing is configured at all', async () => {
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.RESEND_API_KEY
    const res = await POST(req(bare))
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toContain(CONTACT_EMAIL)
    expect(insert).not.toHaveBeenCalled()
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
    process.env.RESEND_API_KEY = 'test-key'
  })
})

describe('the enquiry route is rate limited', () => {
  it('allows five submissions from one caller, then answers 429', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await POST(req(valid))).status, `submission ${i + 1}`).toBe(200)
    }
    const blocked = await POST(req(valid))
    expect(blocked.status).toBe(429)
  })

  it('tells a throttled caller when to come back', async () => {
    for (let i = 0; i < 5; i++) await POST(req(valid))
    const blocked = await POST(req(valid))
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0)
  })

  it('writes nothing and sends nothing once throttled', async () => {
    for (let i = 0; i < 5; i++) await POST(req(valid))
    insert.mockClear()
    send.mockClear()
    await POST(req(valid))
    expect(insert).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it('counts callers separately by forwarded IP', async () => {
    const from = (ip: string) =>
      new Request('http://localhost:3000/api/enquiry', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
        body: JSON.stringify(valid),
      })

    for (let i = 0; i < 5; i++) await POST(from('203.0.113.9'))
    expect((await POST(from('203.0.113.9'))).status).toBe(429)
    // A different visitor must be unaffected by somebody else exhausting their allowance.
    expect((await POST(from('198.51.100.4'))).status).toBe(200)
  })
})
