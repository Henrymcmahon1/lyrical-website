import { describe, expect, it, vi, beforeEach } from 'vitest'

/**
 * Requesting a sign in link, which is now ours rather than Supabase's.
 *
 * The thing this file exists to stop happening again: on 2026-08-11 a link was requested from a
 * dev server left running on localhost and the email went out pointing at localhost, because
 * the old code built the redirect from `window.location.origin`. The host now comes from
 * `SITE_URL` on the server, and the first test below is the one that keeps it there.
 */

process.env.NEXT_PUBLIC_SITE_URL = 'https://lyricalglobal.com'

const generateLink = vi.fn()
const createUser = vi.fn()

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({
    auth: {
      admin: {
        generateLink: (...a: unknown[]) => generateLink(...a),
        createUser: (...a: unknown[]) => createUser(...a),
      },
    },
  }),
}))

const mailCustomer = vi.fn()
vi.mock('@/lib/mailer', () => ({
  mailCustomer: (...a: unknown[]) => mailCustomer(...a),
  mailFounders: vi.fn(),
}))

/**
 * A fresh client IP per call by default.
 *
 * The rate limiter is module-level and in-memory, so without this the fourth test in the file
 * starts failing for a reason that has nothing to do with what it is testing. `pinIp` forces a
 * shared address where the throttle itself is the subject.
 */
let ipCounter = 0
let pinnedIp: string | null = null
const pinIp = (ip: string) => {
  pinnedIp = ip
}
vi.mock('next/headers', () => ({
  headers: async () =>
    new Headers({ 'x-forwarded-for': pinnedIp ?? `198.51.100.${++ipCounter % 250}` }),
}))

const { requestSignInLink } = await import('@/app/studio/sign-in/actions')

/** The link the email was actually given. */
const sentLink = () => {
  const [mail] = mailCustomer.mock.calls[0]
  const match = /https?:\/\/[^\s"<]+auth\/callback[^\s"<]*/.exec(mail.text)
  return match?.[0] ?? ''
}

beforeEach(() => {
  vi.clearAllMocks()
  pinnedIp = null
  generateLink.mockResolvedValue({
    data: { properties: { hashed_token: 'HASH123' } },
    error: null,
  })
  createUser.mockResolvedValue({ error: null })
  mailCustomer.mockResolvedValue(true)
})

describe('where the link points', () => {
  it('uses SITE_URL, never a host the caller supplied', async () => {
    /**
     * The whole point. `requestSignInLink` takes an email and a path, and no origin, so there
     * is no argument a caller could pass that would change the host. A dev server, a preview
     * deployment or a hostile page cannot mint a link into anywhere but production.
     */
    await requestSignInLink('artist@label.example')
    expect(sentLink()).toMatch(/^https:\/\/lyricalglobal\.com\/auth\/callback\?/)
    expect(sentLink()).not.toContain('localhost')
  })

  it('carries the token hash so any browser can verify it', async () => {
    // The old PKCE link only worked in the browser that asked for it, which broke the very
    // normal act of requesting on a laptop and opening on a phone.
    await requestSignInLink('artist@label.example')
    expect(sentLink()).toContain('token_hash=HASH123')
    expect(sentLink()).toContain('type=magiclink')
  })

  it('keeps a same-origin next path', async () => {
    await requestSignInLink('artist@label.example', '/studio/new')
    expect(sentLink()).toContain('next=%2Fstudio%2Fnew')
  })

  it('REFUSES an off-site next, which would be a phishing redirect', async () => {
    // The link arrives by email carrying our domain in front of it, which is exactly the shape
    // an attacker wants for a redirect they control.
    await requestSignInLink('artist@label.example', 'https://evil.example/steal')
    expect(sentLink()).toContain('next=%2Fstudio')
    expect(sentLink()).not.toContain('evil.example')
  })

  it('refuses a protocol-relative next as well', async () => {
    await requestSignInLink('artist@label.example', '//evil.example')
    expect(sentLink()).not.toContain('evil.example')
  })
})

describe('accounts', () => {
  it('does not create one when the person already exists', async () => {
    await requestSignInLink('artist@label.example')
    expect(createUser).not.toHaveBeenCalled()
    expect(generateLink).toHaveBeenCalledTimes(1)
  })

  it('creates one on first sight, then mints the link', async () => {
    generateLink
      .mockResolvedValueOnce({ data: null, error: { message: 'User not found' } })
      .mockResolvedValueOnce({ data: { properties: { hashed_token: 'NEW' } }, error: null })

    const result = await requestSignInLink('new@label.example')

    expect(createUser).toHaveBeenCalledWith({ email: 'new@label.example', email_confirm: true })
    expect(result.ok).toBe(true)
    expect(sentLink()).toContain('token_hash=NEW')
  })

  it('gives up rather than looping when the second attempt also fails', async () => {
    generateLink.mockResolvedValue({ data: null, error: { message: 'nope' } })
    const result = await requestSignInLink('new@label.example')
    expect(result.ok).toBe(false)
    expect(generateLink).toHaveBeenCalledTimes(2)
    expect(mailCustomer).not.toHaveBeenCalled()
  })
})

describe('what the caller is told', () => {
  it('rejects something that is not an address without touching Supabase', async () => {
    for (const bad of ['', '   ', 'nope', 'a@b', 'a b@c.com']) {
      const result = await requestSignInLink(bad)
      expect(result.ok).toBe(false)
    }
    expect(generateLink).not.toHaveBeenCalled()
  })

  it('normalises the address, so Case@X and case@x are one account', async () => {
    await requestSignInLink('  Artist@Label.Example  ')
    expect(generateLink).toHaveBeenCalledWith({
      type: 'magiclink',
      email: 'artist@label.example',
    })
  })

  it('reports a failure to send rather than claiming success', async () => {
    // Silently saying "check your email" when nothing was sent is the worst outcome here:
    // the person waits, then leaves.
    vi.stubEnv('NODE_ENV', 'production')
    mailCustomer.mockResolvedValue(false)
    const result = await requestSignInLink('artist@label.example')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/could not send/i)
    vi.unstubAllEnvs()
  })

  it('NEVER writes a working link to the log in production', async () => {
    /**
     * Development gets the link on the console, because `RESEND_API_KEY` is not in `.env.local`
     * and without that escape hatch nobody could sign in locally at all. Production must not,
     * for the same reason no email here carries a storage path: a log line holding a live
     * credential is that credential, sitting in whatever aggregator reads the logs.
     */
    vi.stubEnv('NODE_ENV', 'production')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mailCustomer.mockResolvedValue(false)

    await requestSignInLink('artist@label.example')

    const logged = warn.mock.calls.flat().join(' ')
    expect(logged).not.toContain('token_hash')
    expect(logged).not.toContain('HASH123')

    warn.mockRestore()
    vi.unstubAllEnvs()
  })

  it('DOES log the link outside production, or local development cannot sign in', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mailCustomer.mockResolvedValue(false)

    const result = await requestSignInLink('artist@label.example')

    expect(result.ok).toBe(true)
    expect(warn.mock.calls.flat().join(' ')).toContain('token_hash=HASH123')
    warn.mockRestore()
  })
})

describe('the email itself', () => {
  it('contains the link and nothing else worth stealing', async () => {
    await requestSignInLink('artist@label.example')
    const [mail] = mailCustomer.mock.calls[0]
    const body = `${mail.text}\n${mail.html}`
    expect(mail.subject).toBe('lyrical: your sign in link')
    expect(body).not.toMatch(/submissions\/|supabase\.co|\.wav|\.flac/i)
    // Lowercase brand, in the subject as well as the body.
    expect(mail.subject).not.toMatch(/Lyrical/)
  })

  it('goes through the stranger gate, like every other customer email', async () => {
    // `mailCustomer` is what refuses to send from an unverified sender. Using it here rather
    // than a raw send is what stops a sign in link landing in spam from an @resend.dev address.
    await requestSignInLink('artist@label.example')
    expect(mailCustomer).toHaveBeenCalledTimes(1)
    expect(mailCustomer.mock.calls[0][1]).toBe('sign-in-link')
  })
})

describe('throttling', () => {
  it('stops a loop from mailing an address over and over', async () => {
    /**
     * Best effort and honestly labelled: this limiter is per serverless instance, and Vercel
     * may put the next request on a different one. It is worth having anyway, because sending
     * mail costs money and sender reputation, and the cheap abuse here is a tight loop, which
     * tends to land on one warm instance.
     */
    pinIp('198.51.100.253')

    for (let i = 0; i < 3; i++) {
      expect((await requestSignInLink('artist@label.example')).ok).toBe(true)
    }

    const blocked = await requestSignInLink('artist@label.example')
    expect(blocked.ok).toBe(false)
    expect(blocked.error).toMatch(/too many/i)
    expect(mailCustomer).toHaveBeenCalledTimes(3)
  })
})
