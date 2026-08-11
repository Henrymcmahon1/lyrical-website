import { describe, it, expect, vi, beforeEach } from 'vitest'

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

  it('sets NO cookie at all, since the examples gate was removed', async () => {
    /**
     * This route used to mint a signed, year-long `lyr_unlocked` cookie so the listening
     * section could thank a returning visitor instead of asking twice. The examples request
     * went on 2026-08-11 and the cookie went with it: a year-long cookie that changes nothing
     * on any page is one more thing to explain to a rights holder's lawyer, for no benefit.
     *
     * Asserted rather than simply deleted, because a cookie quietly reappearing on a public
     * form is the kind of change nobody notices until somebody asks what it is for.
     */
    const res = await POST(req(valid))
    expect(res.headers.get('set-cookie')).toBeNull()
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

  /**
   * `unlocked_audio` after the examples request was removed, 2026-08-11.
   *
   * The radio that set it is gone, and the column stays because it holds real history from
   * every enquiry made while the question existed. What is still worth pinning is the part
   * that was always the point: the SERVER decides this value, not the client. A field a
   * hand-written POST can assert about itself is not a record of anything.
   */
  describe('unlocked_audio', () => {
    const post = (extra: Record<string, string>) => {
      const fd = new FormData()
      fd.set('name', 'Henry McMahon')
      fd.set('email', 'henry@example.com')
      fd.set('source', 'footer')
      fd.set('elapsed_ms', '9000')
      for (const [k, v] of Object.entries(extra)) fd.set(k, v)
      return POST(new Request('http://localhost:3000/api/enquiry', { method: 'POST', body: fd }))
    }

    it('is false now that nothing on the site asks for examples', async () => {
      await post({})
      expect(insert.mock.calls[0][0]).toMatchObject({ unlocked_audio: false })
    })

    it('CANNOT be forged by asserting it in the body', async () => {
      // The client says true. The server does not read it from there, and never did.
      await post({ unlocked_audio: 'true' })
      expect(insert.mock.calls[0][0]).toMatchObject({ unlocked_audio: false })
    })

    it('ignores a leftover intent field from a stale cached page', async () => {
      // Somebody holding an old version of the form in a tab can still post `intent`. It must
      // not resurrect a promise the site no longer makes.
      await post({ intent: 'examples' })
      expect(insert.mock.calls[0][0]).toMatchObject({ unlocked_audio: false })
    })

    it('ignores the old gate source for the same reason', async () => {
      await post({ source: 'gate' })
      expect(insert.mock.calls[0][0]).toMatchObject({ unlocked_audio: false })
    })
  })
})
