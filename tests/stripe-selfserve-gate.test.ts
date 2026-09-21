import { beforeEach, describe, expect, it, vi } from 'vitest'

const getEntitlementFor = vi.fn()
vi.mock('@/lib/entitlement-db', () => ({ getEntitlementFor: (...a: unknown[]) => getEntitlementFor(...a) }))
const consumeCredit = vi.fn()
vi.mock('@/lib/credits', () => ({ consumeCredit: (...a: unknown[]) => consumeCredit(...a) }))
vi.mock('@/lib/turnstile', () => ({ verifyTurnstile: async () => ({ ok: true }) }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/lib/supabase-server', () => ({
  currentUser: async () => ({ id: 'u1', email: 'fan@example.com' }),
}))
const insert = vi.fn()
const delEq = vi.fn().mockResolvedValue({ error: null })
const del = vi.fn(() => ({ eq: delEq }))
// `update().eq().is()` is the one-time profile stamp of the licence version (Bot C); it must
// resolve, and it must not be what any assertion here keys off.
const updateIs = vi.fn().mockResolvedValue({ error: null })
const update = vi.fn(() => ({ eq: () => ({ is: updateIs }) }))
const admin = { from: () => ({ insert, delete: del, update }) }
vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: () => admin }))
const { submitSelfServeJob } = await import('@/app/studio/self-serve-actions')

const jobId = '11111111-1111-4111-8111-111111111111'
// Paths are `${userId}/${jobId}/...` inside the bucket: that is what pathBelongsTo checks.
const raw = {
  jobId,
  turnstileToken: 't',
  title: 'Song',
  primaryArtist: 'Artist',
  sourceLanguage: 'EN',
  targetLanguage: 'ES',
  rightsWarranty: true,
  licenceAccepted: true,
  assets: [
    { kind: 'instrumental', path: `u1/${jobId}/inst.wav`, filename: 'inst.wav', bytes: 10 },
    { kind: 'vocal', path: `u1/${jobId}/vox.wav`, filename: 'vox.wav', bytes: 10 },
  ],
}
const credit = { ok: true, source: 'credit', plan: 'single', tracksLeft: 1, renewsAt: null }

beforeEach(() => {
  vi.clearAllMocks()
  insert.mockResolvedValue({ error: null })
  delEq.mockResolvedValue({ error: null })
})

describe('submitSelfServeJob entitlement gate', () => {
  it('refuses with the copy-deck line when not entitled', async () => {
    getEntitlementFor.mockResolvedValue({ ok: false, reason: 'no_plan' })
    expect(await submitSelfServeJob(raw)).toEqual({
      ok: false,
      error: 'You are out of tracks for this period. Upgrade, buy a Single, or wait for it to renew.',
    })
    expect(getEntitlementFor).toHaveBeenCalledWith('u1', admin)
    expect(insert).not.toHaveBeenCalled()
    expect(consumeCredit).not.toHaveBeenCalled()
  })

  it('an exhausted period is refused with the same line', async () => {
    getEntitlementFor.mockResolvedValue({ ok: false, reason: 'period_exhausted' })
    expect((await submitSelfServeJob(raw)).ok).toBe(false)
    expect(insert).not.toHaveBeenCalled()
  })

  it('a subscription track consumes no credit; a credit track writes the consume row', async () => {
    getEntitlementFor.mockResolvedValueOnce({
      ok: true,
      source: 'subscription',
      plan: 'fan',
      tracksLeft: 3,
      renewsAt: null,
    })
    expect(await submitSelfServeJob(raw)).toEqual({ ok: true, jobId })
    expect(consumeCredit).not.toHaveBeenCalled()
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: jobId, pipeline_state: 'queued', quota_consumed_at: expect.any(String) }),
    )

    getEntitlementFor.mockResolvedValueOnce(credit)
    consumeCredit.mockResolvedValueOnce(true)
    expect(await submitSelfServeJob(raw)).toEqual({ ok: true, jobId })
    expect(consumeCredit).toHaveBeenCalledWith(admin, { userId: 'u1', jobId })
    expect(del).not.toHaveBeenCalled()
  })

  it('a failed consume deletes the job and reports an error', async () => {
    getEntitlementFor.mockResolvedValue(credit)
    consumeCredit.mockResolvedValue(false)
    const r = await submitSelfServeJob(raw)
    expect(r.ok).toBe(false)
    expect(r).toMatchObject({ error: 'We could not apply your credit. Try again in a moment.' })
    expect(del).toHaveBeenCalled()
    expect(delEq).toHaveBeenCalledWith('id', jobId)
  })
})
