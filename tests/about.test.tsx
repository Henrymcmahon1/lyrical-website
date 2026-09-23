import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import About from '@/app/about/page'

describe('/about', () => {
  it('points at /investors with a quiet secondary button between the team and the rights position', () => {
    const html = renderToStaticMarkup(<About />)
    const investors = html.indexOf('href="/investors"')
    expect(investors).toBeGreaterThanOrEqual(0)
    expect(html.slice(investors)).toContain('For investors')
    expect(html.indexOf('Background on')).toBeLessThan(investors) // S09Team detail
    expect(investors).toBeLessThan(html.indexOf('Rights first')) // S08Rights
    expect(html.match(/href="\/investors"/g)?.length).toBe(1)
  })

  /**
   * Refreshed 2026-09-23 on Henry's instruction: the page now opens with the mission and the
   * founders' story before anything else, then reflects the two-doors business as it stands
   * today rather than the earlier, more abstract framing.
   */
  it('opens with the mission before it describes the current business', () => {
    const html = renderToStaticMarkup(<About />)
    const mission = html.indexOf('lyrical exists')
    const business = html.indexOf('Coffey Anderson')
    expect(mission).toBeGreaterThanOrEqual(0)
    expect(business).toBeGreaterThan(mission)
  })

  it('names what has shipped: the Coffey Anderson precedent, the self-serve studio, and proprietary voice models', () => {
    const html = renderToStaticMarkup(<About />)
    expect(html).toContain('Coffey Anderson')
    expect(html.toLowerCase()).toContain('self-serve studio')
    expect(html.toLowerCase()).toMatch(/voice models?/)
  })

  it('never says "beta", even while describing an early-stage product', () => {
    const html = renderToStaticMarkup(<About />)
    expect(html).not.toMatch(/beta/i)
  })

  it('keeps the team section and the rights section', () => {
    const html = renderToStaticMarkup(<About />)
    expect(html).toContain('deal with') // S09Team's "Who you'll deal with"
    expect(html).toContain('Rights first') // S08Rights
  })
})
