import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { INVESTOR_MAX_AGE_MS, checkInvestorPassword, signInvestorSession, verifyInvestorSession } from '@/lib/investor-auth'
import { signDemoSession, verifyDemoSession } from '@/lib/demo-auth'
import { signAdminSession, verifyAdminSession } from '@/lib/admin-auth'

const NOW = 1_800_000_000_000
beforeEach(() => {
  process.env.GATE_SECRET = 'a'.repeat(64)
  process.env.INVESTOR_PASSWORD = 'a password for investors'
  process.env.DEMO_PASSWORD = 'a different listening password'
})
afterEach(() => { delete process.env.INVESTOR_PASSWORD; delete process.env.DEMO_PASSWORD })

describe('the /investors session token', () => {
  it('verifies what it signed, for four hours', () => {
    const t = signInvestorSession(NOW)
    expect(verifyInvestorSession(t, NOW + INVESTOR_MAX_AGE_MS - 1000)).toBe(true)
    expect(verifyInvestorSession(t, NOW + INVESTOR_MAX_AGE_MS + 1)).toBe(false)
    expect(INVESTOR_MAX_AGE_MS).toBe(4 * 60 * 60 * 1000)
  })
  it('rejects the future, tampering and nonsense', () => {
    expect(verifyInvestorSession(signInvestorSession(NOW + 60_000), NOW)).toBe(false)
    const [p] = signInvestorSession(NOW).split('.')
    expect(verifyInvestorSession(`${p}.${'0'.repeat(64)}`, NOW)).toBe(false)
    expect(verifyInvestorSession(undefined, NOW)).toBe(false)
    expect(verifyInvestorSession('not-a-token', NOW)).toBe(false)
  })
})

describe('namespaces reject each other', () => {
  it('an INVESTOR token opens neither /listen nor /leads', () => {
    expect(verifyDemoSession(signInvestorSession(NOW), NOW)).toBe(false)
    expect(verifyAdminSession(signInvestorSession(NOW), NOW)).toBe(false)
  })
  it('a LISTEN or ADMIN token does not open /investors', () => {
    expect(verifyInvestorSession(signDemoSession(NOW), NOW)).toBe(false)
    expect(verifyInvestorSession(signAdminSession(NOW), NOW)).toBe(false)
  })
})

describe('the /investors password', () => {
  it('accepts its own, rejects the listen password, fails closed when unset', () => {
    expect(checkInvestorPassword('a password for investors')).toBe(true)
    expect(checkInvestorPassword(process.env.DEMO_PASSWORD)).toBe(false)
    delete process.env.INVESTOR_PASSWORD
    expect(checkInvestorPassword('')).toBe(false)
    expect(checkInvestorPassword('a password for investors')).toBe(false)
  })
})
