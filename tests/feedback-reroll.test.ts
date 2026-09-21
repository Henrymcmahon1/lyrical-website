import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The re-roll is the one privileged write in the studio: the child row carries
 * `pipeline_state='queued'`, which spends render money. Every rule in the spec is checked
 * before the insert, and these pin each one plus the exact shape of the child row.
 */
const currentUser = vi.fn()
const jobRow = vi.fn()
const childCount = vi.fn()
const feedbackRow = vi.fn()
const insert = vi.fn()
vi.mock('@/lib/supabase-server', () => ({ currentUser: () => currentUser() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table === 'job_feedback') {
        const c = { select: () => c, eq: () => c, not: () => c, maybeSingle: () => feedbackRow() }
        return c
      }
      const c = {
        select: (_cols: string, opts?: { head?: boolean }) => (opts?.head ? { eq: () => childCount() } : c),
        eq: () => c,
        maybeSingle: () => jobRow(),
        insert: (row: unknown) => ({ select: () => ({ single: () => insert(row) }) }),
      }
      return c
    },
  }),
}))

const { requestReroll } = await import('@/app/studio/reroll-actions')
const JOB = '11111111-2222-3333-4444-555555555555'
const CHILD = '22222222-2222-3333-4444-555555555555'
const BASE = {
  id: JOB, user_id: 'user-1', status: 'delivered', parent_job_id: null, title: 'A Song',
  primary_artist: 'An Artist', source_language: 'EN', target_language: 'ES', lyrics: 'la',
  voice_id: null, voice_preference: 'female', licence_terms_version: '2026-09-22',
}

beforeEach(() => {
  vi.clearAllMocks()
  currentUser.mockResolvedValue({ id: 'user-1' })
  jobRow.mockResolvedValue({ data: BASE, error: null })
  childCount.mockResolvedValue({ count: 0, error: null })
  feedbackRow.mockResolvedValue({ data: { id: 'fb-1' }, error: null })
  insert.mockResolvedValue({ data: { id: 'child-1' }, error: null })
})

describe('requestReroll rules', () => {
  it('needs a session, an owned job (the scoped query misses otherwise) and a delivered status', async () => {
    currentUser.mockResolvedValueOnce(null)
    expect((await requestReroll(JOB)).ok).toBe(false)
    jobRow.mockResolvedValueOnce({ data: null, error: null })
    expect((await requestReroll(JOB)).ok).toBe(false)
    jobRow.mockResolvedValueOnce({ data: { ...BASE, status: 'approved' }, error: null })
    expect((await requestReroll(JOB)).ok).toBe(false)
    expect(insert).not.toHaveBeenCalled()
  })
  it('refuses when the family already has two children, with the closed-window copy', async () => {
    childCount.mockResolvedValue({ count: 2, error: null })
    const r = await requestReroll(JOB)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/re-roll window/)
    expect(insert).not.toHaveBeenCalled()
  })
  it('needs a thumbs-down with a note on the job being re-rolled', async () => {
    feedbackRow.mockResolvedValue({ data: null, error: null })
    expect((await requestReroll(JOB)).ok).toBe(false)
    expect(insert).not.toHaveBeenCalled()
  })
  it('inserts the child with parent = the ORIGINAL, index = children + 1, queued, nothing else copied', async () => {
    jobRow.mockResolvedValue({ data: { ...BASE, id: CHILD, parent_job_id: JOB }, error: null })
    childCount.mockResolvedValue({ count: 1, error: null })
    expect((await requestReroll(CHILD)).ok).toBe(true)
    const row = insert.mock.calls[0][0] as Record<string, unknown>
    expect(row).toMatchObject({
      user_id: 'user-1', parent_job_id: JOB, reroll_index: 2, route: 'auto', pipeline_state: 'queued',
      status: 'approved', quota_consumed_at: null, licence_terms_version: '2026-09-22', title: 'A Song',
      primary_artist: 'An Artist', source_language: 'EN', target_language: 'ES', lyrics: 'la',
      voice_id: null, voice_preference: 'female',
    })
    expect(Number.isInteger(row.seed)).toBe(true)
    expect(typeof row.approved_at).toBe('string')
    expect(row).not.toHaveProperty('notes')
    expect(row).not.toHaveProperty('id')
  })
})
