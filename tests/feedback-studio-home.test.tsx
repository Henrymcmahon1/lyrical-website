import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PLANS } from '@/lib/plans'

/**
 * The Door-2 studio home, rendered. Every read is the user's client (mocked as thenable
 * chains here), the entitlement helper is mocked, and the child components are stubs so the
 * assertions are about THIS page: the plan card, the nesting of takes, the licence line, the
 * closed-window copy on a rejected child and the heartbeat line.
 */
const entitlement = vi.fn()
const tables: Record<string, unknown[]> = {}
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/entitlement-db', () => ({ getEntitlementFor: () => entitlement() }))
vi.mock('@/app/studio/actions', () => ({ signOut: vi.fn() }))
vi.mock('@/components/FeedbackBar', () => ({ FeedbackBar: (p: { jobId: string; rerollsLeft: number }) => <div data-bar={p.jobId}>bar {p.rerollsLeft}</div> }))
vi.mock('@/components/CoverPlayer', () => ({ CoverPlayer: (p: { jobId: string }) => <div data-player={p.jobId} /> }))
vi.mock('@/components/LyricsEditor', () => ({ LyricsEditor: () => null }))
vi.mock('@/components/StudioAutoRefresh', () => ({ StudioAutoRefresh: () => null }))
vi.mock('@/components/Scorecard', () => ({ Scorecard: () => null }))
vi.mock('@/lib/supabase-server', () => ({
  currentUser: async () => ({ id: 'user-1', email: 'a@b.example' }),
  supabaseServer: async () => ({
    from: (t: string) => {
      const c = { select: () => c, order: () => c, limit: () => c, then: (r: (v: unknown) => void) => r({ data: tables[t] ?? [], error: null }) }
      return c
    },
  }),
}))
const { default: Studio } = await import('@/app/studio/page')

const job = (o: Record<string, unknown>) => ({
  id: 'j1', title: 'A Song', primary_artist: 'An Artist', source_language: 'EN', target_language: 'ES',
  status: 'delivered', created_at: '2026-09-22T00:00:00Z', lyrics: null, parent_job_id: null,
  reroll_index: 0, licence_terms_version: '2026-09-22', ...o,
})
const render = async () => renderToStaticMarkup(await Studio({ searchParams: Promise.resolve({}) }))

beforeEach(() => {
  for (const k of Object.keys(tables)) delete tables[k]
  entitlement.mockResolvedValue({ ok: true, source: 'subscription', plan: 'fan', tracksLeft: 3, renewsAt: '2026-10-01T00:00:00Z' })
})

describe('studio home', () => {
  it('shows the plan card as stat chips with tracks left and the billing link, or the empty state with the deck copy', async () => {
    // The plan name is read from lib/plans.ts, never typed here: Henry renames plans there.
    let h = await render()
    expect(h).toContain(`>${PLANS.fan.name}<`); expect(h).toContain('Tracks left'); expect(h).toMatch(/Tracks left<\/span><span[^>]*>3</); expect(h).toContain('href="/studio/billing"')
    entitlement.mockResolvedValue({ ok: false, reason: 'no_plan' })
    h = await render()
    expect(h).toContain('No plan yet')
    expect(h).toContain('Nothing here yet. Pick a plan and make your first track.')
    expect(h).toContain('href="/pricing"')
  })
  it('nests re-rolls under their original as Take 2, each with a player, a bar and the licence line', async () => {
    tables.song_jobs = [job({}), job({ id: 'j2', parent_job_id: 'j1', reroll_index: 1 })]
    const h = await render()
    expect(h).toContain('Take 2')
    expect(h).toContain('data-player="j1"'); expect(h).toContain('data-player="j2"')
    expect(h).toContain('data-bar="j1"'); expect(h).toContain('bar 1')
    expect(h).toContain('Personal use only. Not for release or sale.')
  })
  it('shows the closed-window copy on a rejected child', async () => {
    tables.song_jobs = [job({}), job({ id: 'j2', parent_job_id: 'j1', reroll_index: 1, status: 'rejected' })]
    const h = await render()
    expect(h).toContain('The re-roll window for this song has closed.')
    expect(h).not.toContain('We could not make this one.')
  })
  it('shows "Your song is being made now" only when a job of the signed-in user is in_progress, and never reads worker_heartbeat', async () => {
    tables.song_jobs = [job({ status: 'delivered' })]
    let h = await render()
    expect(h).not.toContain('Your song is being made now')
    expect(h).not.toContain('Renders are running')
    expect(h).not.toContain('Renders are paused')
    tables.song_jobs = [job({ status: 'in_progress' })]
    h = await render()
    expect(h).toContain('Your song is being made now')
  })
  it('a rejected self-serve original reads "Not made" and says it did not count, with no player and no bar', async () => {
    // Self-serve = carries licence_terms_version (route is not customer-readable). Original = no parent.
    tables.song_jobs = [job({ status: 'rejected' })]
    const h = await render()
    expect(h).toContain('Not made')
    expect(h).toContain('We could not make this one. It has not counted against your tracks. Make it again to start fresh.')
    expect(h).not.toContain('Not taken on')
    expect(h).not.toContain('data-player="j1"')
    expect(h).not.toContain('data-bar="j1"')
    expect(h).not.toContain('The re-roll window for this song has closed.')
  })
  it('a rejected manual-funnel original (no licence version) keeps the declined wording', async () => {
    tables.song_jobs = [job({ status: 'rejected', licence_terms_version: null })]
    const h = await render()
    expect(h).toContain('Not taken on this time.')
    expect(h).not.toContain('Not made')
    expect(h).not.toContain('We could not make this one.')
  })
  it('draws each song as a collapsible SongCard, open only on the most recent one', async () => {
    tables.song_jobs = [
      job({ id: 'newer', title: 'Newer Song', created_at: '2026-09-22T00:00:00Z' }),
      job({ id: 'older', title: 'Older Song', created_at: '2026-09-01T00:00:00Z' }),
    ]
    const h = await render()
    // The query orders newest first, so "newer" appears before "older" in the markup: the first
    // <details> is the one that should carry the open attribute.
    const cards = h.match(/<details[^>]*>/g) ?? []
    expect(cards).toHaveLength(2)
    expect(cards[0]).toMatch(/\bopen(=""|\s|>)/)
    expect(cards[1]).not.toMatch(/\bopen(=""|\s|>)/)
  })
})
