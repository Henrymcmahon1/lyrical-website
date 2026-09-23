import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { EarningsCalculator } from '@/components/EarningsCalculator'
import { WORKED_EXAMPLE } from '@/lib/earnings'

/**
 * The calculator now carries the animated graph as its centrepiece: the graph is driven by
 * the same `estimateEarnings` output as the number tiles, so the two can never show different
 * figures for the same inputs.
 */
describe('EarningsCalculator with the graph', () => {
  it('renders the graph alongside the number tiles, from the same worked-example numbers', () => {
    const html = renderToStaticMarkup(<EarningsCalculator initial={WORKED_EXAMPLE} />)
    expect(html).toContain('data-testid="gross-annual"')
    expect(html).toContain('role="img"')
    expect(html).toContain('$3,686') // per language, matches the existing tile
    expect(html).toContain('$7,373') // gross annual, matches the existing tile
    expect(html).toContain('$36,864') // 5-year cumulative total from the graph
    expect(html).toMatch(/5-year total/i)
  })

  /**
   * Softened against the home page's card treatment (2026-09-23): the tiles used to be a tight
   * `p-5`, noticeably tighter than the `p-8`/`p-10` cards elsewhere on the site (e.g.
   * `S09cDoors`). This does not change any number or the gross-only, no-NPV model, only the
   * breathing room around it.
   */
  it('gives the tiles the same generous padding as the site\'s other cards', () => {
    const html = renderToStaticMarkup(<EarningsCalculator initial={WORKED_EXAMPLE} />)
    expect(html).not.toContain('rounded-card border border-graphite/15 p-5')
    expect(html.match(/rounded-card border border-graphite\/15 p-6 sm:p-8/g)?.length).toBeGreaterThanOrEqual(3)
  })
})
