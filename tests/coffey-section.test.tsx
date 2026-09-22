import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const createSignedUrls = vi.fn()
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({ storage: { from: () => ({ createSignedUrls: (...a: unknown[]) => createSignedUrls(...a) }) } }),
}))
const { default: S02Coffey, coffeyConfig } = await import('@/components/sections/S02Coffey')

const row = (path: string, url: string | null) => ({ path, signedUrl: url, error: url ? null : 'Object not found' })
beforeEach(() => { createSignedUrls.mockReset(); vi.spyOn(console, 'error').mockImplementation(() => {}) })
afterEach(() => { for (const k of ['COFFEY_ORIGINAL_PATH', 'COFFEY_COVER_PATH', 'COFFEY_BUCKET']) delete process.env[k] })
const withEnv = () => { process.env.COFFEY_ORIGINAL_PATH = 'a.mp3'; process.env.COFFEY_COVER_PATH = 'b.mp3' }

describe('S02Coffey (the audience-section slot)', () => {
  it('coffeyConfig needs both paths and defaults the bucket to listen', () => {
    expect(coffeyConfig({})).toBeNull()
    expect(coffeyConfig({ COFFEY_ORIGINAL_PATH: 'a.mp3' })).toBeNull()
    expect(coffeyConfig({ COFFEY_ORIGINAL_PATH: 'a.mp3', COFFEY_COVER_PATH: 'b.mp3' })).toEqual({ bucket: 'listen', original: 'a.mp3', cover: 'b.mp3' })
  })
  it('renders nothing without env, and never calls storage', async () => {
    expect(renderToStaticMarkup(await S02Coffey())).toBe('')
    expect(createSignedUrls).not.toHaveBeenCalled()
  })
  it('renders nothing when one file is missing or storage throws', async () => {
    withEnv()
    createSignedUrls.mockResolvedValue({ data: [row('a.mp3', 'https://sb/a'), row('b.mp3', null)], error: null })
    expect(renderToStaticMarkup(await S02Coffey())).toBe('')
    createSignedUrls.mockRejectedValue(new Error('ECONNREFUSED'))
    expect(renderToStaticMarkup(await S02Coffey())).toBe('')
  })
  it('renders the player with both signed URLs, as a contained slot, not a standalone section', async () => {
    withEnv()
    createSignedUrls.mockResolvedValue({ data: [row('a.mp3', 'https://sb/a?t=1'), row('b.mp3', 'https://sb/b?t=2')], error: null })
    const html = renderToStaticMarkup(await S02Coffey())
    expect(html).toContain('Coffey Anderson')
    expect(html).toContain('https://sb/a?t=1')
    expect(html).toContain('https://sb/b?t=2')
    expect(createSignedUrls).toHaveBeenCalledWith(['a.mp3', 'b.mp3'], 4 * 60 * 60)
    // It is a slot to embed inside S02bAudience, so it carries no top-level <section> of its
    // own (that would nest a section inside a section) and no aria-label of its own.
    expect(html).not.toMatch(/^<section/)
    expect(html).not.toContain('aria-label="Coffey Anderson, before and after"')
  })
})
