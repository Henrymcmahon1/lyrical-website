import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Authentication for /leads, which shows real people's names, emails and messages.
 *
 * One shared password, held in `ADMIN_PASSWORD`, exchanged for an HMAC-signed session
 * cookie. Deliberately small: two founders, no user accounts to manage, no third-party
 * dependency, and it works on the free plan. Rotate by changing the environment variable,
 * which invalidates nothing else on the site.
 *
 * Reuses `GATE_SECRET` for signing, so there is one secret to manage rather than two. The
 * payload is NAMESPACED with an `admin:` prefix for that reason: without it, the token every
 * visitor receives for asking to hear examples would be a valid admin session, because both
 * are HMACs of arbitrary text under the same key. A test asserts a gate token is rejected.
 */

export const ADMIN_COOKIE = 'lyr_admin'

/** Sessions last half a day. Long enough not to be annoying, short enough to expire. */
export const ADMIN_MAX_AGE_MS = 12 * 60 * 60 * 1000

const PREFIX = 'admin:'

function secret(): string {
  const s = process.env.GATE_SECRET
  if (!s) throw new Error('GATE_SECRET must be set — generate with: openssl rand -hex 32')
  return s
}

function mac(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('hex')
}

/** Constant-time string compare that tolerates unequal lengths. */
function sameString(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  // timingSafeEqual throws unless the buffers match in length. Comparing lengths first
  // leaks only the length, which is not the secret.
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

/** Mint a session token stamped with the time it was issued. */
export function signAdminSession(issuedAtMs: number): string {
  const payload = `${PREFIX}${issuedAtMs}`
  return `${Buffer.from(payload).toString('base64url')}.${mac(payload)}`
}

/**
 * Verify a session token: correct signature, our namespace, and inside the window.
 *
 * Never throws. A page component that threw on a missing `GATE_SECRET` would return a 500
 * instead of a login form, which is a worse failure than asking for the password again.
 */
export function verifyAdminSession(token: string | undefined, nowMs: number): boolean {
  if (!token) return false
  const [b64, given] = token.split('.')
  if (!b64 || !given) return false

  try {
    const payload = Buffer.from(b64, 'base64url').toString('utf8')
    if (!payload.startsWith(PREFIX)) return false

    if (!sameString(given, mac(payload))) return false

    const issuedAt = Number(payload.slice(PREFIX.length))
    if (!Number.isFinite(issuedAt)) return false

    // A timestamp in the future means a forged or replayed payload, not a valid session.
    if (issuedAt > nowMs) return false

    return nowMs - issuedAt < ADMIN_MAX_AGE_MS
  } catch {
    return false
  }
}

/**
 * Check a submitted password against `ADMIN_PASSWORD`.
 *
 * FAILS CLOSED. If the variable is unset, nothing matches, including an empty submission.
 * The dangerous version of this function is one where an unconfigured deployment lets
 * everybody in.
 */
export function checkAdminPassword(supplied: string | undefined): boolean {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected || !supplied) return false
  return sameString(supplied, expected)
}
