import { beforeEach, describe, expect, it, vi } from 'vitest'

const subQ = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn() }
const jobsQ = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), neq: vi.fn().mockReturnThis(), gte: vi.fn(), not: vi.fn() }
const creditsQ = { select: vi.fn().mockReturnThis(), eq: vi.fn() }
const admin = {
  from: (t: string) => (t === 'subscriptions' ? subQ : t === 'song_jobs' ? jobsQ : creditsQ),
}
vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: () => admin }))
const { getBillingSummary, getEntitlementFor } = await import('@/lib/entitlement-db')

const fan = {
  tier: 'fan',
  status: 'active',
  current_period_start: '2026-09-01T00:00:00Z',
  current_period_end: '2026-10-01T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  subQ.select.mockReturnThis()
  subQ.eq.mockReturnThis()
  jobsQ.select.mockReturnThis()
  jobsQ.eq.mockReturnThis()
  jobsQ.neq.mockReturnThis()
  creditsQ.select.mockReturnThis()
  jobsQ.gte.mockResolvedValue({ count: 2, error: null })
  jobsQ.not.mockResolvedValue({ count: 4, error: null })
  creditsQ.eq.mockResolvedValue({ data: [], error: null })
})

describe('entitlement-db', () => {
  it('counts originals since the period start and feeds computeEntitlement', async () => {
    subQ.maybeSingle.mockResolvedValue({ data: fan, error: null })
    const s = await getBillingSummary('u1', admin as never)
    expect(subQ.select).toHaveBeenCalledWith('tier,status,current_period_start,current_period_end')
    expect(subQ.eq).toHaveBeenCalledWith('user_id', 'u1')
    expect(jobsQ.eq).toHaveBeenCalledWith('user_id', 'u1')
    expect(jobsQ.eq).toHaveBeenCalledWith('reroll_index', 0)
    // Door 1 never counts against info@'s own plan.
    expect(jobsQ.neq).toHaveBeenCalledWith('delivery_profile', 'door1')
    expect(jobsQ.gte).toHaveBeenCalledWith('quota_consumed_at', fan.current_period_start)
    expect(jobsQ.not).not.toHaveBeenCalled()
    expect(s).toMatchObject({
      sub: fan,
      usedThisPeriod: 2,
      creditBalance: 0,
      entitlement: { ok: true, source: 'subscription', tracksLeft: 3 },
    })
  })

  it('a subscription with no period start yet counts every consumed original', async () => {
    subQ.maybeSingle.mockResolvedValue({ data: { ...fan, current_period_start: null }, error: null })
    const s = await getBillingSummary('u1', admin as never)
    expect(jobsQ.gte).not.toHaveBeenCalled()
    expect(jobsQ.not).toHaveBeenCalledWith('quota_consumed_at', 'is', null)
    expect(s.usedThisPeriod).toBe(4)
  })

  it('an inactive subscription skips the job count', async () => {
    subQ.maybeSingle.mockResolvedValue({ data: { ...fan, status: 'canceled' }, error: null })
    const s = await getBillingSummary('u1', admin as never)
    expect(jobsQ.gte).not.toHaveBeenCalled()
    expect(jobsQ.not).not.toHaveBeenCalled()
    expect(s).toMatchObject({ usedThisPeriod: 0, entitlement: { ok: false, reason: 'no_plan' } })
  })

  it('no subscription fails closed unless credits exist', async () => {
    subQ.maybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await getEntitlementFor('u1', admin as never)).toEqual({ ok: false, reason: 'no_plan' })
    creditsQ.eq.mockResolvedValue({ data: [{ delta: 1 }], error: null })
    expect(await getEntitlementFor('u1', admin as never)).toMatchObject({ ok: true, source: 'credit' })
  })

  it('read errors throw instead of granting', async () => {
    subQ.maybeSingle.mockResolvedValue({ data: null, error: { message: 'sub read failed' } })
    await expect(getEntitlementFor('u1', admin as never)).rejects.toThrow('sub read failed')
    subQ.maybeSingle.mockResolvedValue({ data: fan, error: null })
    jobsQ.gte.mockResolvedValue({ count: null, error: { message: 'count failed' } })
    await expect(getEntitlementFor('u1', admin as never)).rejects.toThrow('count failed')
  })
})
