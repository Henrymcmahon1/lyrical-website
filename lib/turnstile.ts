/**
 * Cloudflare Turnstile: the anti-bot challenge on the two studio entry points.
 *
 * Sign-in and submit are the bot-exposed surfaces. Sign-in is the unauthenticated front door, so
 * a loop there sends magic-link emails at arbitrary addresses and creates junk accounts. Submit
 * saves a job, keeps the uploaded files and emails both founders. A widget on each, verified
 * here, raises the cost of both past a script.
 *
 * ## Configured means on. Unconfigured means OFF, never open-to-forgery.
 *
 * `verifyTurnstile` returns `{ ok: true, skipped: true }` when there is no secret key, and the
 * client renders no widget when there is no site key. So with the keys absent the forms behave
 * exactly as they did before this existed. That is what lets the code ship dark and turn itself
 * on the moment both keys land in the environment, the same shape as `canEmailStrangers`.
 *
 * ## Fail open on an outage, closed on a verdict. Henry's call.
 *
 * A challenge is a hardening layer, not the lock on the door, so if Cloudflare cannot be reached
 * we let the request through rather than lock out a real customer during someone else's outage.
 * But an explicit `success: false` from Cloudflare, or a missing token while the feature is
 * configured, is a real rejection.
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

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export type TurnstileResult = {
  /** Whether the request may proceed. */
  ok: boolean
  /** True when we did not actually verify: feature off, or an outage we chose to let through. */
  skipped?: boolean
  /** For logs and tests. Never shown to a user. */
  reason?: 'unconfigured' | 'missing-token' | 'passed' | 'failed' | 'error'
}

/**
 * The one call this module makes: POST a URL-encoded body and get a Response. Narrower than the
 * full `fetch` signature on purpose, so a test can pass a plain `(url, init) => Response` mock
 * without reconstructing `fetch`'s overloads. The real `fetch` satisfies it.
 */
type FetchLike = (input: string, init: RequestInit) => Promise<Response>

type VerifyOptions = {
  /** Defaults to the environment. A parameter so tests need no real key and no global state. */
  secret?: string
  /** The caller's IP, passed to Cloudflare as a second signal. Optional. */
  remoteip?: string
  /** Injectable for tests. Defaults to the global fetch. */
  fetchImpl?: FetchLike
}

/**
 * Verify a Turnstile token, server-side.
 *
 * A token is single-use and short-lived, so this is called once per protected action, not cached.
 */
export async function verifyTurnstile(
  token: string,
  options: VerifyOptions = {},
): Promise<TurnstileResult> {
  const secret =
    options.secret !== undefined ? options.secret : process.env.TURNSTILE_SECRET_KEY

  // Off. Behave as if the feature does not exist.
  if (!secret) return { ok: true, skipped: true, reason: 'unconfigured' }

  // Configured, but the client sent nothing. That is a failure, not a pass: a real widget always
  // produces a token, so an empty one is a form that skipped the challenge.
  if (!token) return { ok: false, reason: 'missing-token' }

  const fetchImpl = options.fetchImpl ?? fetch
  const body = new URLSearchParams()
  body.set('secret', secret)
  body.set('response', token)
  if (options.remoteip) body.set('remoteip', options.remoteip)

  try {
    const res = await fetchImpl(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    })

    // A non-200 is an infrastructure problem on Cloudflare's side, not a verdict on the token.
    // Fail open, as with a thrown error below.
    if (!res.ok) return { ok: true, skipped: true, reason: 'error' }

    const data = (await res.json()) as { success?: boolean }
    return data.success ? { ok: true, reason: 'passed' } : { ok: false, reason: 'failed' }
  } catch {
    // Could not reach Cloudflare at all. Let the request through rather than lock out a real
    // customer during an outage. The rate limiter is still in front of this.
    return { ok: true, skipped: true, reason: 'error' }
  }
}
