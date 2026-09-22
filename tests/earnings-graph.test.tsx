import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { EarningsGraph } from '@/components/EarningsGraph'
import { estimateEarnings } from '@/lib/earnings'

/**
 * The animated earnings graph, the centrepiece of /artists.
 *
 * `renderToStaticMarkup` never runs effects, so this is exactly what a visitor with
 * JavaScript disabled (or `prefers-reduced-motion: reduce`, since the component's default
 * state IS the resolved state and the effect only ever confirms it) receives: the bars at
 * their final height, not stuck at zero waiting for a script that never runs.
 */
describe('EarningsGraph', () => {
  const estimate = estimateEarnings({
    monthlyStreams: 100_000,
    songs: 12,
    languages: 2,
    audienceShare: 0.8,
  })
  // 100000 * 12 * 0.8 * 2 * 0.004 = 7680 gross, 3840 per language.

  it('renders one bar per language with an accessible label, the estimate per bar, and a total', () => {
    const html = renderToStaticMarkup(<EarningsGraph estimate={estimate} />)
    expect(html).toContain('role="img"')
    expect(html).toContain('$3,840')
    expect(html).toContain('$7,680')
    expect((html.match(/estimate/gi) ?? []).length).toBeGreaterThanOrEqual(2)
    expect(html).toContain('Language 1')
    expect(html).toContain('Language 2')
  })

  it('renders the final full-height bars immediately, with no JavaScript run', () => {
    const html = renderToStaticMarkup(<EarningsGraph estimate={estimate} />)
    // Both bars carry equal, non-zero receipts, so both `<rect>`s must be drawn at their real
    // final height in the SVG geometry itself, not zero waiting on an effect: there is no
    // component state and no effect here at all, only a CSS-driven `transform: scaleY()`
    // gated by `.js-motion`, which is absent by default (no JS, or reduced motion).
    const heights = [...html.matchAll(/height="([\d.]+)"/g)].map((m) => Number(m[1]))
    expect(heights.length).toBeGreaterThanOrEqual(2)
    for (const h of heights) expect(h).toBeGreaterThan(0)
    expect(html).toContain('class="bar-grow"')
    expect(html).not.toContain('scaleY')
  })

  it('renders a zero-height bar honestly when the estimate is zero, never a negative or missing bar', () => {
    const zero = estimateEarnings({ monthlyStreams: 0, songs: 1, languages: 1, audienceShare: 0.8 })
    const html = renderToStaticMarkup(<EarningsGraph estimate={zero} />)
    expect(html).toContain('$0')
    expect(html).not.toMatch(/\$-|-\$|height="-/)
  })

  it('scales to the full 1..8 language range', () => {
    const eight = estimateEarnings({ monthlyStreams: 100_000, songs: 12, languages: 8, audienceShare: 0.8 })
    const html = renderToStaticMarkup(<EarningsGraph estimate={eight} />)
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) expect(html).toContain(`Language ${n}`)
  })

  it('has no em dash anywhere in its labels', () => {
    const html = renderToStaticMarkup(<EarningsGraph estimate={estimate} />)
    expect(html).not.toMatch(/—|&mdash;/)
  })
})
