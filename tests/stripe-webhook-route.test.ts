import { beforeEach, describe, expect, it, vi } from 'vitest'

const constructEvent = vi.fn()
const retrieve = vi.fn()
vi.mock('@/lib/stripe', () => ({
  stripe: () => ({ webhooks: { constructEvent }, subscriptions: { retrieve } }),
}))
const handle = vi.fn().mockResolvedValue({ handled: true })
vi.mock('@/lib/stripe-webhook', () => ({ handleStripeEvent: (...a: unknown[]) => handle(...a) }))
const insert = vi.fn()
const updateEq = vi.fn().mockResolvedValue({ error: null })
const update = vi.fn(() => ({ eq: updateEq }))
const upsert = vi.fn().mockResolvedValue({ error: null })
const deleteEq = vi.fn().mockResolvedValue({ error: null })
const del = vi.fn(() => ({ eq: deleteEq }))
const from = vi.fn(() => ({ insert, update, upsert, delete: del }))
vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: () => ({ from }) }))
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
const { POST } = await import('@/app/api/stripe/webhook/route')

const req = () =>
  new Request('http://localhost/api/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': 't=1,v1=abc' },
    body: '{"raw":true}',
  })
const event = { id: 'evt_1', type: 'invoice.paid', data: { object: {} } }

beforeEach(() => {
  vi.clearAllMocks()
  insert.mockResolvedValue({ error: null })
  updateEq.mockResolvedValue({ error: null })
  upsert.mockResolvedValue({ error: null })
  handle.mockResolvedValue({ handled: true })
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
})

describe('POST /api/stripe/webhook', () => {
  it('500 with a named error when the webhook secret is missing', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET
    const res = await POST(req())
    expect(res.status).toBe(500)
    expect(await res.text()).toContain('STRIPE_WEBHOOK_SECRET')
    expect(constructEvent).not.toHaveBeenCalled()
  })

  it('400 on a bad signature and never touches the database', async () => {
    constructEvent.mockImplementationOnce(() => {
      throw new Error('bad sig')
    })
    expect((await POST(req())).status).toBe(400)
    expect(constructEvent).toHaveBeenCalledWith('{"raw":true}', 't=1,v1=abc', 'whsec_test')
    expect(insert).not.toHaveBeenCalled()
  })

  it('claims the event, handles it, stamps processed_at', async () => {
    constructEvent.mockReturnValue(event)
    expect((await POST(req())).status).toBe(200)
    expect(from).toHaveBeenCalledWith('stripe_events')
    expect(insert).toHaveBeenCalledWith({ id: 'evt_1', type: 'invoice.paid' })
    expect(handle).toHaveBeenCalledOnce()
    expect(handle.mock.calls[0][0]).toBe(event)
    expect(update).toHaveBeenCalledWith({ processed_at: expect.any(String) })
    expect(updateEq).toHaveBeenCalledWith('id', 'evt_1')
  })

  it('a replayed event id is 200 and skips the handler; a handler failure is 500 so Stripe retries', async () => {
    constructEvent.mockReturnValue(event)
    insert.mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate' } })
    expect((await POST(req())).status).toBe(200)
    expect(handle).not.toHaveBeenCalled()
    handle.mockRejectedValueOnce(new Error('db down'))
    expect((await POST(req())).status).toBe(500)
    expect(update).not.toHaveBeenCalled()
    // The claim is released, so Stripe's retry runs the handler again instead of reading
    // "already processed" and dropping the event for good.
    expect(del).toHaveBeenCalledOnce()
    expect(deleteEq).toHaveBeenCalledWith('id', 'evt_1')
  })

  it('a claim error other than a duplicate is 500', async () => {
    constructEvent.mockReturnValue(event)
    insert.mockResolvedValueOnce({ error: { code: '42P01', message: 'relation missing' } })
    expect((await POST(req())).status).toBe(500)
    expect(handle).not.toHaveBeenCalled()
  })

  it('wires deps: upsert on user_id, update by stripe id, both throwing on db errors', async () => {
    constructEvent.mockReturnValue(event)
    await POST(req())
    const deps = handle.mock.calls[0][1] as {
      upsertSubscription: (row: unknown) => Promise<void>
      updateSubscriptionByStripeId: (id: string, patch: unknown) => Promise<void>
      retrieveSubscription: (id: string) => Promise<unknown>
    }
    await deps.upsertSubscription({ user_id: 'u1' })
    expect(upsert).toHaveBeenCalledWith({ user_id: 'u1' }, { onConflict: 'user_id' })
    await deps.updateSubscriptionByStripeId('sub_1', { status: 'active' })
    expect(update).toHaveBeenCalledWith({ status: 'active' })
    expect(updateEq).toHaveBeenCalledWith('stripe_subscription_id', 'sub_1')
    retrieve.mockResolvedValueOnce({ id: 'sub_1' })
    expect(await deps.retrieveSubscription('sub_1')).toEqual({ id: 'sub_1' })
    upsert.mockResolvedValueOnce({ error: { message: 'upsert broke' } })
    await expect(deps.upsertSubscription({})).rejects.toThrow('upsert broke')
    updateEq.mockResolvedValueOnce({ error: { message: 'update broke' } })
    await expect(deps.updateSubscriptionByStripeId('sub_1', {})).rejects.toThrow('update broke')
  })
})
