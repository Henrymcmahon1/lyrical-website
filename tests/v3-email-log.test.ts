import { describe, expect, it, vi, beforeEach } from 'vitest'
import { alreadySent, logSend, productEmailAllowedToday, PRODUCT_EMAIL_SLUGS } from '@/lib/email-log'

/**
 * `email_log` is the idempotency and rate-limit ledger every send in this bot's scope checks
 * before it fires, and the record support reads afterwards. These tests drive it against a
 * stubbed Supabase client so the query shape is pinned without a real database.
 */

type Call = { method: string; args: unknown[] }

function fakeAdmin(result: { data?: unknown; error?: unknown; count?: number }) {
  const calls: Call[] = []
  const builder: Record<string, (...a: unknown[]) => unknown> = {}
  const record = (method: string) => {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args })
      return builder
    }
  }
  for (const m of ['select', 'eq', 'gte', 'in', 'insert']) record(m)
  // Chains end by being awaited: make the builder thenable.
  ;(builder as unknown as { then: unknown }).then = (
    resolve: (v: { data: unknown; error: unknown; count?: number }) => void,
  ) => resolve({ data: result.data ?? null, error: result.error ?? null, count: result.count })

  const from = vi.fn(() => builder)
  return { admin: { from } as never, calls }
}

describe('alreadySent', () => {
  it('is false when nothing matches', async () => {
    const { admin } = fakeAdmin({ count: 0 })
    const result = await alreadySent(admin, 'user-1', 'welcome')
    expect(result).toBe(false)
  })

  it('is true when a row matches', async () => {
    const { admin } = fakeAdmin({ count: 1 })
    const result = await alreadySent(admin, 'user-1', 'welcome')
    expect(result).toBe(true)
  })

  it('filters by user and slug', async () => {
    const { admin, calls } = fakeAdmin({ count: 0 })
    await alreadySent(admin, 'user-1', 'track-delivered')
    const eqCalls = calls.filter((c) => c.method === 'eq')
    expect(eqCalls).toContainEqual({ method: 'eq', args: ['user_id', 'user-1'] })
    expect(eqCalls).toContainEqual({ method: 'eq', args: ['slug', 'track-delivered'] })
  })

  it('adds a since-window filter only when asked for one', async () => {
    const { admin, calls } = fakeAdmin({ count: 0 })
    await alreadySent(admin, 'user-1', 'rating-reminder', 24 * 60 * 60 * 1000)
    expect(calls.some((c) => c.method === 'gte')).toBe(true)
  })

  it('fails loud on a database error rather than silently allowing a duplicate send', async () => {
    const { admin } = fakeAdmin({ error: { message: 'boom' } })
    await expect(alreadySent(admin, 'user-1', 'welcome')).rejects.toThrow(/boom/)
  })
})

describe('logSend', () => {
  it('inserts one row with the given fields', async () => {
    const { admin, calls } = fakeAdmin({ data: null })
    await logSend(admin, {
      userId: 'user-1',
      toEmail: 'artist@label.example',
      slug: 'track-delivered',
      jobId: 'job-1',
      providerId: 'resend-123',
    })
    const insert = calls.find((c) => c.method === 'insert')
    expect(insert?.args[0]).toMatchObject({
      user_id: 'user-1',
      to_email: 'artist@label.example',
      slug: 'track-delivered',
      job_id: 'job-1',
      provider_id: 'resend-123',
    })
  })

  it('accepts a null user id, for a send whose owner could not be resolved', async () => {
    const { admin, calls } = fakeAdmin({ data: null })
    await logSend(admin, {
      userId: null,
      toEmail: 'someone@example.com',
      slug: 'enquiry-received',
    })
    const insert = calls.find((c) => c.method === 'insert')
    expect(insert?.args[0]).toMatchObject({ user_id: null })
  })

  it('fails loud on a database error', async () => {
    const { admin } = fakeAdmin({ error: { message: 'nope' } })
    await expect(logSend(admin, { userId: 'u', toEmail: 'a@b.com', slug: 'welcome' })).rejects.toThrow(
      /nope/,
    )
  })
})

describe('productEmailAllowedToday', () => {
  it('is true when nothing was logged', async () => {
    const { admin } = fakeAdmin({ count: 0 })
    expect(await productEmailAllowedToday(admin, 'user-1')).toBe(true)
  })

  it('is false once a product email was logged in the last 24 hours', async () => {
    const { admin } = fakeAdmin({ count: 1 })
    expect(await productEmailAllowedToday(admin, 'user-1')).toBe(false)
  })

  it('only ever looks at the product-email slugs, never the transactional ones', async () => {
    // rating-reminder is the only product email in scope for v3; this pins the assumption so
    // adding a transactional slug to the wrong list fails a test rather than silently gating it.
    expect(PRODUCT_EMAIL_SLUGS).toEqual(['rating-reminder'])
  })

  it('scopes the check to the last 24 hours', async () => {
    const { admin, calls } = fakeAdmin({ count: 0 })
    await productEmailAllowedToday(admin, 'user-1')
    expect(calls.some((c) => c.method === 'gte')).toBe(true)
  })
})
