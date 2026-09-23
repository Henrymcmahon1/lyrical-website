import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PLAN_IDS } from '@/lib/plans'
import { TURNAROUND_BUSY, TURNAROUND_PROMISE } from '@/lib/turnaround'
import { PlanCards } from '@/components/sections/PlanCards'

/**
 * The turnaround promise (lib/turnaround.ts), checked everywhere Task 2 puts it: every plan
 * card, the studio's post-submit notice, an in-progress job card, and the self-serve submit
 * form's timing line. The manual funnel's own 48-hour, accept-based promise (language-pairs.ts,
 * S10Start, llms.txt) is a different door and is deliberately not touched or asserted here.
 */

const entitlement = vi.fn()
const tables: Record<string, unknown[]> = {}
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/entitlement-db', () => ({ getEntitlementFor: () => entitlement() }))
vi.mock('@/app/studio/actions', () => ({ signOut: vi.fn() }))
vi.mock('@/components/FeedbackBar', () => ({ FeedbackBar: () => null }))
vi.mock('@/components/CoverPlayer', () => ({ CoverPlayer: () => null }))
vi.mock('@/components/LyricsEditor', () => ({ LyricsEditor: () => null }))
vi.mock('@/components/StudioAutoRefresh', () => ({ StudioAutoRefresh: () => null }))
vi.mock('@/components/Scorecard', () => ({ Scorecard: () => null }))
vi.mock('@/lib/supabase-server', () => ({
  currentUser: async () => ({ id: 'user-1', email: 'a@b.example' }),
  supabaseServer: async () => ({
    from: (t: string) => {
      const c = { select: () => c, neq: () => c, order: () => c, limit: () => c, then: (r: (v: unknown) => void) => r({ data: tables[t] ?? [], error: null }) }
      return c
    },
  }),
}))
vi.mock('@/lib/supabase-client', () => ({ supabaseBrowser: () => ({}) }))
vi.mock('@/app/studio/submit-actions', () => ({ submitSongJob: vi.fn() }))
vi.mock('@/app/studio/self-serve-actions', () => ({ submitSelfServeJob: vi.fn() }))

const { default: Studio } = await import('@/app/studio/page')
const { SongSubmitForm } = await import('@/components/SongSubmitForm')

const job = (o: Record<string, unknown>) => ({
  id: 'j1', title: 'A Song', primary_artist: 'An Artist', source_language: 'EN', target_language: 'ES',
  status: 'submitted', created_at: '2026-09-22T00:00:00Z', lyrics: null, parent_job_id: null,
  reroll_index: 0, licence_terms_version: '2026-09-22', ...o,
})
const renderStudio = async (params: Record<string, string> = {}) =>
  renderToStaticMarkup(await Studio({ searchParams: Promise.resolve(params) }))

beforeEach(() => {
  for (const k of Object.keys(tables)) delete tables[k]
  entitlement.mockResolvedValue({ ok: true, source: 'subscription', plan: 'fan', tracksLeft: 3, renewsAt: '2026-10-01T00:00:00Z' })
})

describe('plan cards carry the promise', () => {
  it('shows the promise and the busy exception on every card', () => {
    const html = renderToStaticMarkup(<PlanCards />)
    expect(html.match(new RegExp(TURNAROUND_PROMISE, 'g'))?.length).toBe(PLAN_IDS.length)
    expect(html.match(new RegExp(TURNAROUND_BUSY, 'g'))?.length).toBe(PLAN_IDS.length)
  })

  it('never states a different self-serve turnaround figure', () => {
    const html = renderToStaticMarkup(<PlanCards />)
    expect(html).not.toMatch(/24 hours|48 hours|2 hours|30 minutes/)
  })
})

describe('the studio home', () => {
  it('states the promise in the post-submit notice', async () => {
    const html = await renderStudio({ submitted: '1' })
    expect(html).toContain(TURNAROUND_PROMISE)
    expect(html).toContain(TURNAROUND_BUSY)
  })

  it('states the promise on an in-progress job card', async () => {
    tables.song_jobs = [job({ status: 'submitted' })]
    const html = await renderStudio()
    expect(html).toContain(TURNAROUND_PROMISE)
  })

  it('does not repeat the promise on a delivered card', async () => {
    tables.song_jobs = [job({ status: 'delivered' })]
    const html = await renderStudio()
    expect(html).not.toContain(TURNAROUND_PROMISE)
  })
})

describe('the submit form', () => {
  it('shows the fixed promise in self-serve mode, not the language-pair 48-hour note', () => {
    const html = renderToStaticMarkup(<SongSubmitForm selfServe />)
    expect(html).toContain(TURNAROUND_PROMISE)
    expect(html).not.toMatch(/48 hours/)
  })

  it('keeps the language-pair note on the manual funnel form, untouched', () => {
    const html = renderToStaticMarkup(<SongSubmitForm />)
    expect(html).not.toContain(TURNAROUND_PROMISE)
  })
})
