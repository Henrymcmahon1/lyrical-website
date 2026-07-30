import { createHmac, timingSafeEqual } from 'node:crypto'

export const GATE_COOKIE = 'lyr_unlocked'

function secret(): string {
  const s = process.env.GATE_SECRET
  if (!s) throw new Error('GATE_SECRET must be set — generate with: openssl rand -hex 32')
  return s
}

/** Sign the visitor's email into an opaque, tamper-evident token. */
export function signGate(email: string): string {
  const mac = createHmac('sha256', secret()).update(email).digest('hex')
  return `${Buffer.from(email).toString('base64url')}.${mac}`
}

/** Verify a gate token. Returns false for anything malformed, expired-looking or forged. */
export function verifyGate(token: string | undefined): boolean {
  if (!token) return false
  const [b64, mac] = token.split('.')
  if (!b64 || !mac) return false
  try {
    const email = Buffer.from(b64, 'base64url').toString('utf8')
    const expected = createHmac('sha256', secret()).update(email).digest('hex')
    const a = Buffer.from(mac, 'utf8')
    const b = Buffer.from(expected, 'utf8')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/**
 * Verify without throwing when GATE_SECRET is missing — used by page components so a
 * misconfigured environment renders a gated page rather than a 500.
 */
export function verifyGateSafe(token: string | undefined): boolean {
  try {
    return verifyGate(token)
  } catch {
    return false
  }
}
