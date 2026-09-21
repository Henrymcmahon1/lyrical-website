import { beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { STUDIO_TABS, activeStudioTab, isStudioShellPath } from '@/lib/studio-shell'

/**
 * The studio shell, rendered.
 *
 * The signed-in studio wears the control-room chrome: a left rail with the animated wave mark
 * and four tabs, the public Nav and Footer gone. The sign-in page is the one /studio route that
 * keeps the public chrome, so a visitor arriving from the marketing site is not dropped into an
 * empty console. Both halves are pinned here: the pure path rules, the layout's markup, and the
 * root chrome switch that hides Nav and Footer on shell routes.
 */
let pathname = '/studio'
let inFlight: unknown[] = []
const currentUser = vi.fn()

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  redirect: vi.fn(),
}))
vi.mock('@/app/studio/actions', () => ({ signOut: vi.fn() }))
vi.mock('@/lib/supabase-server', () => ({
  currentUser: () => currentUser(),
  supabaseServer: async () => ({
    from: () => {
      const c = {
        select: () => c,
        not: () => c,
        limit: () => c,
        then: (r: (v: unknown) => void) => r({ data: inFlight, error: null }),
      }
      return c
    },
  }),
}))

const { default: StudioLayout } = await import('@/app/studio/layout')
const { SiteChrome } = await import('@/components/SiteChrome')

const renderShell = async () =>
  renderToStaticMarkup(await StudioLayout({ children: <p data-page>page body</p> }))

beforeEach(() => {
  pathname = '/studio'
  inFlight = []
  currentUser.mockResolvedValue({ id: 'user-1', email: 'a@b.example' })
})

describe('which routes wear the shell', () => {
  it('wraps /studio and everything under it except sign-in', () => {
    for (const p of ['/studio', '/studio/new', '/studio/voices', '/studio/voices/new', '/studio/billing']) {
      expect(isStudioShellPath(p), p).toBe(true)
    }
    for (const p of ['/studio/sign-in', '/studio/sign-in/', '/', '/pricing', '/studios', '/studiox/new']) {
      expect(isStudioShellPath(p), p).toBe(false)
    }
  })

  it('keeps the sign-in page outside the studio layout on disk, at the same URL', () => {
    // A route group: `(public)` is dropped from the URL, so /studio/sign-in still resolves, but
    // the page no longer sits under app/studio and so never inherits app/studio/layout.tsx.
    expect(existsSync('app/(public)/studio/sign-in/page.tsx')).toBe(true)
    expect(existsSync('app/studio/sign-in/page.tsx')).toBe(false)
  })

  it('lights the right tab for each path', () => {
    expect(activeStudioTab('/studio')).toBe('songs')
    expect(activeStudioTab('/studio/new')).toBe('create')
    expect(activeStudioTab('/studio/voices')).toBe('voices')
    expect(activeStudioTab('/studio/voices/new')).toBe('voices')
    expect(activeStudioTab('/studio/billing')).toBe('billing')
    expect(activeStudioTab('/studio/sign-in')).toBeNull()
  })
})

describe('the shell markup', () => {
  it('draws the four tabs with the right hrefs, in order', async () => {
    const html = await renderShell()
    const nav = /<nav aria-label="Studio"[^>]*>([\s\S]*?)<\/nav>/.exec(html)?.[1] ?? ''
    const hrefs = [...nav.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1])
    expect(hrefs).toEqual(['/studio/new', '/studio', '/studio/voices', '/studio/billing'])
    for (const tab of STUDIO_TABS) expect(nav).toContain(`>${tab.label}<`)
  })

  it('marks the active tab with aria-current', async () => {
    pathname = '/studio/billing'
    const html = await renderShell()
    const links = [...html.matchAll(/<a [^>]*>/g)].map((m) => m[0])
    const lit = links.filter((a) => a.includes('aria-current="page"'))
    expect(lit).toHaveLength(1)
    expect(lit[0]).toContain('href="/studio/billing"')
  })

  it('carries the wave mark, static while nothing is rendering', async () => {
    const html = await renderShell()
    expect(html).toMatch(/<svg[^>]*aria-label="lyrical"[^>]*data-animated="false"/)
    expect(html.match(/data-brand-ribbon/g)).toHaveLength(2)
    expect(html.match(/data-wave-ribbon/g)).toHaveLength(2)
  })

  it('ripples the wave mark while one of this customer\'s songs is in flight', async () => {
    inFlight = [{ id: 'j1' }]
    const html = await renderShell()
    expect(html).toMatch(/<svg[^>]*aria-label="lyrical"[^>]*data-animated="true"/)
  })

  it('offers sign out, renders the page inside its own main, and shows no public chrome', async () => {
    const html = await renderShell()
    expect(html).toContain('Sign out')
    expect(html).toMatch(/<main[^>]*id="main"/)
    expect(html).toContain('data-page')
    expect(html).not.toContain('For artists')
    expect(html).not.toContain('Pricing')
  })

  it('never says beta', async () => {
    expect(await renderShell()).not.toMatch(/beta/i)
  })
})

describe('the root chrome switch', () => {
  const chrome = () =>
    renderToStaticMarkup(
      <SiteChrome nav={<div>NAV</div>} footer={<div>FOOT</div>}>
        <p>body</p>
      </SiteChrome>,
    )

  it('drops Nav and Footer on shell routes, so the studio owns the whole viewport', () => {
    pathname = '/studio/voices'
    const html = chrome()
    expect(html).not.toContain('NAV')
    expect(html).not.toContain('FOOT')
    expect(html).toContain('body')
  })

  it('keeps them on the sign-in page and on every public page', () => {
    for (const p of ['/studio/sign-in', '/', '/pricing']) {
      pathname = p
      const html = chrome()
      expect(html, p).toContain('NAV')
      expect(html, p).toContain('FOOT')
      expect(html, p).toMatch(/<main[^>]*id="main"/)
    }
  })
})
