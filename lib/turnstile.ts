/**
 * Cloudflare Turnstile: the anti-bot challenge on every public form (issue #392).
 *
 * ## It fails CLOSED
 *
 * Henry's call on 2026-10-06, reversing the earlier "fail open on an outage". Every one of these
 * is a refusal:
 *
 *   - no token (a form that skipped the challenge),
 *   - a token Cloudflare says is bad,
 *   - a token solved on a different form (`action`) or on a different site (`hostname`), so a
 *     token farmed from one page cannot be replayed against another,
 *   - Cloudflare unreachable, slow, or answering nonsense,
 *   - a production deploy with no secret key, which would otherwise leave every form silently
 *     unprotected. That one is also logged as an error so it is noticed.
 *
 * The only pass without a verified token is local development with no key configured, so the
 * forms still work on a laptop.
 *
 * ## One site key, many forms
 *
 * Every widget uses the same `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and sends its own `action` name;
 * the server checks the action it expects. No per-form keys.
 */

/**
 * The public site key, or null when the feature is off.
 *
 * `NEXT_PUBLIC_` because the widget needs it in the browser, and it is safe there: the site key
 * is embedded in the rendered widget by design and is not a secret. The SECRET key never carries
 * that prefix and never reaches the client.
 */
export function turnstileSiteKey(): string | null {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null
}

/** The `action` each form's widget sends, and the server expects. One place, so they cannot drift. */
export const TURNSTILE_ACTIONS = {
  enquiry: 'enquiry',
  signIn: 'sign-in',
  submit: 'submit',
  voiceUpload: 'voice-upload',
  listen: 'listen',
  staffLogin: 'staff-login',
} as const
export type TurnstileAction = (typeof TURNSTILE_ACTIONS)[keyof typeof TURNSTILE_ACTIONS]

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const SITEVERIFY_TIMEOUT_MS = 8000
const DEFAULT_HOSTNAMES = ['lyricalglobal.com', 'www.lyricalglobal.com']

export type TurnstileRefusal = 'unconfigured' | 'missing-token' | 'failed' | 'wrong-action' | 'wrong-hostname' | 'error'
export type TurnstileResult =
  | { ok: true; reason: 'passed' | 'dev-unconfigured' }
  | { ok: false; reason: TurnstileRefusal }

/**
 * The one call this module makes: POST a URL-encoded body and get a Response. Narrower than the
 * full `fetch` signature so a test can pass a plain mock. The real `fetch` satisfies it.
 */
type FetchLike = (input: string, init: RequestInit) => Promise<Response>

type VerifyOptions = {
  /** The action this endpoint expects, e.g. `TURNSTILE_ACTIONS.signIn`. Required: no default. */
  action: TurnstileAction | string
  /** Defaults to `TURNSTILE_SECRET_KEY`. */
  secret?: string
  /** The caller's IP, passed to Cloudflare as a second signal. Optional. */
  remoteip?: string
  /** Defaults to `TURNSTILE_EXPECTED_HOSTNAMES` (comma list), else lyricalglobal.com and www. */
  hostnames?: string[]
  /** Defaults to NODE_ENV === 'production'. Decides what a missing secret means. */
  production?: boolean
  /** Injectable for tests. Defaults to the global fetch. */
  fetchImpl?: FetchLike
}

function expectedHostnames(): string[] {
  const raw = process.env.TURNSTILE_EXPECTED_HOSTNAMES
  if (!raw) return DEFAULT_HOSTNAMES
  return raw
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * Verify a Turnstile token, server side. A token is single use and short lived, so this is called
 * once per protected action, never cached.
 */
export async function verifyTurnstile(token: string, options: VerifyOptions): Promise<TurnstileResult> {
  const secret = options.secret !== undefined ? options.secret : process.env.TURNSTILE_SECRET_KEY
  const production = options.production ?? process.env.NODE_ENV === 'production'

  if (!secret) {
    if (!production) return { ok: true, reason: 'dev-unconfigured' }
    console.error('[turnstile] TURNSTILE_SECRET_KEY is not set in production: refusing every protected form')
    return { ok: false, reason: 'unconfigured' }
  }

  if (!token) return { ok: false, reason: 'missing-token' }

  const fetchImpl = options.fetchImpl ?? fetch
  const body = new URLSearchParams()
  body.set('secret', secret)
  body.set('response', token)
  if (options.remoteip) body.set('remoteip', options.remoteip)

  let data: { success?: unknown; action?: unknown; hostname?: unknown }
  try {
    const res = await fetchImpl(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS),
    })
    if (!res.ok) {
      console.error('[turnstile] siteverify answered', res.status)
      return { ok: false, reason: 'error' }
    }
    data = await res.json()
  } catch (e) {
    console.error('[turnstile] siteverify unreachable', e)
    return { ok: false, reason: 'error' }
  }

  if (data.success !== true) return { ok: false, reason: 'failed' }
  if (data.action !== options.action) return { ok: false, reason: 'wrong-action' }
  const hostnames = (options.hostnames ?? expectedHostnames()).map((h) => h.toLowerCase())
  if (typeof data.hostname !== 'string' || !hostnames.includes(data.hostname.toLowerCase())) {
    return { ok: false, reason: 'wrong-hostname' }
  }
  return { ok: true, reason: 'passed' }
}

/** What to tell a person who was refused. Plain words; never the internal reason. */
export function turnstileMessage(reason: TurnstileRefusal): string {
  if (reason === 'error') return 'We could not check that just now. Please try again in a minute.'
  if (reason === 'unconfigured') return 'This form is not available right now. Please try again later.'
  return 'That did not look human. Refresh the page and try again.'
}

/** The token the widget writes into a native `<form>` as a hidden field. */
export function turnstileTokenFrom(formData: FormData): string {
  const v = formData.get('cf-turnstile-response')
  return typeof v === 'string' ? v : ''
}

/** The caller's IP from the proxy header, for siteverify's optional second signal. */
export function callerIp(headers: Headers): string | undefined {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined
}
