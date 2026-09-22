import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { signInvestorSession } from '@/lib/investor-auth'

/**
 * The /investors page, gated, with the three media placeholders (Task 4) wired in. The gate
 * itself (password, session, noindex, robots, sitemap) is unchanged and already covered by
 * `tests/investor-auth.test.ts`; this file checks the gate still holds and that an
 * authenticated visitor sees the media block.
 */
let cookieValue: string | undefined
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (_name: string) => (cookieValue ? { value: cookieValue } : undefined) }),
}))
const createSignedUrl = vi.fn()
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({ storage: { from: () => ({ createSignedUrl: (...a: unknown[]) => createSignedUrl(...a) }) } }),
}))

const { default: Investors, metadata } = await import('@/app/investors/page')

beforeEach(() => {
  process.env.GATE_SECRET = 'a'.repeat(64)
  process.env.INVESTOR_PASSWORD = 'a password for investors'
  cookieValue = undefined
  createSignedUrl.mockReset()
})
afterEach(() => {
  for (const k of ['GATE_SECRET', 'INVESTOR_PASSWORD', 'INVESTOR_DECK_PATH', 'INVESTOR_VIDEO_ID']) delete process.env[k]
})

describe('/investors', () => {
  it('stays gated and noindex', async () => {
    expect(metadata.robots).toEqual({ index: false, follow: false, nocache: true })
    const html = renderToStaticMarkup(
      await Investors({ searchParams: Promise.resolve({}) }),
    )
    expect(html).toContain('A private page for investors.')
    expect(html).not.toContain('Pitch flyer')
  })

  it('shows the media block, deck and video included, once signed in', async () => {
    cookieValue = signInvestorSession(Date.now())
    process.env.INVESTOR_DECK_PATH = 'deck.pdf'
    process.env.INVESTOR_VIDEO_ID = 'abc123'
    createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://sb/deck.pdf' }, error: null })
    const html = renderToStaticMarkup(
      await Investors({ searchParams: Promise.resolve({}) }),
    )
    expect(html).toContain('Pitch flyer')
    expect(html).toContain('View the deck')
    expect(html).toContain('<iframe')
    expect(html).not.toMatch(/—|&mdash;/)
  })
})
