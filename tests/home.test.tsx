import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import Home from '@/app/page'
import { DOORS } from '@/content/two-doors'

/**
 * The home page order, pinned. Restored to the original flow on 2026-09-22 with one addition,
 * the two doors, which since Henry's second review the same day is the closing section on the
 * dark ground; `S10Start` is off this page. Each anchor is a string only that section
 * renders, in page order.
 */
describe('/ (home)', () => {
  const html = renderToStaticMarkup(<Home />)

  it('reads hero, audience, wheels, fidelity, how, turn, two doors, in that order', () => {
    const anchors = [
      'Every song. Any language.', // S01Hero
      'Everyone who was always going to love it.', // S02bAudience
      'There are no borders on your catalog.', // S03Wheels
      'id="technology"', // S04Fidelity
      'id="how"', // S05How
      'Your catalog is already working.', // S09bNow
      'id="doors"', // S09cDoors
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

  it('offers the two doors as equals: musicians to /pricing, artists to /artists', () => {
    expect(DOORS.doors.map((d) => d.h)).toEqual(['For musicians', 'For artists'])
    expect(html).toContain('Make tracks from your own songs, or songs you have the rights to, in any language, in the same voice.')
    expect(html).toContain('Make a track')
    expect(html).toContain('href="/pricing"')
    expect(html).toContain('Release your catalog in new languages with us, in your own voice.')
    for (const b of ['Streaming quality', 'Proprietary voice models built for you', 'You can be as involved in the process as you like']) {
      expect(html).toContain(b)
    }
    expect(html).toContain('Sign with us')
    expect(html).toContain('href="/artists"')
    expect(html).toContain('Tell us about it')
  })

  it('closes on the two doors, on the dark ground, with the old ask gone', () => {
    expect(html).not.toContain('Make one song multilingual.')
    expect(html).not.toContain('Talk to us first')
    expect(html).not.toContain('id="start"')
    // The doors section is the one dark band on the page and never uses indigo on it.
    const doors = html.slice(html.indexOf('id="doors"'))
    expect(doors).toContain('bg-dark-ground')
    expect(doors).not.toMatch(/bg-indigo|text-indigo/)
  })

  it('never states a royalty figure or a human in the loop', () => {
    expect(html).not.toContain('30%')
    expect(html).not.toMatch(/human in the loop|human qa|by ear/i)
  })

  it('carries none of the v2 landing sections', () => {
    for (const s of ['Most popular', 'Rough edges, honestly', 'Pick a song. Pick a language.', 'Coffey Anderson']) {
      expect(html).not.toContain(s)
    }
  })
})
