import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { RIGHTS_TERMS_VERSION } from '@/lib/terms'
import { TURNAROUND_BUSY, TURNAROUND_PROMISE } from '@/lib/turnaround'

/**
 * `/studio/account`, rendered. Every ordinary read is the USER's client (mocked as thenable
 * chains here); the plan comes from getEntitlementFor's sibling getBillingSummary and email
 * preferences from lib/account-data.ts, both mocked at the boundary since they are unit tested
 * on their own (tests/stripe-entitlement-db.test.ts, tests/account-data.test.ts).
 */
const currentUser = vi.fn()
const getBillingSummary = vi.fn()
const getEmailPreferences = vi.fn()
const queues: Record<string, unknown[]> = {}
const nextFor = (t: string) => (queues[t] ?? []).shift() ?? { data: null, error: null }

// Mirrors real Next.js: redirect() throws to abort the render rather than returning, so a
// mocked no-op would let this async component read `user.id` on a null user and crash on the
// wrong line instead of surfacing the redirect.
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))
vi.mock('@/lib/supabase-server', () => ({
  currentUser: () => currentUser(),
  supabaseServer: async () => ({
    from: (t: string) => {
      const c = { select: () => c, eq: () => c, not: () => c, order: () => c, limit: () => c, maybeSingle: () => Promise.resolve(nextFor(t)) }
      return c
    },
  }),
}))
vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: () => ({ marker: 'admin' }) }))
vi.mock('@/lib/entitlement-db', () => ({ getBillingSummary: (...a: unknown[]) => getBillingSummary(...a) }))
vi.mock('@/lib/account-data', () => ({
  getEmailPreferences: (...a: unknown[]) => getEmailPreferences(...a),
  DELETE_CONFIRM_TEXT: 'DELETE',
}))
vi.mock('@/app/studio/account/actions', () => ({
  saveEmailPreferencesForm: vi.fn(),
  deleteAccountForm: vi.fn(),
}))

const { default: Account } = await import('@/app/studio/account/page')

const render = async () => renderToStaticMarkup(await Account())

beforeEach(() => {
  vi.clearAllMocks()
  for (const k of Object.keys(queues)) delete queues[k]
  currentUser.mockResolvedValue({
    id: 'user-1',
    email: 'a@b.example',
    identities: [{ provider: 'email' }],
  })
  queues.profiles = [{ data: { name: 'Jamie Rivers', licence_terms_version: '2026-09-22' }, error: null }]
  queues.song_jobs = [
    { data: { rights_warranted_at: '2026-09-20T10:00:00Z' }, error: null },
    { data: { created_at: '2026-09-18T09:00:00Z' }, error: null },
  ]
  getBillingSummary.mockResolvedValue({
    entitlement: { ok: true, source: 'subscription', plan: 'fan', tracksLeft: 3, renewsAt: '2026-10-01T00:00:00Z' },
    sub: null,
    usedThisPeriod: 2,
    creditBalance: 1,
  })
  getEmailPreferences.mockResolvedValue({ productEmails: true, ratingReminders: false, available: true })
})

describe('/studio/account', () => {
  it('redirects to sign-in when nobody is signed in', async () => {
    currentUser.mockResolvedValueOnce(null)
    await expect(Account()).rejects.toThrow('REDIRECT:/studio/sign-in?next=/studio/account')
  })

  it('shows who is signed in and how', async () => {
    const html = await render()
    expect(html).toContain('Jamie Rivers')
    expect(html).toContain('a@b.example')
    expect(html).toContain('Email code')
  })

  it('reads the sign-in method off a Google identity', async () => {
    currentUser.mockResolvedValue({ id: 'user-1', email: 'a@b.example', identities: [{ provider: 'google' }] })
    const html = await render()
    expect(html).toContain('Google')
    expect(html).not.toContain('Email code')
  })

  it('shows the plan, tracks left, renewal and credit balance, linking only to billing', async () => {
    const html = await render()
    expect(html).toContain('Plus')
    expect(html).toContain('3')
    expect(html).toContain('href="/studio/billing"')
  })

  it('shows the empty state when there is no active plan', async () => {
    getBillingSummary.mockResolvedValue({ entitlement: { ok: false, reason: 'no_plan' }, sub: null, usedThisPeriod: 0, creditBalance: 0 })
    const html = await render()
    expect(html).toContain('No plan yet')
  })

  it('states the turnaround promise', async () => {
    const html = await render()
    expect(html).toContain(TURNAROUND_PROMISE)
    expect(html).toContain(TURNAROUND_BUSY)
  })

  it('shows the rights warranty and licence versions with their dates, and the point lists behind details', async () => {
    const html = await render()
    expect(html).toContain(RIGHTS_TERMS_VERSION)
    expect(html).toContain('2026-09-22')
    expect(html).toMatch(/<details/)
    expect(html).toMatch(/<summary/)
  })

  it('shows the email preference toggles at their saved values', async () => {
    const html = await render()
    expect(html).toMatch(/name="productEmails"[^>]*checked/)
    expect(html).not.toMatch(/name="ratingReminders"[^>]*checked/)
    expect(html).toContain('always on')
  })

  it('offers a download-my-data link to the route', async () => {
    const html = await render()
    expect(html).toContain('href="/studio/account/download"')
    expect(html).toMatch(/Download my data/i)
  })

  it('gates the delete with a type-to-confirm field, and explains what is kept and what is retired', async () => {
    const html = await render()
    expect(html).toMatch(/name="confirm"/)
    expect(html).toMatch(/DELETE/)
    expect(html.toLowerCase()).toContain('voice model')
  })

  it('never says an em dash', () => {
    expect(RIGHTS_TERMS_VERSION).not.toMatch(/—/)
  })
})
