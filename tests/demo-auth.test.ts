import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  DEMO_MAX_AGE_MS,
  checkDemoPassword,
  signDemoSession,
  verifyDemoSession,
} from '@/lib/demo-auth'
import { ADMIN_MAX_AGE_MS, signAdminSession, verifyAdminSession } from '@/lib/admin-auth'
import { createHmac } from 'node:crypto'

const SECRET = 'a'.repeat(64)
const NOW = 1_800_000_000_000

beforeEach(() => {
  process.env.GATE_SECRET = SECRET
  process.env.DEMO_PASSWORD = 'a memorable listening password'
  process.env.ADMIN_PASSWORD = 'a completely different admin password'
})

afterEach(() => {
  delete process.env.DEMO_PASSWORD
  delete process.env.ADMIN_PASSWORD
})

describe('the /listen session token', () => {
  it('verifies a token it just signed', () => {
    expect(verifyDemoSession(signDemoSession(NOW), NOW)).toBe(true)
  })

  it('still verifies just inside the expiry window', () => {
    expect(verifyDemoSession(signDemoSession(NOW), NOW + DEMO_MAX_AGE_MS - 1000)).toBe(true)
  })

  it('expires, and sooner than an admin session', () => {
    const token = signDemoSession(NOW)
    expect(verifyDemoSession(token, NOW + DEMO_MAX_AGE_MS + 1)).toBe(false)
    // The point of the shorter window: this password goes to people outside the company,
    // sometimes on a device that is not theirs.
    expect(DEMO_MAX_AGE_MS).toBeLessThan(ADMIN_MAX_AGE_MS)
  })

  it('rejects a token dated in the future', () => {
    expect(verifyDemoSession(signDemoSession(NOW + 60_000), NOW)).toBe(false)
  })

  it('rejects a tampered signature', () => {
    const [payload] = signDemoSession(NOW).split('.')
    expect(verifyDemoSession(`${payload}.${'0'.repeat(64)}`, NOW)).toBe(false)
  })

  it('rejects nonsense rather than throwing', () => {
    expect(verifyDemoSession(undefined, NOW)).toBe(false)
    expect(verifyDemoSession('', NOW)).toBe(false)
    expect(verifyDemoSession('not-a-token', NOW)).toBe(false)
  })
})

/**
 * GATE_SECRET signs the admin session and the listening session, and it used to sign a third
 * thing, the visitor examples cookie, which was removed on 2026-08-11. All of them are HMACs of
 * arbitrary text under one key, so without a namespace prefix any one would be valid for the
 * others.
 *
 * This is the part that actually matters. The listening password is handed to people outside
 * the company, and it is deliberately memorable so it can be read out on a call. If that
 * token opened /leads, every prospect sent a demo link would hold the keys to the enquiry
 * inbox and to every other enquirer's contact details.
 */
describe('the three session types cannot be swapped for one another', () => {
  it('an ADMIN token does not open /listen', () => {
    expect(verifyDemoSession(signAdminSession(NOW), NOW)).toBe(false)
  })

  it('a LISTEN token does not open /leads', () => {
    expect(verifyAdminSession(signDemoSession(NOW), NOW)).toBe(false)
  })

  it('an UNNAMESPACED token opens neither', () => {
    // The general form of the threat, and the reason the prefixes exist. Kept after the
    // examples cookie was deleted, because the next thing signed with this key will be minted
    // by somebody who has not read this file.
    const raw = unnamespacedToken('stranger@example.com')
    expect(verifyDemoSession(raw, NOW)).toBe(false)
    expect(verifyAdminSession(raw, NOW)).toBe(false)
  })
})

describe('the /listen password', () => {
  it('accepts the configured password', () => {
    expect(checkDemoPassword('a memorable listening password')).toBe(true)
  })

  it('rejects the wrong one', () => {
    expect(checkDemoPassword('nearly the right password')).toBe(false)
  })

  it('is not the admin password', () => {
    expect(checkDemoPassword(process.env.ADMIN_PASSWORD)).toBe(false)
  })

  it('FAILS CLOSED when DEMO_PASSWORD is unset', () => {
    delete process.env.DEMO_PASSWORD
    // Including the empty submission, which is the dangerous case: an unconfigured
    // deployment must refuse everybody rather than publish the recordings to anyone who
    // finds the URL.
    expect(checkDemoPassword('')).toBe(false)
    expect(checkDemoPassword(undefined)).toBe(false)
    expect(checkDemoPassword('anything at all')).toBe(false)
  })
})

/**
 * An unnamespaced token, signed with the same GATE_SECRET.
 *
 * This used to be `signGate` from `lib/gate.ts`, the visitor "asked for examples" cookie. That
 * module was deleted on 2026-08-11 when the examples flow was removed, and the property it let
 * us test did NOT go with it: GATE_SECRET still signs more than one thing, and every one of
 * them is an HMAC of arbitrary text under one key. Without a namespace prefix, any token is a
 * valid token for any of them.
 *
 * Minted here rather than imported, so the guard keeps being exercised by the shape of the
 * threat rather than by whichever feature happened to produce it last.
 */
function unnamespacedToken(payload: string): string {
  const mac = createHmac('sha256', SECRET).update(payload).digest('hex')
  return `${Buffer.from(payload).toString('base64url')}.${mac}`
}
