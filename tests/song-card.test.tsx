import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

/**
 * `components/studio/SongCard.tsx`: one song, collapsible. A real <details>/<summary> so it
 * collapses and expands without JavaScript and is keyboard-accessible by native browser
 * behaviour, not a div-and-onClick reimplementation. Child components are stubbed, matching
 * tests/feedback-studio-home.test.tsx, since this test is about SongCard's own markup: what
 * shows in the collapsed summary and what the expanded body carries.
 */
vi.mock('@/components/FeedbackBar', () => ({ FeedbackBar: (p: { jobId: string; rerollsLeft: number }) => <div data-bar={p.jobId}>bar {p.rerollsLeft}</div> }))
vi.mock('@/components/CoverPlayer', () => ({ CoverPlayer: (p: { jobId: string }) => <div data-player={p.jobId} /> }))
vi.mock('@/components/LyricsEditor', () => ({ LyricsEditor: () => null }))

const { SongCard } = await import('@/components/studio/SongCard')

const job = (o: Record<string, unknown>) => ({
  id: 'j1', title: 'A Song', primary_artist: 'An Artist', source_language: 'EN', target_language: 'ES',
  status: 'delivered', created_at: '2026-09-22T00:00:00Z', lyrics: null, parent_job_id: null,
  reroll_index: 0, licence_terms_version: '2026-09-22', ...o,
})

const html = (p: Partial<Parameters<typeof SongCard>[0]> = {}) =>
  renderToStaticMarkup(
    <SongCard
      original={job({})}
      kids={[]}
      left={2}
      existing={{}}
      defaultOpen={false}
      {...p}
    />,
  )

describe('SongCard', () => {
  it('is a real <details>/<summary>, collapsed by default', () => {
    const h = html()
    expect(h).toMatch(/<details(?![^>]*\bopen\b)[^>]*>/)
    expect(h).toMatch(/<summary/)
  })

  it('opens by default when defaultOpen is set', () => {
    const h = html({ defaultOpen: true })
    expect(h).toMatch(/<details[^>]*\bopen(=""|\s|>)/)
  })

  it('shows title, artist, source-to-target language and a date in the compact summary', () => {
    const h = html()
    const summary = h.match(/<summary[\s\S]*?<\/summary>/)?.[0] ?? ''
    expect(summary).toContain('A Song')
    expect(summary).toContain('An Artist')
    expect(summary).toContain('EN to ES')
    expect(summary).toMatch(/Sep/)
  })

  it('shows a status chip reflecting the latest take', () => {
    let h = html()
    expect(h).toContain('Delivered')
    h = html({ original: job({ status: 'in_progress' }) })
    expect(h).toContain('Being made')
  })

  it('reveals the player, licence line and feedback bar for a delivered song', () => {
    const h = html()
    expect(h).toContain('data-player="j1"')
    expect(h).toContain('Personal use only. Not for release or sale.')
    expect(h).toContain('data-bar="j1"')
    expect(h).toContain('bar 2')
  })

  it('nests re-rolls as Take 2, Take 3, ...', () => {
    const h = html({
      kids: [job({ id: 'j2', parent_job_id: 'j1', reroll_index: 1 }), job({ id: 'j3', parent_job_id: 'j1', reroll_index: 2 })],
    })
    expect(h).toContain('Take 2')
    expect(h).toContain('Take 3')
    expect(h).toContain('data-player="j2"')
    expect(h).toContain('data-player="j3"')
  })

  it('shows the closed-window copy on a rejected take, and "Not made" for a rejected self-serve original', () => {
    let h = html({ original: job({ status: 'rejected' }) })
    expect(h).toContain('Not made')
    expect(h).toContain('We could not make this one.')
    h = html({
      original: job({}),
      kids: [job({ id: 'j2', parent_job_id: 'j1', reroll_index: 1, status: 'rejected' })],
    })
    expect(h).toContain('The re-roll window for this song has closed.')
  })
})
