import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

/**
 * The staff Feedback tab and the CSV flattener it shares with the export route. No user ids
 * and no emails in either: the note is the data, the job link is how you find the person.
 */
const rows = vi.fn()
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({ from: () => { const c = { select: () => c, order: () => c, limit: () => rows() }; return c } }),
}))
const { FeedbackTab, FEEDBACK_COLUMNS, flattenFeedback } = await import('@/app/queue/FeedbackTab')
const ROW = {
  id: 'f1', created_at: '2026-09-22T01:00:00Z', job_id: 'j1', rating: 'down' as const, tags: ['timing'], note: 'Chorus line 2 lands late',
  song_jobs: { title: 'A Song', primary_artist: 'An Artist', source_language: 'EN', target_language: 'ES', reroll_index: 0 },
}
beforeEach(() => rows.mockResolvedValue({ data: [ROW], error: null }))

describe('Feedback tab', () => {
  it('draws the job, the rating, the tags, the note and a link to the job', async () => {
    const h = renderToStaticMarkup(await FeedbackTab())
    for (const s of ['A Song', 'An Artist', 'EN to ES', 'Thumbs down', 'timing', 'Chorus line 2 lands late', 'href="/queue?tab=songs&amp;show=all#j1"']) expect(h).toContain(s)
  })
  it('flattens the join for the CSV without user ids', () => {
    expect(flattenFeedback([ROW])[0]).toMatchObject({ title: 'A Song', primary_artist: 'An Artist', rating: 'down', tags: ['timing'], reroll_index: 0, job_id: 'j1' })
    expect(FEEDBACK_COLUMNS[0]).toBe('created_at')
    expect(FEEDBACK_COLUMNS).not.toContain('user_id')
  })
})
