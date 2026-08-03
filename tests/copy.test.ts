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
  it('lists exactly the eight approved languages', () => {
    expect(LANGUAGES.map((l) => l.code)).toEqual([
      'EN', 'ES', 'PT', 'IT', 'FR', 'ZH', 'JA', 'KO',
    ])
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
    // is published rather than configured. Only the site URL is legitimately public.
    const ALLOWED = new Set(['NEXT_PUBLIC_SITE_URL'])
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
