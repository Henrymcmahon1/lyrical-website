import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `lib/account-data.ts`: the account page's own I/O, always the service-role client scoped to
 * the caller's own rows (the page proves the session first; these never see anyone else's).
 *
 * profiles.product_emails / rating_reminders / retired_at are Bot 1's migration 004. Until it
 * is merged the columns do not exist, so PostgREST refuses the whole query rather than
 * returning null for them. Every read and write that touches them is defensive: a genuine
 * "undefined column" error reads as the default (opted in) or no-ops, but any OTHER error still
 * throws or fails, exactly as an unguarded query would.
 */

const profilesQ = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn(), update: vi.fn().mockReturnThis() }
const jobsQ = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn() }
const feedbackQ = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn() }
const creditsQ = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn() }
const deliveriesQ = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn() }
const voiceModelsQ = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), neq: vi.fn() }

const TABLES: Record<string, unknown> = {
  profiles: profilesQ,
  song_jobs: jobsQ,
  job_feedback: feedbackQ,
  song_credits: creditsQ,
  song_job_deliveries: deliveriesQ,
  voice_models: voiceModelsQ,
}
const admin = { from: (t: string) => TABLES[t] }

const {
  getEmailPreferences,
  setEmailPreference,
  exportAccountData,
  retireAccount,
} = await import('@/lib/account-data')

const MISSING_COLUMN = { code: '42703', message: 'column profiles.product_emails does not exist' }
const OTHER_ERROR = { message: 'connection reset' }

beforeEach(() => {
  vi.clearAllMocks()
  for (const q of [profilesQ, jobsQ, feedbackQ, creditsQ, deliveriesQ]) {
    ;(q.select as ReturnType<typeof vi.fn>).mockReturnThis()
    ;(q.eq as ReturnType<typeof vi.fn>).mockReturnThis()
  }
  profilesQ.update.mockReturnThis()
  voiceModelsQ.update.mockReturnThis()
  voiceModelsQ.eq.mockReturnThis()
})

describe('getEmailPreferences', () => {
  it('reads both toggles when the migration is in', async () => {
    profilesQ.maybeSingle.mockResolvedValue({ data: { product_emails: false, rating_reminders: true }, error: null })
    const p = await getEmailPreferences(admin as never, 'u1')
    expect(profilesQ.eq).toHaveBeenCalledWith('id', 'u1')
    expect(p).toEqual({ productEmails: false, ratingReminders: true, available: true })
  })

  it('defaults both to opted-in when the row has nulls', async () => {
    profilesQ.maybeSingle.mockResolvedValue({ data: { product_emails: null, rating_reminders: null }, error: null })
    expect(await getEmailPreferences(admin as never, 'u1')).toEqual({ productEmails: true, ratingReminders: true, available: true })
  })

  it('defaults both to opted-in and flags unavailable when the columns do not exist yet', async () => {
    profilesQ.maybeSingle.mockResolvedValue({ data: null, error: MISSING_COLUMN })
    expect(await getEmailPreferences(admin as never, 'u1')).toEqual({ productEmails: true, ratingReminders: true, available: false })
  })

  it('still throws on a real failure', async () => {
    profilesQ.maybeSingle.mockResolvedValue({ data: null, error: OTHER_ERROR })
    await expect(getEmailPreferences(admin as never, 'u1')).rejects.toThrow('connection reset')
  })
})

describe('setEmailPreference', () => {
  it('writes only the given fields, scoped to the caller', async () => {
    profilesQ.update.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    const r = await setEmailPreference(admin as never, 'u1', { productEmails: false })
    expect(profilesQ.update).toHaveBeenCalledWith({ product_emails: false })
    expect(r).toEqual({ ok: true })
  })

  it('no-ops on an empty patch without writing', async () => {
    const r = await setEmailPreference(admin as never, 'u1', {})
    expect(profilesQ.update).not.toHaveBeenCalled()
    expect(r).toEqual({ ok: true })
  })

  it('reports unavailable, not a crash, when the migration is not in yet', async () => {
    profilesQ.update.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: MISSING_COLUMN }) })
    const r = await setEmailPreference(admin as never, 'u1', { ratingReminders: true })
    expect(r.ok).toBe(false)
  })

  it('still throws on a real failure', async () => {
    profilesQ.update.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: OTHER_ERROR }) })
    await expect(setEmailPreference(admin as never, 'u1', { productEmails: true })).rejects.toThrow('connection reset')
  })
})

describe('exportAccountData', () => {
  it('gathers every table scoped to the caller, naming columns and never selecting *', async () => {
    jobsQ.order.mockResolvedValue({ data: [{ id: 'j1' }], error: null })
    feedbackQ.order.mockResolvedValue({ data: [{ job_id: 'j1' }], error: null })
    creditsQ.order.mockResolvedValue({ data: [{ delta: 1 }], error: null })
    deliveriesQ.order.mockResolvedValue({ data: [{ job_id: 'j1' }], error: null })

    const out = await exportAccountData(admin as never, 'u1')

    for (const q of [jobsQ, feedbackQ, creditsQ, deliveriesQ]) {
      expect(q.eq).toHaveBeenCalledWith('user_id', 'u1')
      const [cols] = (q.select as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(cols).not.toBe('*')
    }
    expect(out.jobs).toEqual([{ id: 'j1' }])
    expect(out.feedback).toEqual([{ job_id: 'j1' }])
    expect(out.credits).toEqual([{ delta: 1 }])
    expect(out.deliveries).toEqual([{ job_id: 'j1' }])
    expect(typeof out.exportedAt).toBe('string')
  })

  it('throws rather than returning a partial export on any read failure', async () => {
    jobsQ.order.mockResolvedValue({ data: null, error: { message: 'jobs read failed' } })
    feedbackQ.order.mockResolvedValue({ data: [], error: null })
    creditsQ.order.mockResolvedValue({ data: [], error: null })
    deliveriesQ.order.mockResolvedValue({ data: [], error: null })
    await expect(exportAccountData(admin as never, 'u1')).rejects.toThrow('jobs read failed')
  })
})

describe('retireAccount', () => {
  it('retires every non-retired voice model and stamps the marker, scoped to the caller', async () => {
    voiceModelsQ.neq.mockResolvedValue({ error: null })
    profilesQ.update.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    const r = await retireAccount(admin as never, 'u1')
    expect(voiceModelsQ.update).toHaveBeenCalledWith({ status: 'retired' })
    expect(voiceModelsQ.eq).toHaveBeenCalledWith('user_id', 'u1')
    expect(voiceModelsQ.neq).toHaveBeenCalledWith('status', 'retired')
    expect(r).toEqual({ ok: true })
  })

  it('keeps ledger tables untouched: only voice_models and profiles are ever written', async () => {
    voiceModelsQ.neq.mockResolvedValue({ error: null })
    profilesQ.update.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    await retireAccount(admin as never, 'u1')
    for (const q of [jobsQ, feedbackQ, creditsQ, deliveriesQ]) {
      expect('update' in q).toBe(false)
    }
  })

  it('still succeeds when the retired_at marker column does not exist yet', async () => {
    voiceModelsQ.neq.mockResolvedValue({ error: null })
    profilesQ.update.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: MISSING_COLUMN }) })
    expect(await retireAccount(admin as never, 'u1')).toEqual({ ok: true })
  })

  it('fails if the voice models cannot be retired', async () => {
    voiceModelsQ.neq.mockResolvedValue({ error: OTHER_ERROR })
    const r = await retireAccount(admin as never, 'u1')
    expect(r.ok).toBe(false)
  })

  it('fails on a real marker-write failure, not just a missing column', async () => {
    voiceModelsQ.neq.mockResolvedValue({ error: null })
    profilesQ.update.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: OTHER_ERROR }) })
    const r = await retireAccount(admin as never, 'u1')
    expect(r.ok).toBe(false)
  })
})
