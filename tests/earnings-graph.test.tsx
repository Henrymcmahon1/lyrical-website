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
    monthlyStreams: 8_000,
    songs: 12,
    languages: 2,
    audienceShare: 0.8,
  }
  // annual gross = 7372.8, cumulative by year: 7372.8, 14745.6, 22118.4, 29491.2, 36864

  it('renders an accessible line graph with year ticks and the 5-year total', () => {
    const html = renderToStaticMarkup(<EarningsGraph input={input} />)
    expect(html).toContain('role="img"')
    expect(html).toContain('<title>')
    expect(html).toMatch(/Year 1/)
    expect(html).toMatch(/Year 5/)
    expect(html).toContain('$36,864')
    expect((html.match(/estimate/gi) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it('shows a single plain 5-year total, gross, never NPV or perpetuity language', () => {
    const html = renderToStaticMarkup(<EarningsGraph input={input} />)
    expect(html).toMatch(/5-year total/i)
    expect(html).toContain('$36,864')
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

  it('anchors the first and last year labels inward so neither clips the viewBox', () => {
    // The last point sits at x = WIDTH - MARGIN_RIGHT. A middle-anchored label there overflows
    // past the viewBox's right edge and clips. The first point sits at x = MARGIN_LEFT, so a
    // middle-anchored label there is fine, but Henry asked for start/end/middle across the row.
    const html = renderToStaticMarkup(<EarningsGraph input={input} />)
    const labels = [...html.matchAll(/<text ([^>]*)>Year (\d+)<\/text>/g)].map((m) => ({
      attrs: m[1],
      year: Number(m[2]),
    }))
    expect(labels).toHaveLength(5)
    const anchorOf = (year: number) => {
      const found = labels.find((l) => l.year === year)
      const m = found?.attrs.match(/text-anchor="([^"]+)"/)
      return m?.[1]
    }
    expect(anchorOf(1)).toBe('start')
    expect(anchorOf(5)).toBe('end')
    expect(anchorOf(2)).toBe('middle')
    expect(anchorOf(3)).toBe('middle')
    expect(anchorOf(4)).toBe('middle')
  })

  it('keys the animated area and line by the inputs, so a value change remounts them and replays the CSS grow animation', () => {
    // EarningsGraph has no hooks of its own, so calling it directly as a plain function returns
    // its React element tree without needing a DOM. Two different inputs must produce different
    // keys on the animated nodes (a remount, which restarts the CSS animation); the same input
    // must produce the same key (no needless remount / re-animation on every render).
    const findByClassName = (el: unknown, className: string): { key: string | null } | null => {
      if (!el || typeof el !== 'object') return null
      const node = el as { props?: { className?: string; children?: unknown }; key?: string | null }
      if (node.props?.className === className) return { key: node.key ?? null }
      const children = node.props?.children
      if (children == null) return null
      const list = Array.isArray(children) ? children : [children]
      for (const child of list) {
        const found = findByClassName(child, className)
        if (found) return found
      }
      return null
    }

    const a = EarningsGraph({ input })
    const aAgain = EarningsGraph({ input: { ...input } })
    const b = EarningsGraph({ input: { ...input, monthlyStreams: 20_000 } })

    const areaA = findByClassName(a, 'area-grow')
    const areaAAgain = findByClassName(aAgain, 'area-grow')
    const areaB = findByClassName(b, 'area-grow')
    const lineA = findByClassName(a, 'line-fade')
    const lineAAgain = findByClassName(aAgain, 'line-fade')
    const lineB = findByClassName(b, 'line-fade')

    expect(areaA?.key).toBeTruthy()
    expect(lineA?.key).toBeTruthy()
    expect(areaA?.key).toEqual(areaAAgain?.key)
    expect(lineA?.key).toEqual(lineAAgain?.key)
    expect(areaA?.key).not.toEqual(areaB?.key)
    expect(lineA?.key).not.toEqual(lineB?.key)
  })
})
