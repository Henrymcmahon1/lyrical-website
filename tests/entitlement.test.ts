import { describe, expect, it } from 'vitest'
import { computeEntitlement, rerollsLeft } from '@/lib/entitlement'

const fan = {
  tier: 'fan',
  status: 'active',
  current_period_start: '2026-09-01T00:00:00Z',
  current_period_end: '2026-10-01T00:00:00Z',
}

describe('computeEntitlement', () => {
  it('no subscription and no credits fails closed', () => {
    expect(computeEntitlement(null, 0, 0)).toEqual({ ok: false, reason: 'no_plan' })
  })

  it('an active Fan with tracks left is entitled by subscription', () => {
    expect(computeEntitlement(fan, 2, 0)).toEqual({
      ok: true,
      source: 'subscription',
      plan: 'fan',
      tracksLeft: 3,
      renewsAt: fan.current_period_end,
    })
  })

  it('an exhausted period falls through to credits', () => {
    expect(computeEntitlement(fan, 5, 1)).toMatchObject({ ok: true, source: 'credit', tracksLeft: 1 })
  })

  it('an exhausted period with no credits says so', () => {
    expect(computeEntitlement(fan, 5, 0)).toEqual({ ok: false, reason: 'period_exhausted' })
  })

  it('an over-consumed period never goes negative into credits', () => {
    expect(computeEntitlement(fan, 9, 0)).toEqual({ ok: false, reason: 'period_exhausted' })
  })

  it('a cancelled subscription counts as none', () => {
    expect(computeEntitlement({ ...fan, status: 'canceled' }, 0, 0)).toEqual({ ok: false, reason: 'no_plan' })
  })

  it('a trialing subscription counts as active', () => {
    expect(computeEntitlement({ ...fan, status: 'trialing' }, 0, 0)).toMatchObject({ ok: true, source: 'subscription' })
  })

  it('an unknown or retired tier is not a plan', () => {
    expect(computeEntitlement({ ...fan, tier: 'pro' }, 0, 0)).toEqual({ ok: false, reason: 'no_plan' })
    expect(computeEntitlement({ ...fan, tier: 'single' }, 0, 0)).toEqual({ ok: false, reason: 'no_plan' })
  })

  it('credits alone entitle a single track', () => {
    expect(computeEntitlement(null, 0, 2)).toEqual({
      ok: true,
      source: 'credit',
      plan: 'single',
      tracksLeft: 2,
      renewsAt: null,
    })
  })

  it('Superfan allows fifteen', () => {
    expect(computeEntitlement({ ...fan, tier: 'superfan' }, 14, 0)).toMatchObject({ ok: true, tracksLeft: 1 })
    expect(computeEntitlement({ ...fan, tier: 'superfan' }, 15, 0)).toEqual({ ok: false, reason: 'period_exhausted' })
  })
})

describe('rerollsLeft', () => {
  it('counts down from two and never goes negative', () => {
    expect(rerollsLeft(0)).toBe(2)
    expect(rerollsLeft(1)).toBe(1)
    expect(rerollsLeft(2)).toBe(0)
    expect(rerollsLeft(5)).toBe(0)
  })
})
