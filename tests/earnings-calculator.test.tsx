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
    expect(html).toContain('$3,840') // per language, matches the existing tile
    expect(html).toContain('$7,680') // gross annual, matches the existing tile
    expect(html).toContain('$38,400') // 5-year cumulative total from the graph
    expect(html).toMatch(/5-year total/i)
  })
})
