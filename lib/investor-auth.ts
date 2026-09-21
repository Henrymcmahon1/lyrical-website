import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Authentication for /investors. Same shape as demo-auth, a SEPARATE namespace and password:
 * an investor must never hold a token that opens /listen or /leads, and revoking one must not
 * revoke the others. GATE_SECRET signs all of them; the payload prefix keeps them apart.
 */
export const INVESTOR_COOKIE = 'lyr_investor'
export const INVESTOR_MAX_AGE_MS = 4 * 60 * 60 * 1000
const PREFIX = 'investor:'

function secret(): string {
  const s = process.env.GATE_SECRET
  if (!s) throw new Error('GATE_SECRET must be set. Generate with: openssl rand -hex 32')
  return s
}
const mac = (payload: string) => createHmac('sha256', secret()).update(payload).digest('hex')
function sameString(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8'); const bb = Buffer.from(b, 'utf8')
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

export function signInvestorSession(issuedAtMs: number): string {
  const payload = `${PREFIX}${issuedAtMs}`
  return `${Buffer.from(payload).toString('base64url')}.${mac(payload)}`
}

/** Never throws: a missing secret means "ask again", not a 500. */
export function verifyInvestorSession(token: string | undefined, nowMs: number): boolean {
  if (!token) return false
  const [b64, given] = token.split('.')
  if (!b64 || !given) return false
  try {
    const payload = Buffer.from(b64, 'base64url').toString('utf8')
    if (!payload.startsWith(PREFIX) || !sameString(given, mac(payload))) return false
    const issuedAt = Number(payload.slice(PREFIX.length))
    if (!Number.isFinite(issuedAt) || issuedAt > nowMs) return false
    return nowMs - issuedAt < INVESTOR_MAX_AGE_MS
  } catch {
    return false
  }
}

/** Fails closed: unset means nobody gets in, including with an empty submission. */
export function checkInvestorPassword(supplied: string | undefined): boolean {
  const expected = process.env.INVESTOR_PASSWORD
  if (!expected || !supplied) return false
  return sameString(supplied, expected)
}
