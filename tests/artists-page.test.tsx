import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

/**
 * The Door-1 page, actually rendered to a string.
 *
 * No DOM and no browser: the page is an async server component, so it is awaited and the
 * element tree rendered with react-dom/server. That is exactly what a visitor with JavaScript
 * disabled receives, which is why the worked example and the copy-deck strings are asserted
 * on the markup rather than on the components.
 */
const { default: ArtistsPage, metadata } = await import('@/app/artists/page')
const render = async (eoi?: string) =>
  renderToStaticMarkup(await ArtistsPage({ searchParams: Promise.resolve(eoi ? { eoi } : {}) }))

describe('/artists', () => {
  it('renders the worked example numbers without JavaScript', async () => {
    const html = await render()
    // 8000 * 12 songs * 12 * 0.8 * 2 * 0.004 = 7372.80 gross a year, 3686.40 per language.
    for (const s of ['$7,373', '$3,686', '$0 upfront', 'default 80%', 'an assumption']) {
      expect(html).toContain(s)
    }
    expect(html).toContain('8,000 monthly streams per song, 12 songs, two languages and an 80%')
  })

  it('shows the gross estimate only: no share figures, no royalty figure, terms as prose', async () => {
    const html = await render()
    expect(html).not.toContain('70%')
    expect(html).not.toMatch(/\$1,920|\$1,344|\$576/)
    // Henry, 2026-09-22 (second review): the 30% left every public page. It lives on the
    // gated investor page only. The JSON-LD description in the head counts too.
    expect(html).not.toContain('30%')
    expect(metadata.description).not.toContain('30%')
    expect(html).toContain(
      'Your songs, released in new languages with us, in your own voice. No upfront cost. You keep control of what is released.',
    )
  })

  it('lists exactly the three Door 1 benefits and never a human in the loop', async () => {
    const html = await render()
    for (const s of ['Streaming quality', 'Proprietary voice models built for you', 'You can be as involved in the process as you like']) {
      expect(html).toContain(s)
    }
    expect(html).not.toMatch(/human in the loop|human qa|by ear|human on every version/i)
  })

  it('offers 1 to 8 languages', async () => {
    const html = await render()
    for (const n of [1, 2, 8]) expect(html).toContain(`<option value="${n}"`)
    expect(html).not.toContain('<option value="9"')
  })

  it('has no comparison table and no beta wording', async () => {
    const html = await render()
    expect(html).not.toContain('<table')
    expect(html).not.toMatch(/door 2|beta/i)
    expect(html).toContain('24-bit WAV stems')
  })

  it('carries the copy-deck strings verbatim and labels the estimates', async () => {
    const html = await render()
    for (const s of [
      'Your songs, in every language, in your voice.',
      'Our first signed artist is Coffey Anderson.',
      'What could a new language earn you?',
      'Register your interest',
      'Every number here is an estimate from public payout averages and your own inputs.',
      'industry blended average, 2026, estimate',
    ]) {
      expect(html).toContain(s)
    }
    expect((html.match(/estimate/g) ?? []).length).toBeGreaterThanOrEqual(5)
  })

  it('is indexable, canonical, and its JSON-LD is scoped to the organization', async () => {
    expect(metadata.alternates?.canonical).toBe('/artists')
    expect(metadata.robots).toEqual({ index: true, follow: true })
    const html = await render()
    expect(html).toContain('application/ld+json')
    expect(html).toContain('"@type":"WebPage"')
    expect(html).toContain('/#organization')
    expect(html).not.toContain('aggregateRating')
  })

  it('renders the no-JS sent state from the query string', async () => {
    expect(await render('sent')).toContain('A person will reply within one working day.')
  })

  it('has no em dash and no banned phrase', async () => {
    const html = await render()
    expect(html).not.toMatch(/\u2014|&mdash;/)
    expect(html).not.toMatch(/AI[-\s]generated/i)
  })

  it('is leaner: no dense step-by-step list, the calculator and its graph are the centrepiece, no royalty figure', async () => {
    const html = await render()
    // The five-card "how it works" list read as dense and duplicated what "What you
    // receive" already said; the page is shorter without it.
    expect(html).not.toContain('Five steps')
    expect(html).not.toContain('We produce')
    // The animated graph (Task 1) renders inside the calculator: this is the page's
    // centrepiece, so it must actually be on the page, not just importable.
    expect(html).toContain('role="img"')
    expect(html).toContain('id="eoi"')
    expect(html).not.toContain('30%')
    // Fewer sections: pitch, what you receive, the calculator, the EOI form.
    expect((html.match(/<section/g) ?? []).length).toBeLessThanOrEqual(4)
  })
})
