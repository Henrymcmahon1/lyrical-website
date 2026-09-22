import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DOORS } from '@/content/two-doors'

/**
 * `supabase-admin` is mocked at the top so the static import of `Home` below (which chains
 * through `S02Coffey`) never needs real Supabase credentials. Every test except the last one
 * runs with no `COFFEY_*` env set, so `createSignedUrls` is never even called for them: the
 * mock exists for the one test that flips the env on.
 */
const createSignedUrls = vi.fn()
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({
    storage: { from: () => ({ createSignedUrls: (...a: unknown[]) => createSignedUrls(...a) }) },
  }),
}))

const { default: Home } = await import('@/app/page')
const html = renderToStaticMarkup(await Home())

/**
 * The home page order, pinned. Restored to the original flow on 2026-09-22 with one addition,
 * the two doors, which since Henry's second review the same day is the closing section on the
 * dark ground; `S10Start` is off this page. Each anchor is a string only that section
 * renders, in page order.
 *
 * `Home` is an async server component since it now awaits the Coffey slot (its signed URLs
 * need `supabaseAdmin`), so the page function is called and awaited directly rather than
 * rendered as `<Home />`, the same pattern `/artists` already uses.
 */
describe('/ (home)', () => {
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

  it('carries none of the v2 landing sections, and no Coffey player without the env set', () => {
    for (const s of ['Most popular', 'Rough edges, honestly', 'Pick a song. Pick a language.', 'Coffey Anderson']) {
      expect(html).not.toContain(s)
    }
    expect(createSignedUrls).not.toHaveBeenCalled()
  })
})

describe('/ (home), the Coffey slot wired into the audience section', () => {
  it('renders the Coffey player inside the audience section, before the doors close it, once both env paths are set', async () => {
    process.env.COFFEY_ORIGINAL_PATH = 'a.mp3'
    process.env.COFFEY_COVER_PATH = 'b.mp3'
    createSignedUrls.mockResolvedValue({
      data: [
        { path: 'a.mp3', signedUrl: 'https://sb/a', error: null },
        { path: 'b.mp3', signedUrl: 'https://sb/b', error: null },
      ],
      error: null,
    })
    try {
      const html = renderToStaticMarkup(await Home())
      const audienceStart = html.indexOf('Everyone who was always going to love it.')
      const doorsStart = html.indexOf('id="doors"')
      const coffeyAt = html.indexOf('Coffey Anderson, in a language he never recorded.')
      expect(audienceStart).toBeGreaterThanOrEqual(0)
      expect(coffeyAt).toBeGreaterThan(audienceStart)
      expect(coffeyAt).toBeLessThan(doorsStart)
      expect(html).toContain('https://sb/a')
      expect(html).toContain('https://sb/b')
    } finally {
      delete process.env.COFFEY_ORIGINAL_PATH
      delete process.env.COFFEY_COVER_PATH
    }
  })
})
