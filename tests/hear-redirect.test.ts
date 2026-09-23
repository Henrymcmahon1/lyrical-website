import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Footer } from '@/components/Footer'
import sitemap from '@/app/sitemap'
import nextConfig from '../next.config'

/**
 * `/hear` was removed and folded into the home page on 2026-09-23, Henry's instruction: it
 * mostly duplicated the home page (`S02bAudience` and `S03Wheels` already show the languages
 * there), and the footer's "Languages" link was the only internal link it had left. Rather than
 * leave a dead URL, `/hear` now redirects to the home page's own languages anchor.
 */
describe('/hear removed, folded into home', () => {
  it('the app/hear page no longer exists', () => {
    expect(existsSync(join(process.cwd(), 'app', 'hear', 'page.tsx'))).toBe(false)
  })

  it('redirects /hear to the home languages anchor', async () => {
    const redirects = (await nextConfig.redirects?.()) ?? []
    const hear = redirects.find((r) => r.source === '/hear')
    expect(hear).toBeTruthy()
    expect(hear?.destination).toBe('/#languages')
  })

  it('the footer "Languages" link points at the home anchor, not /hear', () => {
    const html = renderToStaticMarkup(createElement(Footer))
    expect(html).toContain('href="/#languages"')
    expect(html).not.toContain('href="/hear"')
  })

  it('the sitemap no longer lists /hear', () => {
    const urls = sitemap().map((e) => e.url)
    expect(urls.some((u) => u.endsWith('/hear'))).toBe(false)
  })
})
