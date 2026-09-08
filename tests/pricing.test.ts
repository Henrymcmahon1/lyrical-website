import { describe, it, expect } from 'vitest'
import { TIERS, tierById, priceIdFor } from '@/lib/pricing'

describe('pricing config', () => {
  it('has the three locked tiers with the agreed numbers', () => {
    expect(TIERS.map((t) => [t.id, t.priceUsd, t.covers])).toEqual([
      ['starter', 29, 3],
      ['creator', 79, 12],
      ['pro', 199, 40],
    ])
  })

  it('looks a tier up by id', () => {
    expect(tierById('creator')?.covers).toBe(12)
    expect(tierById('nope')).toBeUndefined()
  })

  it('reads the price id from the tier env var, undefined when unset', () => {
    delete process.env.STRIPE_PRICE_STARTER
    expect(priceIdFor(TIERS[0])).toBeUndefined()
    process.env.STRIPE_PRICE_STARTER = 'price_123'
    expect(priceIdFor(TIERS[0])).toBe('price_123')
    delete process.env.STRIPE_PRICE_STARTER
  })

  it('uses no em dashes in any copy', () => {
    const copy = TIERS.map((t) => `${t.name} ${t.priceDisplay} ${t.blurb}`).join(' ')
    expect(copy).not.toContain('—')
  })
})
