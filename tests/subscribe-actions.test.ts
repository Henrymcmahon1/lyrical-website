import { describe, it, expect, vi, beforeEach } from 'vitest'

const currentUser = vi.fn()
vi.mock('@/lib/supabase-server', () => ({
  currentUser: () => currentUser(),
}))

const maybeSingle = vi.fn()
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => maybeSingle() }) }),
    }),
  }),
}))

const createCheckout = vi.fn()
const createPortal = vi.fn()
vi.mock('@/lib/stripe', () => ({
  stripeConfigured: () => Boolean(process.env.STRIPE_SECRET_KEY),
  getStripe: () => ({
    checkout: { sessions: { create: (...a: unknown[]) => createCheckout(...a) } },
    billingPortal: { sessions: { create: (...a: unknown[]) => createPortal(...a) } },
  }),
}))

const { startCheckout, openBillingPortal } = await import('@/app/pricing/subscribe-actions')

beforeEach(() => {
  currentUser.mockReset()
  maybeSingle.mockReset()
  createCheckout.mockReset()
  createPortal.mockReset()
  process.env.STRIPE_SECRET_KEY = 'sk_test_x'
  process.env.STRIPE_PRICE_STARTER = 'price_starter'
  process.env.NEXT_PUBLIC_SITE_URL = 'https://lyricalglobal.com'
})

describe('startCheckout', () => {
  it('refuses when signed out', async () => {
    currentUser.mockResolvedValue(null)
    expect(await startCheckout('starter')).toMatchObject({ ok: false })
  })

  it('refuses an unknown tier', async () => {
    currentUser.mockResolvedValue({ id: 'u1', email: 'a@b.co' })
    expect(await startCheckout('nope')).toMatchObject({ ok: false })
  })

  it('refuses when Stripe is not configured', async () => {
    delete process.env.STRIPE_SECRET_KEY
    currentUser.mockResolvedValue({ id: 'u1', email: 'a@b.co' })
    expect(await startCheckout('starter')).toMatchObject({ ok: false })
  })

  it('creates a subscription checkout carrying user_id and returns its url', async () => {
    currentUser.mockResolvedValue({ id: 'u1', email: 'a@b.co' })
    createCheckout.mockResolvedValue({ url: 'https://checkout.stripe/x' })
    const res = await startCheckout('starter')
    expect(res).toEqual({ ok: true, url: 'https://checkout.stripe/x' })
    const arg = createCheckout.mock.calls[0][0] as Record<string, unknown>
    expect(arg.mode).toBe('subscription')
    expect((arg.line_items as Array<{ price: string }>)[0].price).toBe('price_starter')
    expect((arg.metadata as { user_id: string }).user_id).toBe('u1')
    expect((arg.subscription_data as { metadata: { user_id: string } }).metadata.user_id).toBe('u1')
  })
})

describe('openBillingPortal', () => {
  it('refuses when there is no customer', async () => {
    currentUser.mockResolvedValue({ id: 'u1', email: 'a@b.co' })
    maybeSingle.mockResolvedValue({ data: null })
    expect(await openBillingPortal()).toMatchObject({ ok: false })
  })

  it('returns a portal url for a customer', async () => {
    currentUser.mockResolvedValue({ id: 'u1', email: 'a@b.co' })
    maybeSingle.mockResolvedValue({ data: { stripe_customer_id: 'cus_1' } })
    createPortal.mockResolvedValue({ url: 'https://portal.stripe/x' })
    expect(await openBillingPortal()).toEqual({ ok: true, url: 'https://portal.stripe/x' })
  })
})
