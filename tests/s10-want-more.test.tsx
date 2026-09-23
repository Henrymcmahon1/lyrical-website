import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import S10WantMore from '@/components/sections/S10WantMore'

/**
 * The home page's one "learn more about us" moment, added 2026-09-23 on Henry's instruction.
 * Deliberately secondary: it sits under the two doors, on cream (never dark, or it seams
 * against the doors section's dark ground the same way `/hear` once documented), and offers
 * three quiet links rather than competing with the primary get-started CTAs above it.
 */
describe('S10WantMore', () => {
  const html = renderToStaticMarkup(<S10WantMore />)

  it('offers the three secondary doors: story, invest, contact', () => {
    expect(html).toContain('href="/about"')
    expect(html).toContain('href="/investors"')
    expect(html).toContain('href="/contact"')
  })

  it('names the three destinations', () => {
    expect(html).toMatch(/our story/i)
    expect(html).toMatch(/invest/i)
    expect(html).toMatch(/contact/i)
  })

  it('is a cream band, never a dark one', () => {
    expect(html).not.toMatch(/bg-dark-ground|bg-graphite|dark-ink/)
  })

  it('never uses indigo, so appending it after the doors section cannot trip the ' +
    'home page’s "no indigo after id=doors" check', () => {
    expect(html).not.toMatch(/bg-indigo|text-indigo/)
  })

  it('uses no em dash', () => {
    expect(html).not.toMatch(/—|&mdash;/)
  })
})
