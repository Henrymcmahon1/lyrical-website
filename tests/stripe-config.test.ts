import { describe, it, expect, beforeEach } from 'vitest'
import { stripeConfigured, getStripe } from '@/lib/stripe'

beforeEach(() => {
  delete process.env.STRIPE_SECRET_KEY
})

describe('stripe client', () => {
  it('reports not configured with no key', () => {
    expect(stripeConfigured()).toBe(false)
  })

  it('throws loudly when asked for a client with no key', () => {
    expect(() => getStripe()).toThrow(/STRIPE_SECRET_KEY/)
  })

  it('is configured and constructs a client with a key', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_x'
    expect(stripeConfigured()).toBe(true)
    expect(getStripe()).toBeTruthy()
  })
})
