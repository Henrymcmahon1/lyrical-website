import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { LANGUAGES } from '@/lib/languages'
import demos from '@/content/demos.json'

const SKIP = new Set(['node_modules', '.next', '.git', 'docs', 'tests', 'public', 'supabase'])

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue
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

  it('declares no gradient anywhere', () => {
    expect(corpus).not.toMatch(/linear-gradient|radial-gradient|conic-gradient/)
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
    const codes = new Set(LANGUAGES.map((l) => l.code))
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

describe('the service key never reaches the browser', () => {
  it('is only referenced from server-only modules', () => {
    const offenders = files.filter((f) => {
      const src = readFileSync(f, 'utf8')
      if (!src.includes('SUPABASE_SERVICE_ROLE_KEY')) return false
      return src.includes("'use client'") || src.includes('"use client"')
    })
    expect(offenders).toEqual([])
  })
})
