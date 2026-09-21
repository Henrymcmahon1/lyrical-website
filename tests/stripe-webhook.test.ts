import { beforeEach, describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'
import { handleStripeEvent, periodOf, tierFromLookupKey, type WebhookDeps } from '@/lib/stripe-webhook'

const sub = {
  id: 'sub_1',
  customer: 'cus_1',
  status: 'active',
  items: {
    data: [
      {
        current_period_start: 1758000000,
        current_period_end: 1760592000,
        price: { lookup_key: 'fan_founding' },
      },
    ],
  },
} as unknown as Stripe.Subscription
const period = {
  current_period_start: '2025-09-16T05:20:00.000Z',
  current_period_end: '2025-10-16T05:20:00.000Z',
}
const deps: WebhookDeps = {
  addCredit: vi.fn(),
  upsertSubscription: vi.fn(),
  updateSubscriptionByStripeId: vi.fn(),
  retrieveSubscription: vi.fn().mockResolvedValue(sub),
}
const ev = (type: string, object: unknown) =>
  ({ id: 'evt_1', type, data: { object } }) as unknown as Stripe.Event

beforeEach(() => vi.clearAllMocks())

describe('helpers', () => {
  it('maps lookup_key prefixes to tiers and rejects strangers', () => {
    expect(tierFromLookupKey('superfan_standard')).toBe('superfan')
    expect(tierFromLookupKey('fan_founding')).toBe('fan')
    expect(() => tierFromLookupKey('pro_founding')).toThrow('unknown lookup_key')
    expect(() => tierFromLookupKey('single_founding')).toThrow('unknown lookup_key')
    expect(() => tierFromLookupKey(null)).toThrow('unknown lookup_key')
  })

  it('reads the period from the first item as ISO strings', () => {
    expect(periodOf(sub)).toEqual(period)
  })

  it('a subscription with no items yields null stamps, never a throw', () => {
    expect(periodOf({ ...sub, items: { data: [] } } as unknown as Stripe.Subscription)).toEqual({
      current_period_start: null,
      current_period_end: null,
    })
  })
})

describe('handleStripeEvent', () => {
  it('checkout payment grants one credit keyed on the event id', async () => {
    const r = await handleStripeEvent(
      ev('checkout.session.completed', { mode: 'payment', metadata: { user_id: 'u1', plan: 'single' } }),
      deps,
    )
    expect(deps.addCredit).toHaveBeenCalledWith({ userId: 'u1', reason: 'purchase_single', stripeEventId: 'evt_1' })
    expect(deps.upsertSubscription).not.toHaveBeenCalled()
    expect(r).toEqual({ handled: true })
  })

  it('checkout subscription upserts the row from the retrieved subscription', async () => {
    await handleStripeEvent(
      ev('checkout.session.completed', {
        mode: 'subscription',
        subscription: 'sub_1',
        customer: 'cus_1',
        metadata: { user_id: 'u1', plan: 'fan' },
      }),
      deps,
    )
    expect(deps.retrieveSubscription).toHaveBeenCalledWith('sub_1')
    expect(deps.upsertSubscription).toHaveBeenCalledWith({
      user_id: 'u1',
      stripe_customer_id: 'cus_1',
      stripe_subscription_id: 'sub_1',
      tier: 'fan',
      status: 'active',
      ...period,
    })
    expect(deps.addCredit).not.toHaveBeenCalled()
  })

  it('checkout subscription accepts expanded object references', async () => {
    await handleStripeEvent(
      ev('checkout.session.completed', {
        mode: 'subscription',
        subscription: { id: 'sub_1' },
        customer: { id: 'cus_1' },
        metadata: { user_id: 'u1', plan: 'fan' },
      }),
      deps,
    )
    expect(deps.upsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1' }),
    )
  })

  it('checkout without a user_id throws, never a silent skip', async () => {
    await expect(
      handleStripeEvent(ev('checkout.session.completed', { mode: 'payment', metadata: {} }), deps),
    ).rejects.toThrow('user_id')
    expect(deps.addCredit).not.toHaveBeenCalled()
  })

  it('subscription-mode checkout without a subscription id throws', async () => {
    await expect(
      handleStripeEvent(
        ev('checkout.session.completed', { mode: 'subscription', subscription: null, metadata: { user_id: 'u1' } }),
        deps,
      ),
    ).rejects.toThrow('subscription id')
  })

  it('subscription updated and deleted patch status, tier and period', async () => {
    await handleStripeEvent(ev('customer.subscription.deleted', { ...sub, status: 'canceled' }), deps)
    expect(deps.updateSubscriptionByStripeId).toHaveBeenCalledWith('sub_1', { status: 'canceled', tier: 'fan', ...period })
    await handleStripeEvent(ev('customer.subscription.updated', { ...sub, status: 'past_due' }), deps)
    expect(deps.updateSubscriptionByStripeId).toHaveBeenCalledWith('sub_1', { status: 'past_due', tier: 'fan', ...period })
  })

  it('invoice.paid refreshes the period; a one-off invoice and unknown types are ignored', async () => {
    await handleStripeEvent(ev('invoice.paid', { parent: { subscription_details: { subscription: 'sub_1' } } }), deps)
    expect(deps.updateSubscriptionByStripeId).toHaveBeenCalledWith('sub_1', { status: 'active', ...period })
    expect(await handleStripeEvent(ev('invoice.paid', { parent: null }), deps)).toEqual({ handled: false })
    expect(await handleStripeEvent(ev('charge.refunded', {}), deps)).toEqual({ handled: false })
    expect(deps.updateSubscriptionByStripeId).toHaveBeenCalledTimes(1)
  })
})
