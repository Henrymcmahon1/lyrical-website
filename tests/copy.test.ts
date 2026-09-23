import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { LANGUAGES } from '@/lib/languages'
import demos from '@/content/demos.json'

const SKIP = new Set(['node_modules', '.next', '.git', 'docs', 'tests', 'public', 'supabase'])

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue
    // Dotfiles are never shipped source. Scanning them produced a false positive on a
    // temporary deploy bundle that contained the whole codebase as one JSON blob.
    if (entry.startsWith('.')) continue
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx?|css|json)$/.test(entry) && entry !== 'package-lock.json') out.push(p)
  }
  return out
}

const files = walk('.')
const corpus = files.map((f) => readFileSync(f, 'utf8')).join('\n')

describe('copy guardrails — these are commitments, not preferences', () => {
  it('never says "AI-generated"', () => {
    expect(corpus).not.toMatch(/AI[-\s]generated/i)
  })

  it('never publishes a population multiplier', () => {
    expect(corpus).not.toMatch(/6\.4\s*[x×]/i)
    expect(corpus).not.toMatch(/2\.38\s*B\b/i)
  })

  it('never uses "Solutions" as a nav label', () => {
    expect(corpus).not.toMatch(/>\s*Solutions\s*</)
  })

  it('paints no gradient anywhere', () => {
    // Mask gradients are an alpha channel, not paint. See tests/tokens.test.ts.
    const painting = corpus
      .split('\n')
      .filter((line) => !/(^|[^-\w])(-webkit-)?mask-image\s*:/.test(line))
      .join('\n')
    expect(painting).not.toMatch(/linear-gradient|radial-gradient|conic-gradient/)
  })

  it('states the deliverable as a finished mix plus a dry stem', () => {
    expect(corpus).toMatch(/dry vocal stem/i)
  })
})

describe('language claims', () => {
  it('lists exactly the nine approved languages', () => {
    /**
     * Pinned as an exact list rather than a count, because this array decides the delivery
     * promise: `OFFERED` derives from it and `GUARANTEED` derives from `OFFERED`, so an entry
     * added here silently commits us to 48 hours on every pair it can form. Nine languages is
     * 72 pairs. A test that only counted them would pass while the wrong language was in.
     *
     * Changed 2026-08-12 on Henry's instruction: German and Cantonese in, Italian out.
     */
    expect(LANGUAGES.map((l) => l.code)).toEqual([
      'EN', 'ES', 'PT', 'FR', 'DE', 'ZH', 'YUE', 'JA', 'KO',
    ])
  })

  it('never lets the promise widen without this file changing', () => {
    // The arithmetic, stated so the cost of a one-line addition is visible in the diff.
    expect(LANGUAGES.length).toBe(9)
  })

  it('gives every language an endonym', () => {
    for (const l of LANGUAGES) expect(l.endonym.length).toBeGreaterThan(0)
  })

  it('only references approved language codes in the demo manifest', () => {
    const codes = new Set<string>(LANGUAGES.map((l) => l.code))
    for (const d of demos as { source: string; target: string }[]) {
      expect(codes.has(d.source)).toBe(true)
      expect(codes.has(d.target)).toBe(true)
    }
  })

  it('never claims audio exists for a pair without files', () => {
    for (const d of demos as { hasAudio: boolean; slug: string }[]) {
      expect(typeof d.hasAudio).toBe('boolean')
      expect(d.slug.length).toBeGreaterThan(0)
    }
  })
})

describe('no secret ever reaches the browser', () => {
  /**
   * Anything named here must only ever be read from server code. A `'use client'` module is
   * compiled into the bundle a visitor downloads, so a reference to one of these there means
   * the value ships to every browser that loads the page.
   *
   * All four are covered, not just the Supabase key: ADMIN_PASSWORD opens the enquiry inbox,
   * RESEND_API_KEY can send mail as the company, and GATE_SECRET signs both the audio-gate
   * cookie and the /leads session, so leaking it forges admin access.
   */
  const SECRETS = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'ADMIN_PASSWORD',
    'RESEND_API_KEY',
    'GATE_SECRET',
  ]

  it.each(SECRETS)('%s is only referenced from server-only modules', (secret) => {
    const offenders = files.filter((f) => {
      const src = readFileSync(f, 'utf8')
      if (!src.includes(secret)) return false
      return src.includes("'use client'") || src.includes('"use client"')
    })
    expect(offenders).toEqual([])
  })

  it('exposes nothing secret through a NEXT_PUBLIC_ variable', () => {
    // NEXT_PUBLIC_ is inlined into the client bundle by design, so a secret given that prefix
    // is published rather than configured.
    //
    // Widened on 2026-08-09 for the portal, from one name to three. Each addition is a
    // deliberate decision, not a convenience:
    //
    //   SITE_URL    the origin. Public by definition.
    //   SUPABASE_URL   the project endpoint. Discoverable from any request the browser makes.
    //   SUPABASE_ANON_KEY   designed to ship in the browser. It carries the `anon` role and
    //     can only reach what the RLS policies in supabase/schema.sql permit.
    //
    // ⚠️ SUPABASE_SERVICE_ROLE_KEY must NEVER appear here. It bypasses every policy, and with
    // this prefix it would be published in the bundle rather than kept on the server. The
    // guard below is the thing that would catch that, so widen this set one name at a time and
    // never by pattern.
    //
    //   TURNSTILE_SITE_KEY   added 2026-08-30. Cloudflare's Turnstile site key, which is
    //     embedded in the rendered widget by design and is not a secret. Its partner, the
    //     TURNSTILE_SECRET_KEY used to verify tokens server-side, deliberately has NO public
    //     prefix and must never gain one.
    const ALLOWED = new Set([
      'NEXT_PUBLIC_SITE_URL',
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
    ])
    const found = new Set<string>()

    for (const f of files) {
      for (const m of readFileSync(f, 'utf8').matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) {
        found.add(m[0])
      }
    }

    for (const name of found) {
      expect(ALLOWED.has(name), `unexpected public env var: ${name}`).toBe(true)
    }
  })
})

describe('typography rules', () => {
  // Em-dashes are removed from all visitor-facing copy by request. Code comments are not
  // "the website", so only rendered strings, metadata and content files are checked.
  const facing = files.filter(
    (f) => f.startsWith('components') || f.startsWith('app') || f.startsWith('content'),
  )

  /**
   * Strip comments before scanning. A naive per-line check misses continuation lines of
   * block comments, which is exactly where the first two false positives hid.
   */
  function stripComments(src: string): string {
    return src
      .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '') // {/* jsx block */}
      .replace(/\/\*[\s\S]*?\*\//g, '') // /* block */
      .replace(/^\s*\/\/.*$/gm, '') // // line
  }

  /**
   * A personal address hardcoded into a section survived a rename of every other copy of it,
   * because a search for the constant could never find a string literal. It shipped on the
   * live site pointing at a founder's Gmail while the rest of the page said otherwise.
   *
   * Rendered copy names the company address by importing CONTACT_EMAIL. Anything else is a
   * second place the address has to be kept in step, and this is the proof that there isn't
   * one. Scripts and docs are excluded: `preflight-enquiry` legitimately mails a real person.
   */
  it('publishes no personal email address', () => {
    const offenders: string[] = []
    for (const f of facing) {
      stripComments(readFileSync(f, 'utf8'))
        .split('\n')
        .forEach((line, i) => {
          if (/[\w.+-]+@(gmail|outlook|hotmail|yahoo|icloud)\.com/i.test(line)) {
            offenders.push(`${f}:${i + 1} ${line.trim()}`)
          }
        })
    }
    expect(offenders, `personal address in rendered copy:\n${offenders.join('\n')}`).toEqual([])
  })

  it('uses no em-dash in rendered copy', () => {
    const offenders: string[] = []
    for (const f of facing) {
      stripComments(readFileSync(f, 'utf8'))
        .split('\n')
        .forEach((line, i) => {
          if (/&mdash;|—/.test(line)) offenders.push(`${f}:${i + 1} ${line.trim()}`)
        })
    }
    expect(offenders, `em-dash in rendered copy:\n${offenders.join('\n')}`).toEqual([])
  })
})

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Nav } from '@/components/Nav'
import { Footer } from '@/components/Footer'

describe('nav and footer point at the two doors', () => {
  /**
   * Henry, 2026-09-22 (second review): one "Get started" link to the doors section replaces
   * "Pricing" and "For artists" in both the nav and the footer. /pricing and /artists stay
   * live and in the sitemap, reached from the doors section only.
   */
  it('nav is Home, Get started, Studio in that order', () => {
    const html = renderToStaticMarkup(createElement(Nav))
    expect([...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1])).toEqual(['/', '/', '/#doors', '/studio'])
    expect(html).toContain('Get started')
    for (const s of ['/pricing', '/artists', 'Pricing', 'For artists']) expect(html).not.toContain(s)
  })
  it('footer carries Get started and keeps the rest, without Pricing or For artists', () => {
    const html = renderToStaticMarkup(createElement(Footer))
    for (const h of ['/#doors', '/studio', '/#languages', '/about', '/contact']) expect(html).toContain(`href="${h}"`)
    for (const s of ['href="/pricing"', 'href="/artists"', 'href="/hear"', '>Pricing<', 'For artists']) expect(html).not.toContain(s)
  })
})

import robots from '@/app/robots'
import sitemap from '@/app/sitemap'
import { SECTIONS as INVESTOR_SECTIONS } from '@/content/investors'

describe('the two doors pages', () => {
  it('hides /investors from crawlers and lists the public pages', () => {
    const rule = robots().rules as { disallow: string[] }[]
    expect(rule[0].disallow).toContain('/investors')
    const urls = sitemap().map((e) => e.url)
    expect(urls.some((u) => u.endsWith('/investors'))).toBe(false)
    for (const p of ['/pricing', '/artists']) expect(urls.some((u) => u.endsWith(p))).toBe(true)
  })
  it('labels the $8,000 figure a placeholder wherever it appears', () => {
    for (const s of INVESTOR_SECTIONS) for (const p of s.p) if (p.includes('$8,000')) expect(p.toLowerCase()).toContain('placeholder')
  })
  it('never types a founding or standard price outside lib/plans.ts and the investor prose', () => {
    const allowed = /(lib[\/]plans\.ts|content[\/]investors\.ts)$/ // either path separator: this runs on Windows too
    const src = files.filter((f) => !allowed.test(f)).map((f) => readFileSync(f, 'utf8')).join('\n')
    for (const price of ['$9', '$19', '$39', '$12', '$29', '$59']) {
      expect(src, `${price} typed outside lib/plans.ts`).not.toMatch(new RegExp(`\${price}(?![\d,])`))
    }
  })
})

import Home from '@/app/page'
import About from '@/app/about/page'
import Pricing from '@/app/pricing/page'
import Contact from '@/app/contact/page'

describe('no "beta" on a marketing page', () => {
  /**
   * Henry, 2026-09-22: the word left every visitor-facing page. It survives in exactly two
   * places, neither of them here: the personal-use licence text in lib/terms.ts, which is a
   * legal document, and the one founding-price sentence on /pricing, which says "founding"
   * and not "beta". So the rendered marketing pages contain the word nowhere at all, and the
   * pricing page carries the founding sentence exactly once.
   *
   * `/hear` came off this list 2026-09-23 when it was removed and became a redirect
   * (next.config.ts): there is no more page component to render.
   */
  // `Home` is an async server component since 2026-09-22 (it awaits the Coffey slot), so
  // every page here is rendered through the same `async () => ...` shape, whether or not
  // that particular page needs the await.
  const pages: [string, () => Promise<React.ReactNode>][] = [
    ['/', async () => Home()],
    ['/about', async () => createElement(About)],
    ['/pricing', async () => createElement(Pricing)],
    ['/contact', async () => createElement(Contact)],
  ]

  it.each(pages)('%s renders without the word', async (_path, render) => {
    const html = renderToStaticMarkup(await render())
    expect(html).not.toMatch(/beta/i)
  })

  it('/pricing says "founding" once, in the locked sentence', () => {
    const html = renderToStaticMarkup(createElement(Pricing))
    expect(html.match(/Founding prices for early sign-ups, kept for life\./g)?.length).toBe(1)
  })

  it('never says "fan" on the home or pricing page', async () => {
    // It reads as unauthorised material. Door 2 is for your own songs, or songs you have the
    // rights to, and the plan names are Single, Plus and Pro.
    expect(renderToStaticMarkup(await Home())).not.toMatch(/\bfans?\b/i)
    expect(renderToStaticMarkup(createElement(Pricing))).not.toMatch(/\bfans?\b/i)
  })
})

import ArtistsPage, { metadata as artistsMeta } from '@/app/artists/page'

describe('no royalty figure and no human-review claim on a public page', () => {
  /**
   * Henry, 2026-09-22 (second review): the 30% figure and "human in the loop" (with "human
   * QA" and "reviewed by ear") left every public page. Both survive on the gated investor
   * page only, which keeps its model. Rendered markup, head metadata included, for the three
   * pages that carried them.
   */
  const rendered: [string, () => Promise<string>][] = [
    ['/', async () => renderToStaticMarkup(await Home())],
    ['/pricing', async () => renderToStaticMarkup(createElement(Pricing))],
    ['/artists', async () => renderToStaticMarkup(await ArtistsPage({ searchParams: Promise.resolve({}) }))],
  ]

  it.each(rendered)('%s never says 30%%', async (_path, render) => {
    const html = await render()
    expect(html).not.toContain('30%')
    expect(html).not.toContain('30 per cent')
  })

  it.each(rendered)('%s never claims a human in the loop', async (_path, render) => {
    const html = await render()
    expect(html).not.toMatch(/human in the loop|human qa|human ear|by ear/i)
  })

  it('/artists metadata carries neither', () => {
    expect(artistsMeta.description).not.toMatch(/30%|human/i)
  })
})
