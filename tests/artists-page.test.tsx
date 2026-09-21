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
    for (const s of ['$1,920', '$1,344', '$576', '$0 upfront']) expect(html).toContain(s)
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
})
