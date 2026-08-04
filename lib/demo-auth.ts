import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Authentication for /listen, the private A/B comparison page.
 *
 * Same shape as `admin-auth`, and deliberately a SEPARATE namespace and a separate password.
 * The two audiences are different: /leads is the two founders, /listen is whoever is on the
 * other end of a sales conversation. A person given the listening password must not end up
 * holding a token that opens the enquiry inbox, and revoking one must not revoke the other.
 *
 * Reuses `GATE_SECRET` for signing, so there is still one secret to manage. `GATE_SECRET`
 * now signs three different things: the visitor audio-gate cookie, the admin session and
 * this. All three are HMACs of arbitrary text under one key, so the payload is NAMESPACED
 * or they would be interchangeable. Tests assert that each rejects the others' tokens.
 */

export const DEMO_COOKIE = 'lyr_listen'

/**
 * Four hours, against twelve for the admin session.
 *
 * This password is given to people outside the company, sometimes on a device that is not
 * theirs. A session that outlives the meeting is a link left open on somebody else's laptop.
 */
export const DEMO_MAX_AGE_MS = 4 * 60 * 60 * 1000

const PREFIX = 'listen:'

function secret(): string {
  const s = process.env.GATE_SECRET
  if (!s) throw new Error('GATE_SECRET must be set — generate with: openssl rand -hex 32')
  return s
}

function mac(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('hex')
}

/** Constant-time compare that tolerates unequal lengths. */
function sameString(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

export function signDemoSession(issuedAtMs: number): string {
  const payload = `${PREFIX}${issuedAtMs}`
  return `${Buffer.from(payload).toString('base64url')}.${mac(payload)}`
}

/**
 * Verify a session token: correct signature, our namespace, inside the window.
 *
 * Never throws. A page that threw on a missing `GATE_SECRET` would return a 500 instead of
 * a password form, which is a worse failure than asking again.
 */
export function verifyDemoSession(token: string | undefined, nowMs: number): boolean {
  if (!token) return false
  const [b64, given] = token.split('.')
  if (!b64 || !given) return false

  try {
    const payload = Buffer.from(b64, 'base64url').toString('utf8')
    if (!payload.startsWith(PREFIX)) return false
    if (!sameString(given, mac(payload))) return false

    const issuedAt = Number(payload.slice(PREFIX.length))
    if (!Number.isFinite(issuedAt)) return false
    // A timestamp in the future is a forged or replayed payload, not a session.
    if (issuedAt > nowMs) return false

    return nowMs - issuedAt < DEMO_MAX_AGE_MS
  } catch {
    return false
  }
}

/**
 * Check a submitted password against `DEMO_PASSWORD`.
 *
 * FAILS CLOSED. Unset means nothing matches, including an empty submission, so a deployment
 * without the variable refuses everybody rather than publishing the recordings to anyone who
 * finds the URL.
 */
export function checkDemoPassword(supplied: string | undefined): boolean {
  const expected = process.env.DEMO_PASSWORD
  if (!expected || !supplied) return false
  return sameString(supplied, expected)
}
