import { describe, it, expect } from 'vitest'
import { allowanceFor, isActive, computeQuota } from '@/lib/quota'

const base = {
  tier: 'starter',
  status: 'active',
  current_period_start: '2026-09-01T00:00:00Z',
  current_period_end: '2026-10-01T00:00:00Z',
  stripe_customer_id: 'cus_1',
}

describe('quota math', () => {
  it('maps tiers to allowances', () => {
    expect(allowanceFor('starter')).toBe(3)
    expect(allowanceFor('creator')).toBe(12)
    expect(allowanceFor('pro')).toBe(40)
    expect(allowanceFor(null)).toBe(0)
    expect(allowanceFor('bogus')).toBe(0)
  })

  it('treats active and trialing as active, nothing else', () => {
    expect(isActive('active')).toBe(true)
    expect(isActive('trialing')).toBe(true)
    expect(isActive('past_due')).toBe(false)
    expect(isActive('canceled')).toBe(false)
  })

  it('entitled when active and under allowance', () => {
    const q = computeQuota(base, 1)
    expect(q).toMatchObject({ entitled: true, allowance: 3, used: 1, remaining: 2, active: true })
  })

  it('blocks when quota is spent, even while active', () => {
    const q = computeQuota(base, 3)
    expect(q.remaining).toBe(0)
    expect(q.entitled).toBe(false)
  })

  it('blocks when there is no active subscription', () => {
    expect(computeQuota(null, 0).entitled).toBe(false)
    expect(computeQuota({ ...base, status: 'canceled' }, 0).entitled).toBe(false)
  })

  it('never reports negative remaining', () => {
    expect(computeQuota(base, 9).remaining).toBe(0)
  })
})
