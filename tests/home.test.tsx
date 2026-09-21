import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import Home from '@/app/page'
import { DOORS } from '@/content/two-doors'

/**
 * The home page order, pinned. Restored to the original seven sections on 2026-09-22 with one
 * addition, the two doors, between the turn and the ask. Each anchor is a string only that
 * section renders, in page order.
 */
describe('/ (home)', () => {
  const html = renderToStaticMarkup(<Home />)

  it('reads hero, audience, wheels, fidelity, how, turn, two doors, ask, in that order', () => {
    const anchors = [
      'Every song. Any language.', // S01Hero
      'Everyone who was always going to love it.', // S02bAudience
      'There are no borders on your catalog.', // S03Wheels
      'id="technology"', // S04Fidelity
      'id="how"', // S05How
      'Your catalog is already working.', // S09bNow
      'id="doors"', // S09cDoors
      'Make one song multilingual.', // S10Start
    ]
    const idx = anchors.map((s) => html.indexOf(s))
    for (const [i, a] of anchors.entries()) expect(idx[i], `missing: ${a}`).toBeGreaterThanOrEqual(0)
    expect([...idx].sort((a, b) => a - b)).toEqual(idx)
  })

  it('keeps the original hero, word for word', () => {
    expect(html).toContain('Every song. Any language.<br/>Same soul.')
    expect(html).toContain('Turn the music you already own into music for audiences around the world.')
    expect(html).toContain('No upfront cost. You stay in control. Nothing is released without your approval.')
    expect(html).toContain('Make your song multilingual')
    expect(html).toContain('href="/studio"')
    expect(html).toContain('href="/contact"')
  })

  it('offers the two doors as equals: creators to /pricing, artists to /artists', () => {
    expect(DOORS.doors.map((d) => d.label)).toEqual(['For creators', 'For artists'])
    expect(html).toContain('For creators')
    expect(html).toContain('href="/pricing"')
    expect(html).toContain('href="/artists"')
    expect(html).toContain('See plans')
    expect(html).toContain('30% of net streaming receipts')
    expect(html).toContain('$0 upfront')
    expect(html).toContain('Lossless stems')
    expect(html).toContain('A human in the loop')
    expect(html).toContain('songs you have the rights to')
  })

  it('carries none of the v2 landing sections', () => {
    for (const s of ['Most popular', 'Rough edges, honestly', 'Pick a song. Pick a language.', 'Coffey Anderson']) {
      expect(html).not.toContain(s)
    }
  })
})
