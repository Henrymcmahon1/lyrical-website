import { describe, it, expect, beforeEach } from 'vitest'
import { toRow, tierFromPriceId } from '@/lib/subscription-sync'

beforeEach(() => {
  delete process.env.STRIPE_PRICE_STARTER
  delete process.env.STRIPE_PRICE_CREATOR
  delete process.env.STRIPE_PRICE_PRO
})

describe('subscription sync mapping', () => {
  it('maps a price id back to its tier via env', () => {
    process.env.STRIPE_PRICE_CREATOR = 'price_creator'
    expect(tierFromPriceId('price_creator')).toBe('creator')
    expect(tierFromPriceId('price_unknown')).toBeNull()
    expect(tierFromPriceId(undefined)).toBeNull()
  })

  it('converts unix period seconds to ISO and carries the ids', () => {
    const row = toRow({
      userId: 'u1',
      customerId: 'cus_1',
      subscriptionId: 'sub_1',
      status: 'active',
      tier: 'starter',
      periodStart: 1756684800,
      periodEnd: 1759276800,
    })
    expect(row).toMatchObject({
      user_id: 'u1',
      stripe_customer_id: 'cus_1',
      stripe_subscription_id: 'sub_1',
      status: 'active',
      tier: 'starter',
    })
    expect(typeof row.current_period_start).toBe('string')
    expect(String(row.current_period_start)).toMatch(/T.*Z$/)
    expect(row.updated_at).toBeTruthy()
  })

  it('leaves periods null when Stripe omits them', () => {
    const row = toRow({
      userId: 'u1',
      customerId: 'c',
      subscriptionId: 's',
      status: 'incomplete',
      tier: null,
      periodStart: null,
      periodEnd: null,
    })
    expect(row.current_period_start).toBeNull()
    expect(row.current_period_end).toBeNull()
  })
})
