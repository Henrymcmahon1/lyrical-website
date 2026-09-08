import { describe, it, expect, vi, beforeEach } from 'vitest'

const constructEvent = vi.fn()
const retrieveSub = vi.fn()
vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({
    webhooks: { constructEvent: (...a: unknown[]) => constructEvent(...a) },
    subscriptions: { retrieve: (...a: unknown[]) => retrieveSub(...a) },
  }),
  stripeConfigured: () => true,
}))

const upsertSubscription = vi.fn()
vi.mock('@/lib/subscription-sync', async (orig) => ({
  ...(await orig<typeof import('@/lib/subscription-sync')>()),
  upsertSubscription: (...a: unknown[]) => upsertSubscription(...a),
}))

const { POST } = await import('@/app/api/stripe-webhook/route')

function req(body: string, sig: string | null = 'good') {
  return new Request('http://x/api/stripe-webhook', {
    method: 'POST',
    headers: sig ? { 'stripe-signature': sig } : {},
    body,
  })
}

beforeEach(() => {
  constructEvent.mockReset()
  retrieveSub.mockReset()
  upsertSubscription.mockReset()
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_x'
  process.env.STRIPE_PRICE_STARTER = 'price_starter'
})

describe('POST /api/stripe-webhook', () => {
  it('400s a bad signature and writes nothing', async () => {
    constructEvent.mockImplementation(() => {
      throw new Error('bad sig')
    })
    const res = await POST(req('{}', 'bad'))
    expect(res.status).toBe(400)
    expect(upsertSubscription).not.toHaveBeenCalled()
  })

  it('upserts on customer.subscription.updated using metadata user_id', async () => {
    constructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_1',
          customer: 'cus_1',
          status: 'active',
          metadata: { user_id: 'u1' },
          current_period_start: 1756684800,
          current_period_end: 1759276800,
          items: { data: [{ price: { id: 'price_starter' } }] },
        },
      },
    })
    const res = await POST(req('{}'))
    expect(res.status).toBe(200)
    expect(upsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        tier: 'starter',
        status: 'active',
        subscriptionId: 'sub_1',
      }),
    )
  })

  it('marks canceled on customer.subscription.deleted', async () => {
    constructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_1',
          customer: 'cus_1',
          status: 'canceled',
          metadata: { user_id: 'u1' },
          current_period_start: 1756684800,
          current_period_end: 1759276800,
          items: { data: [{ price: { id: 'price_starter' } }] },
        },
      },
    })
    const res = await POST(req('{}'))
    expect(res.status).toBe(200)
    expect(upsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'canceled', userId: 'u1' }),
    )
  })

  it('ignores an event type it does not handle', async () => {
    constructEvent.mockReturnValue({ type: 'invoice.paid', data: { object: {} } })
    const res = await POST(req('{}'))
    expect(res.status).toBe(200)
    expect(upsertSubscription).not.toHaveBeenCalled()
  })
})
