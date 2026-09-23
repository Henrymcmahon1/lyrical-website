import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { EarningsGraph } from '@/components/EarningsGraph'
import { type EarningsInput } from '@/lib/earnings'

/**
 * The cumulative earnings line graph, the centrepiece of /artists.
 *
 * `renderToStaticMarkup` never runs effects, so this is exactly what a visitor with
 * JavaScript disabled (or `prefers-reduced-motion: reduce`, since the component's default
 * state IS the resolved state) receives: the line and area at their final, real geometry, not
 * stuck at zero waiting for a script that never runs.
 */
describe('EarningsGraph (cumulative line)', () => {
  const input: EarningsInput = {
    monthlyStreams: 100_000,
    songs: 12,
    languages: 2,
    audienceShare: 0.8,
  }
  // annual gross = 7680, cumulative by year: 7680, 15360, 23040, 30720, 38400

  it('renders an accessible line graph with year ticks and the 5-year total', () => {
    const html = renderToStaticMarkup(<EarningsGraph input={input} />)
    expect(html).toContain('role="img"')
    expect(html).toContain('<title>')
    expect(html).toMatch(/Year 1/)
    expect(html).toMatch(/Year 5/)
    expect(html).toContain('$38,400')
    expect((html.match(/estimate/gi) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it('shows a single plain 5-year total, gross, never NPV or perpetuity language', () => {
    const html = renderToStaticMarkup(<EarningsGraph input={input} />)
    expect(html).toMatch(/5-year total/i)
    expect(html).toContain('$38,400')
    expect(html).toMatch(/gross/i)
    expect(html).not.toMatch(/NPV/i)
    expect(html).not.toMatch(/net present value/i)
    expect(html).not.toMatch(/perpetuity/i)
  })

  it('draws the line at its real, final geometry, with no JavaScript run', () => {
    const html = renderToStaticMarkup(<EarningsGraph input={input} />)
    // The path geometry itself is never animated: it is drawn in full immediately. Only a
    // CSS class (gated by `.js-motion`, added only by a client script) drives the growth.
    const pathMatch = html.match(/<path[^>]*d="([^"]+)"[^>]*class="[^"]*area[^"]*"/)
    expect(pathMatch).not.toBeNull()
    const points = [...(pathMatch?.[1] ?? '').matchAll(/(-?[\d.]+)[ ,](-?[\d.]+)/g)]
    expect(points.length).toBeGreaterThanOrEqual(5)
    expect(html).not.toContain('scaleY(0)')
    expect(html).not.toContain('scaleY(1)')
  })

  it('renders a flat line at zero honestly when the estimate is zero, never negative coordinates', () => {
    const zero: EarningsInput = { monthlyStreams: 0, songs: 1, languages: 1, audienceShare: 0.8 }
    const html = renderToStaticMarkup(<EarningsGraph input={zero} />)
    expect(html).toContain('$0')
    expect(html).not.toMatch(/\$-/)
    // Check real geometry only: the line/area path data and the point coordinates, not the
    // whole HTML blob (which contains unrelated negative-looking substrings, e.g. Tailwind's
    // `mt-4` class before a space).
    const dAttrs = [...html.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1])
    const coordPairs = dAttrs.flatMap((d) => [...d.matchAll(/(-?[\d.]+)[ ,](-?[\d.]+)/g)])
    expect(coordPairs.length).toBeGreaterThan(0)
    for (const [, x, y] of coordPairs) {
      expect(Number(x)).toBeGreaterThanOrEqual(0)
      expect(Number(y)).toBeGreaterThanOrEqual(0)
    }
    const cx = [...html.matchAll(/cx="(-?[\d.]+)"/g)].map((m) => Number(m[1]))
    const cy = [...html.matchAll(/cy="(-?[\d.]+)"/g)].map((m) => Number(m[1]))
    for (const n of [...cx, ...cy]) expect(n).toBeGreaterThanOrEqual(0)
  })

  it('auto-scales the axis to the input: bigger inputs show a higher top gridline and total', () => {
    const small = { ...input, monthlyStreams: 10_000 }
    const big = { ...input, monthlyStreams: 500_000 }
    const htmlSmall = renderToStaticMarkup(<EarningsGraph input={small} />)
    const htmlBig = renderToStaticMarkup(<EarningsGraph input={big} />)
    // The line fills the chart at any size, so magnitude lives in the axis labels + total, not
    // in the pixel height. The largest dollar figure rendered must grow with the input.
    const topFigure = (html: string) =>
      Math.max(...[...html.matchAll(/\$([\d,]+)/g)].map((m) => Number(m[1].replace(/,/g, ''))))
    expect(topFigure(htmlBig)).toBeGreaterThan(topFigure(htmlSmall))
  })

  it('has no em dash anywhere in its labels', () => {
    const html = renderToStaticMarkup(<EarningsGraph input={input} />)
    expect(html).not.toMatch(/—|&mdash;/)
  })
})
