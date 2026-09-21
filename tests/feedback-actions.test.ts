import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `submitFeedback` runs with the USER's client, so the `job_feedback` RLS policies are the
 * control. What a unit test can prove is the shape of the write, that a refused write is
 * reported rather than swallowed, and that a job the user cannot see writes nothing.
 */
const upsert = vi.fn()
const maybeSingle = vi.fn()
const currentUser = vi.fn()
vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: async () => ({
    from: (table: string) =>
      table === 'song_jobs'
        ? { select: () => ({ eq: () => ({ maybeSingle }) }) }
        : { upsert: (...a: unknown[]) => upsert(...a) },
  }),
  currentUser: () => currentUser(),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { submitFeedback, submitFeedbackForm } = await import('@/app/studio/feedback-actions')
const JOB = '11111111-2222-3333-4444-555555555555'

beforeEach(() => {
  vi.clearAllMocks()
  currentUser.mockResolvedValue({ id: 'user-1' })
  maybeSingle.mockResolvedValue({ data: { id: JOB }, error: null })
  upsert.mockResolvedValue({ error: null })
})

describe('submitFeedback', () => {
  it('refuses without a session, without a note on a thumbs-down, or on a job the user cannot see', async () => {
    currentUser.mockResolvedValueOnce(null)
    expect((await submitFeedback({ jobId: JOB, rating: 'up' })).ok).toBe(false)
    expect((await submitFeedback({ jobId: JOB, rating: 'down', note: 'short' })).ok).toBe(false)
    maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    expect((await submitFeedback({ jobId: JOB, rating: 'up' })).ok).toBe(false)
    expect(upsert).not.toHaveBeenCalled()
  })
  it('upserts on (job_id, user_id) with the user id from the session', async () => {
    const r = await submitFeedback({ jobId: JOB, rating: 'down', note: 'Chorus line 2 lands late', tags: ['timing'] })
    expect(r).toEqual({ ok: true })
    expect(upsert).toHaveBeenCalledWith(
      { job_id: JOB, user_id: 'user-1', rating: 'down', note: 'Chorus line 2 lands late', tags: ['timing'] },
      { onConflict: 'job_id,user_id' },
    )
  })
  it('reports a refused write instead of pretending', async () => {
    upsert.mockResolvedValue({ error: { message: 'rls' } })
    expect((await submitFeedback({ jobId: JOB, rating: 'up' })).ok).toBe(false)
  })
  it('reads a plain form post the same way', async () => {
    const fd = new FormData()
    fd.set('jobId', JOB); fd.set('rating', 'up'); fd.append('tags', 'voice')
    expect(await submitFeedbackForm(null, fd)).toEqual({ ok: true })
    expect((upsert.mock.calls[0][0] as { tags: string[] }).tags).toEqual(['voice'])
  })
})
