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
