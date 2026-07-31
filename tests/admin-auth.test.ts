import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  ADMIN_MAX_AGE_MS,
  checkAdminPassword,
  signAdminSession,
  verifyAdminSession,
} from '@/lib/admin-auth'
import { signGate } from '@/lib/gate'

const SECRET = 'a'.repeat(64)
const NOW = 1_800_000_000_000

beforeEach(() => {
  process.env.GATE_SECRET = SECRET
  process.env.ADMIN_PASSWORD = 'correct horse battery staple'
})

afterEach(() => {
  delete process.env.ADMIN_PASSWORD
})

describe('the admin session token', () => {
  it('verifies a token it just signed', () => {
    expect(verifyAdminSession(signAdminSession(NOW), NOW)).toBe(true)
  })

  it('still verifies just inside the expiry window', () => {
    const token = signAdminSession(NOW)
    expect(verifyAdminSession(token, NOW + ADMIN_MAX_AGE_MS - 1000)).toBe(true)
  })

  it('rejects a token past the expiry window', () => {
    const token = signAdminSession(NOW)
    expect(verifyAdminSession(token, NOW + ADMIN_MAX_AGE_MS + 1000)).toBe(false)
  })

  it('rejects a token issued in the future, which means a forged timestamp', () => {
    const token = signAdminSession(NOW + 60_000)
    expect(verifyAdminSession(token, NOW)).toBe(false)
  })

  it('rejects a tampered signature', () => {
    const token = signAdminSession(NOW)
    const [payload, mac] = token.split('.')
    const flipped = mac.slice(0, -1) + (mac.at(-1) === 'a' ? 'b' : 'a')
    expect(verifyAdminSession(`${payload}.${flipped}`, NOW)).toBe(false)
  })

  it('rejects a tampered payload', () => {
    const token = signAdminSession(NOW)
    const [, mac] = token.split('.')
    expect(verifyAdminSession(`${Buffer.from('admin:1').toString('base64url')}.${mac}`, NOW)).toBe(
      false,
    )
  })

  it('rejects rubbish without throwing', () => {
    for (const bad of ['', 'x', 'a.b', '...', 'not-base64.deadbeef']) {
      expect(verifyAdminSession(bad, NOW)).toBe(false)
    }
    expect(verifyAdminSession(undefined, NOW)).toBe(false)
  })

  it('will NOT accept a visitor gate token as an admin session', () => {
    // Both are HMACed with GATE_SECRET. If the payloads were not namespaced, anybody who
    // asked for audio examples would hold a token that opened the leads page.
    const visitorToken = signGate('someone@example.com')
    expect(verifyAdminSession(visitorToken, NOW)).toBe(false)
  })

  it('fails closed when GATE_SECRET is missing rather than throwing', () => {
    delete process.env.GATE_SECRET
    expect(verifyAdminSession('anything.at-all', NOW)).toBe(false)
    process.env.GATE_SECRET = SECRET
  })
})

describe('the admin password check', () => {
  it('accepts the configured password', () => {
    expect(checkAdminPassword('correct horse battery staple')).toBe(true)
  })

  it('rejects a wrong password of the same length', () => {
    expect(checkAdminPassword('correct horse battery stapl3')).toBe(false)
  })

  it('rejects a wrong password of a different length, without throwing', () => {
    // timingSafeEqual throws on unequal lengths, so this has to be handled explicitly.
    expect(checkAdminPassword('short')).toBe(false)
    expect(checkAdminPassword('a'.repeat(500))).toBe(false)
  })

  it('rejects an empty submission', () => {
    expect(checkAdminPassword('')).toBe(false)
    expect(checkAdminPassword(undefined)).toBe(false)
  })

  it('FAILS CLOSED when ADMIN_PASSWORD is not configured', () => {
    // The dangerous bug would be an unconfigured deploy letting everybody in. An empty
    // password must never match an empty submission either.
    delete process.env.ADMIN_PASSWORD
    expect(checkAdminPassword('')).toBe(false)
    expect(checkAdminPassword('anything')).toBe(false)
    expect(checkAdminPassword(undefined)).toBe(false)
  })
})
