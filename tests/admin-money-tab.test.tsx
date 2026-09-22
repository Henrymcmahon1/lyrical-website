import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

/** The Money tab: subscriptions, the credits ledger (with a real running total), Stripe events. */

const listUsers = vi.fn()
const from = vi.fn()

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({
    auth: { admin: { listUsers: (...a: unknown[]) => listUsers(...a) } },
    from: (...a: unknown[]) => from(...a),
  }),
}))

const SUB = {
  id: 's1',
  user_id: 'u1',
  tier: 'fan',
  status: 'active',
  current_period_start: '2026-09-01T00:00:00Z',
  current_period_end: '2026-10-01T00:00:00Z',
}

// A mixed ledger: +1 purchase, -1 consume, +1 refund. Total must be +1, not a row count.
const CREDITS = [
  { id: 'c1', created_at: '2026-09-20T00:00:00Z', user_id: 'u1', delta: 1, reason: 'purchase_single', job_id: null },
  { id: 'c2', created_at: '2026-09-21T00:00:00Z', user_id: 'u1', delta: -1, reason: 'consume', job_id: 'j1' },
  { id: 'c3', created_at: '2026-09-22T00:00:00Z', user_id: 'u1', delta: 1, reason: 'refund', job_id: 'j1' },
]

const EVENT = { id: 'evt_1', type: 'checkout.session.completed', received_at: '2026-09-20T00:00:00Z', processed_at: '2026-09-20T00:00:01Z' }

function wire() {
  from.mockImplementation((table: string) => {
    if (table === 'subscriptions') return { select: () => ({ order: () => Promise.resolve({ data: [SUB], error: null }) }) }
    if (table === 'song_credits') return { select: () => ({ order: () => ({ limit: () => Promise.resolve({ data: CREDITS, error: null }) }) }) }
    if (table === 'stripe_events') return { select: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [EVENT], error: null }) }) }) }
    throw new Error(`unexpected table ${table}`)
  })
  listUsers.mockResolvedValue({ data: { users: [{ id: 'u1', email: 'a@label.example' }] } })
}

beforeEach(() => {
  vi.clearAllMocks()
  wire()
})

describe('MoneyTab', () => {
  it('totals the ledger correctly, not just counts rows', async () => {
    const { MoneyTab } = await import('@/app/admin/MoneyTab')
    const html = renderToStaticMarkup(await MoneyTab())
    // 1 - 1 + 1 = +1, the sum of deltas, not 3 (the row count).
    const match = html.match(/data-testid="ledger-total">([^<]*)</)
    expect(match?.[1]?.trim()).toBe('total +1')
  })

  it('flags refund rows', async () => {
    const { MoneyTab } = await import('@/app/admin/MoneyTab')
    const html = renderToStaticMarkup(await MoneyTab())
    expect(html).toContain('1 refund issued')
  })

  it('shows the subscription and the Stripe event', async () => {
    const { MoneyTab } = await import('@/app/admin/MoneyTab')
    const html = renderToStaticMarkup(await MoneyTab())
    expect(html).toContain('fan')
    expect(html).toContain('checkout.session.completed')
    expect(html).toContain('a@label.example')
  })
})
