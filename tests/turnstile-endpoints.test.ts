import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Every protected endpoint refuses, in plain words, when the Turnstile check does not pass
 * (issue #392): a missing token, a bad token, a token from another form, and a siteverify outage.
 * Nothing is written and nothing is mailed on a refusal. The verifier's own rules are in
 * tests/turnstile.test.ts; this file proves each endpoint actually uses them.
 */

process.env.TURNSTILE_SECRET_KEY = 'sk-test'
process.env.TURNSTILE_EXPECTED_HOSTNAMES = 'lyricalglobal.com'
process.env.NEXT_PUBLIC_SITE_URL = 'https://lyricalglobal.com'
process.env.GATE_SECRET = 'test-secret'
process.env.SUPABASE_URL = 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
process.env.ENQUIRY_TO_EMAIL = 'jordan@lyricalglobal.com'
process.env.ENQUIRY_FROM_EMAIL = 'onboarding@resend.dev'
process.env.RESEND_API_KEY = 'test-key'

type Scenario = 'pass' | 'bad' | 'wrong-action' | 'outage'
let scenario: Scenario = 'pass'
let expectedAction = ''
const siteverify = vi.fn(async () => {
  if (scenario === 'outage') throw new Error('network down')
  const body =
    scenario === 'bad'
      ? { success: false, 'error-codes': ['invalid-input-response'] }
      : { success: true, hostname: 'lyricalglobal.com', action: scenario === 'wrong-action' ? 'some-other-form' : expectedAction }
  return new Response(JSON.stringify(body), { status: 200 })
})
vi.stubGlobal('fetch', siteverify)

const insert = vi.fn(async () => ({ error: null }))
const generateLink = vi.fn()
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({
    from: () => ({ insert }),
    auth: { admin: { generateLink: (...a: unknown[]) => generateLink(...a), createUser: vi.fn() } },
  }),
}))
const send = vi.fn()
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: (...a: unknown[]) => send(...a) }
  },
}))
const mailCustomer = vi.fn()
vi.mock('@/lib/mailer', () => ({ mailCustomer: (...a: unknown[]) => mailCustomer(...a), mailFounders: vi.fn() }))
let ip = 0
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': `198.51.100.${++ip % 250}` }),
  cookies: async () => ({ set: vi.fn(), get: vi.fn() }),
}))
vi.mock('@/lib/supabase-server', () => ({
  currentUser: async () => ({ id: `user-${ip}` }),
  supabaseServer: async () => ({ from: () => ({ insert }) }),
}))

const { POST: enquiry } = await import('@/app/api/enquiry/route')
const { requestSignInLink } = await import('@/app/studio/sign-in/actions')
const { submitSongJob } = await import('@/app/studio/submit-actions')
const { submitVoiceModel } = await import('@/app/studio/voices/actions')
const { guardForm } = await import('@/lib/form-guard')
const { resetAllLimits } = await import('@/lib/rate-limit')

const HUMAN = 'That did not look human. Refresh the page and try again.'
const OUTAGE = 'We could not check that just now. Please try again in a minute.'
const REFUSALS: [Scenario | 'missing', string][] = [
  ['missing', HUMAN],
  ['bad', HUMAN],
  ['wrong-action', HUMAN],
  ['outage', OUTAGE],
]
const tokenFor = (s: Scenario | 'missing') => (s === 'missing' ? '' : 'tok')

beforeEach(() => {
  vi.clearAllMocks()
  resetAllLimits()
  scenario = 'pass'
})
afterAll(() => {
  vi.unstubAllGlobals()
})

describe('contact enquiry (POST /api/enquiry)', () => {
  const body = (turnstileToken: string) =>
    new Request('https://lyricalglobal.com/api/enquiry', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `203.0.113.${++ip % 250}` },
      body: JSON.stringify({ name: 'Jordan Brock', email: 'j@example.com', role: 'label', source: 'hero', elapsed_ms: 5000, unlocked_audio: false, turnstileToken }),
    })

  it.each(REFUSALS)('refuses on %s, writing and mailing nothing', async (s, message) => {
    expectedAction = 'enquiry'
    if (s !== 'missing') scenario = s
    const res = await enquiry(body(tokenFor(s)))
    expect(res.status).toBe(s === 'outage' ? 503 : 403)
    expect(await res.json()).toEqual({ error: message })
    expect(insert).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it('accepts a passing token', async () => {
    expectedAction = 'enquiry'
    const res = await enquiry(body('tok'))
    expect(res.status).toBe(200)
  })

  it('refuses a no-JavaScript form post, which cannot carry a token', async () => {
    const fd = new FormData()
    fd.set('name', 'Jordan Brock')
    fd.set('email', 'j@example.com')
    fd.set('role', 'label')
    fd.set('source', 'hero')
    fd.set('elapsed_ms', '5000')
    const res = await enquiry(new Request('https://lyricalglobal.com/api/enquiry', { method: 'POST', body: fd }))
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toContain('enquiry=error')
    expect(insert).not.toHaveBeenCalled()
  })
})

describe('studio sign-in (requestSignInLink)', () => {
  it.each(REFUSALS)('refuses on %s, minting and mailing nothing', async (s, message) => {
    expectedAction = 'sign-in'
    if (s !== 'missing') scenario = s
    expect(await requestSignInLink('a@b.example', undefined, tokenFor(s))).toEqual({ ok: false, error: message })
    expect(generateLink).not.toHaveBeenCalled()
    expect(mailCustomer).not.toHaveBeenCalled()
  })

  it('a token for THIS form gets past the check', async () => {
    expectedAction = 'sign-in'
    generateLink.mockResolvedValue({ data: { properties: { hashed_token: 'H', verification_type: 'magiclink' } }, error: null })
    mailCustomer.mockResolvedValue(true)
    expect(await requestSignInLink('a@b.example', undefined, 'tok')).toEqual({ ok: true })
    expect(generateLink).toHaveBeenCalled()
  })

  it('a filled honeypot looks sent to the bot, and sends nothing', async () => {
    expect(await requestSignInLink('a@b.example', undefined, 'tok', 'http://spam')).toEqual({ ok: true })
    expect(generateLink).not.toHaveBeenCalled()
    expect(siteverify).not.toHaveBeenCalled()
  })

  it('refuses an absurdly long address before anything else', async () => {
    expect((await requestSignInLink(`${'a'.repeat(300)}@b.example`, undefined, 'tok')).ok).toBe(false)
    expect(siteverify).not.toHaveBeenCalled()
  })
})

describe('song submit (submitSongJob)', () => {
  const raw = (turnstileToken: string) => ({ jobId: '11111111-1111-4111-8111-111111111111', turnstileToken })

  it.each(REFUSALS)('refuses on %s before saving anything', async (s, message) => {
    expectedAction = 'submit'
    if (s !== 'missing') scenario = s
    expect(await submitSongJob(raw(tokenFor(s)))).toEqual({ ok: false, error: message })
    expect(insert).not.toHaveBeenCalled()
  })

  it('a token for THIS form gets past the check', async () => {
    expectedAction = 'submit'
    const r = await submitSongJob(raw('tok'))
    // Past Turnstile, the empty test payload fails validation instead: a different message.
    expect(r).toMatchObject({ ok: false })
    expect(r && 'error' in r ? r.error : '').not.toBe(HUMAN)
    expect(siteverify).toHaveBeenCalledOnce()
  })

  it('rate limits one account', async () => {
    expectedAction = 'submit'
    scenario = 'bad'
    const fixed = ip
    for (let i = 0; i < 10; i++) {
      ip = fixed
      await submitSongJob(raw('tok'))
    }
    ip = fixed
    expect(await submitSongJob(raw('tok'))).toEqual({ ok: false, error: 'That is a lot of songs in a short time. Wait an hour and try again.' })
  })
})

describe('voice upload (submitVoiceModel)', () => {
  it.each(REFUSALS)('refuses on %s before saving anything', async (s, message) => {
    expectedAction = 'voice-upload'
    if (s !== 'missing') scenario = s
    expect(await submitVoiceModel({ turnstileToken: tokenFor(s) })).toEqual({ ok: false, error: message })
    expect(insert).not.toHaveBeenCalled()
  })
})

describe('voice upload passes a token for its own form', () => {
  it('gets past the check', async () => {
    expectedAction = 'voice-upload'
    const r = await submitVoiceModel({ turnstileToken: 'tok' })
    expect(r && 'error' in r ? r.error : '').not.toBe(HUMAN)
    expect(siteverify).toHaveBeenCalledOnce()
  })
})

describe('listen and staff login (guardForm)', () => {
  const form = (token: string, website = '') => {
    const fd = new FormData()
    fd.set('password', 'x')
    fd.set('website', website)
    if (token) fd.set('cf-turnstile-response', token)
    return fd
  }

  it.each(['listen', 'staff-login'] as const)('%s: refuses missing, bad and wrong-form tokens as bot, an outage as check', async (action) => {
    expectedAction = action
    const h = new Headers()
    expect(await guardForm(form(''), action, h)).toEqual({ ok: false, code: 'bot' })
    scenario = 'bad'
    expect(await guardForm(form('tok'), action, h)).toEqual({ ok: false, code: 'bot' })
    scenario = 'wrong-action'
    expect(await guardForm(form('tok'), action, h)).toEqual({ ok: false, code: 'bot' })
    scenario = 'outage'
    expect(await guardForm(form('tok'), action, h)).toEqual({ ok: false, code: 'check' })
    scenario = 'pass'
    expect(await guardForm(form('tok'), action, h)).toEqual({ ok: true })
  })

  it('a filled honeypot is refused without asking Cloudflare', async () => {
    expect(await guardForm(form('tok', 'http://spam'), 'listen', new Headers())).toEqual({ ok: false, code: 'bot' })
    expect(siteverify).not.toHaveBeenCalled()
  })
})
