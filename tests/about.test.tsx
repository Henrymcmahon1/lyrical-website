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
})
