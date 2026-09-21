import { describe, expect, it } from 'vitest'
import { PLANS, PLAN_IDS, REROLLS_PER_TRACK, SUBSCRIPTION_PLANS, planById, priceFor } from '@/lib/plans'

/**
 * The numbers Henry locked on 21 Sep 2026. A change here is a business decision, not a
 * refactor, so the test names them one by one.
 */
describe('plans', () => {
  it('has the three founding plans with the locked numbers', () => {
    expect(PLANS.single).toMatchObject({ kind: 'one_off', tracks: 1, foundingUsd: 9, standardUsd: 12 })
    expect(PLANS.fan).toMatchObject({ kind: 'subscription', tracks: 5, foundingUsd: 19, standardUsd: 29 })
    expect(PLANS.superfan).toMatchObject({ kind: 'subscription', tracks: 15, foundingUsd: 39, standardUsd: 59 })
    expect(REROLLS_PER_TRACK).toBe(2)
  })

  it('charges the founding price while the beta is on', () => {
    expect(priceFor('single')).toBe(9)
    expect(priceFor('fan')).toBe(19)
    expect(priceFor('superfan')).toBe(39)
  })

  it('rejects unknown and old ids', () => {
    expect(planById('pro')).toBeNull()
    expect(planById('starter')).toBeNull()
    expect(planById(null)).toBeNull()
    expect(planById('toString')).toBeNull()
    expect(planById('fan')?.name).toBe('Plus')
    expect(planById('superfan')?.name).toBe('Pro')
  })

  it('lists ids in display order and the subscriptions separately', () => {
    expect(PLAN_IDS).toEqual(['single', 'fan', 'superfan'])
    expect(SUBSCRIPTION_PLANS).toEqual(['fan', 'superfan'])
  })
})
