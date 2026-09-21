import { describe, expect, it, vi } from 'vitest'
import { CATALOG, ensurePrice, stripQuotes } from '@/scripts/stripe-setup'

describe('stripe-setup', () => {
  it('lists the six locked lookup keys with cents from lib/plans', () => {
    expect(CATALOG.map((c) => c.lookupKey)).toEqual([
      'single_founding',
      'single_standard',
      'fan_founding',
      'fan_standard',
      'superfan_founding',
      'superfan_standard',
    ])
    expect(CATALOG[2]).toMatchObject({ unitAmount: 1900, recurring: true })
    expect(CATALOG[1]).toMatchObject({ unitAmount: 1200, recurring: false })
  })

  it('strips surrounding quotes from .env values', () => {
    expect(stripQuotes('"sk_test_abc"')).toBe('sk_test_abc')
    expect(stripQuotes("'sk_test_abc'")).toBe('sk_test_abc')
    expect(stripQuotes('sk_test_abc')).toBe('sk_test_abc')
    expect(stripQuotes('  sk_test_abc  ')).toBe('sk_test_abc')
  })

  it('reuses an existing price, else creates product then price', async () => {
    const fake = {
      prices: {
        list: vi
          .fn()
          .mockResolvedValueOnce({ data: [{ id: 'price_old' }] })
          .mockResolvedValueOnce({ data: [] }),
        create: vi.fn().mockResolvedValue({ id: 'price_new' }),
      },
      products: {
        search: vi.fn().mockResolvedValue({ data: [] }),
        create: vi.fn().mockResolvedValue({ id: 'prod_new' }),
      },
    }
    expect(await ensurePrice(fake as never, CATALOG[0])).toBe('price_old')
    expect(await ensurePrice(fake as never, CATALOG[2])).toBe('price_new')
    expect(fake.prices.create).toHaveBeenCalledWith(
      expect.objectContaining({
        product: 'prod_new',
        unit_amount: 1900,
        currency: 'usd',
        lookup_key: 'fan_founding',
        recurring: { interval: 'month' },
      }),
    )
  })
})
