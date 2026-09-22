import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { FLYER } from '@/content/investors'

/**
 * The three investor placeholders behind the /investors gate: a signed link to the pitch
 * deck, a written flyer built from content already on the page, and a YouTube-unlisted embed.
 * Deck and video each render nothing until their env is set; the flyer, which depends on no
 * env, always renders. Same never-throws, sign-what-exists pattern as `S02Coffey`.
 */
const createSignedUrl = vi.fn()
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({ storage: { from: () => ({ createSignedUrl: (...a: unknown[]) => createSignedUrl(...a) }) } }),
}))
const { default: InvestorMedia, deckConfig, videoId } = await import('@/components/sections/InvestorMedia')

beforeEach(() => { createSignedUrl.mockReset(); vi.spyOn(console, 'error').mockImplementation(() => {}) })
afterEach(() => {
  for (const k of ['INVESTOR_DECK_PATH', 'INVESTOR_DECK_BUCKET', 'INVESTOR_VIDEO_ID']) delete process.env[k]
})

describe('deckConfig', () => {
  it('needs a path and defaults the bucket to investors', () => {
    expect(deckConfig({})).toBeNull()
    expect(deckConfig({ INVESTOR_DECK_PATH: 'deck.pdf' })).toEqual({ bucket: 'investors', path: 'deck.pdf' })
    expect(deckConfig({ INVESTOR_DECK_PATH: 'deck.pdf', INVESTOR_DECK_BUCKET: 'private' })).toEqual({
      bucket: 'private',
      path: 'deck.pdf',
    })
  })
})

describe('videoId', () => {
  it('is null when unset, trimmed when set', () => {
    expect(videoId({})).toBeNull()
    expect(videoId({ INVESTOR_VIDEO_ID: '  abc123  ' })).toBe('abc123')
  })
})

describe('InvestorMedia', () => {
  it('always renders the flyer, built from the existing section content, with no new claim', async () => {
    const html = renderToStaticMarkup(await InvestorMedia())
    expect(html).toContain(FLYER.title)
    for (const p of FLYER.points) expect(html).toContain(p.h)
  })

  it('renders no deck link when INVESTOR_DECK_PATH is unset, and never calls storage', async () => {
    const html = renderToStaticMarkup(await InvestorMedia())
    expect(html).not.toContain('View the deck')
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it('renders the deck link once INVESTOR_DECK_PATH is set and storage signs it', async () => {
    process.env.INVESTOR_DECK_PATH = 'deck.pdf'
    createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://sb/deck.pdf?t=1' }, error: null })
    const html = renderToStaticMarkup(await InvestorMedia())
    expect(html).toContain('View the deck')
    expect(html).toContain('https://sb/deck.pdf?t=1')
    expect(createSignedUrl).toHaveBeenCalledWith('deck.pdf', 4 * 60 * 60)
  })

  it('renders no deck link when signing fails or storage throws', async () => {
    process.env.INVESTOR_DECK_PATH = 'deck.pdf'
    createSignedUrl.mockResolvedValue({ data: null, error: 'not found' })
    expect(renderToStaticMarkup(await InvestorMedia())).not.toContain('View the deck')
    createSignedUrl.mockRejectedValue(new Error('ECONNREFUSED'))
    expect(renderToStaticMarkup(await InvestorMedia())).not.toContain('View the deck')
  })

  it('renders no video embed when INVESTOR_VIDEO_ID is unset', async () => {
    const html = renderToStaticMarkup(await InvestorMedia())
    expect(html).not.toContain('<iframe')
    expect(html).not.toContain('youtube-nocookie.com')
  })

  it('renders a titled, lazy-loaded, privacy-friendly embed once INVESTOR_VIDEO_ID is set', async () => {
    process.env.INVESTOR_VIDEO_ID = 'abc123'
    const html = renderToStaticMarkup(await InvestorMedia())
    expect(html).toContain('<iframe')
    expect(html).toContain('src="https://www.youtube-nocookie.com/embed/abc123"')
    expect(html).toContain('loading="lazy"')
    expect(html).toMatch(/title="[^"]+"/)
  })

  it('has no em dash anywhere', async () => {
    process.env.INVESTOR_DECK_PATH = 'deck.pdf'
    process.env.INVESTOR_VIDEO_ID = 'abc123'
    createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://sb/deck.pdf' }, error: null })
    const html = renderToStaticMarkup(await InvestorMedia())
    expect(html).not.toMatch(/—|&mdash;/)
  })
})
