import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

/**
 * The feedback bar, actually rendered. `useActionState` returns its initial state under
 * `react-dom/server`, so the bar renders with no React mock; the two server actions are
 * mocked so nothing imports a Supabase client.
 */
vi.mock('@/app/studio/feedback-actions', () => ({ submitFeedbackForm: vi.fn() }))
vi.mock('@/app/studio/reroll-actions', () => ({ requestRerollForm: vi.fn() }))
const { FeedbackBar } = await import('@/components/FeedbackBar')
const JOB = '11111111-2222-3333-4444-555555555555'
const DOWN = { rating: 'down' as const, note: 'Verse 2 is a beat late', tags: ['timing'] }
const html = (p: Partial<Parameters<typeof FeedbackBar>[0]> = {}) =>
  renderToStaticMarkup(<FeedbackBar jobId={JOB} existing={null} rerollsLeft={2} canReroll {...p} />)

describe('FeedbackBar', () => {
  it('is a real form with both thumbs, the job id, the deck prompt and the six chips', () => {
    const h = html({ existing: { ...DOWN, note: '' } })
    expect(h).toMatch(/<form/)
    expect(h).toContain(`value="${JOB}"`)
    expect(h).toMatch(/aria-label="Thumbs up"/)
    expect(h).toMatch(/aria-label="Thumbs down"/)
    expect(h).toContain('Tell us exactly what is wrong')
    for (const t of ['timing', 'pronunciation', 'voice', 'meaning', 'mix', 'other']) expect(h).toContain(`value="${t}"`)
  })
  it('shows re-roll with the count after a saved thumbs-down, disabled with the closed copy at zero', () => {
    expect(html({ existing: DOWN, rerollsLeft: 1 })).toContain('Re-roll this track (1 left)')
    const zero = html({ existing: DOWN, rerollsLeft: 0 })
    expect(zero).toContain('The re-roll window for this song has closed.')
    expect(zero).toMatch(/<button[^>]*disabled/)
  })
  it('never shows re-roll after a thumbs-up or before anything is saved', () => {
    expect(html({ existing: { rating: 'up', note: null, tags: [] } })).not.toContain('Re-roll this track')
    expect(html()).not.toContain('Re-roll this track')
  })
})
