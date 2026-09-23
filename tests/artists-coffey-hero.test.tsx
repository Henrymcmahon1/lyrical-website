import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

/**
 * The Coffey before/after as a hero-style proof moment on /artists, added 2026-09-23.
 *
 * `tests/artists-page.test.tsx` covers the no-env state (the page renders exactly as before,
 * `<section>` count capped at 4) and must keep passing untouched: it never sets
 * `COFFEY_ORIGINAL_PATH` / `COFFEY_COVER_PATH`, so `S02Coffey` stays `null` and nothing this
 * file adds should render there. This file covers the WITH-env state, same mocking pattern as
 * `tests/coffey-section.test.tsx`: mock `@/lib/supabase-admin` so `S02Coffey` can resolve
 * signed URLs without a network call.
 */
const createSignedUrls = vi.fn()
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({ storage: { from: () => ({ createSignedUrls: (...a: unknown[]) => createSignedUrls(...a) }) } }),
}))
const { default: ArtistsPage } = await import('@/app/artists/page')

const row = (path: string, url: string | null) => ({ path, signedUrl: url, error: url ? null : 'Object not found' })
beforeEach(() => {
  createSignedUrls.mockReset()
  createSignedUrls.mockResolvedValue({
    data: [row('a.mp3', 'https://sb/a?t=1'), row('b.mp3', 'https://sb/b?t=2')],
    error: null,
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  for (const k of ['COFFEY_ORIGINAL_PATH', 'COFFEY_COVER_PATH', 'COFFEY_BUCKET']) delete process.env[k]
})

const render = async () => renderToStaticMarkup(await ArtistsPage({ searchParams: Promise.resolve({}) }))

describe('/artists Coffey hero moment', () => {
  it('renders nothing extra when the env is absent (graceful, no fake audio)', async () => {
    const html = await render()
    expect(html).not.toContain('https://sb/a')
    expect(createSignedUrls).not.toHaveBeenCalled()
  })

  it('renders the before/after prominently near the top when both env paths are set', async () => {
    process.env.COFFEY_ORIGINAL_PATH = 'a.mp3'
    process.env.COFFEY_COVER_PATH = 'b.mp3'
    const html = await render()
    expect(html).toContain('Coffey Anderson')
    expect(html).toContain('https://sb/a?t=1')
    expect(html).toContain('https://sb/b?t=2')

    const ctaAt = html.indexOf('Register your interest')
    const coffeyAt = html.indexOf('Coffey Anderson, in a language he never recorded')
    const receivesAt = html.indexOf('What you receive.')
    expect(ctaAt).toBeGreaterThan(-1)
    expect(coffeyAt).toBeGreaterThan(-1)
    expect(receivesAt).toBeGreaterThan(-1)
    // The hero's own CTA stays first: proof is added AFTER it, never pushing it down.
    expect(ctaAt).toBeLessThan(coffeyAt)
    // Proof beats the form: it lands before "What you receive", near the top of the page.
    expect(coffeyAt).toBeLessThan(receivesAt)
  })
})
