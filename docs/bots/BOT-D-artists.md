# Bot D: Artists (Door 1 on the website: `/artists`, calculator, EOI form)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Paste this to start the session:**
> Read `docs/superpowers/specs/2026-09-22-two-doors-v2-design.md` then `docs/bots/BOT-D-artists.md` in `C:\Users\User\CascadeProjects\lyrical-website`. Work on branch `feat/v2-artists` off `develop`. Never touch `main`. Bot 0 has merged: take every artist-facing string from `docs/v2/copy-deck.md` verbatim. Execute the brief task by task, tests first.

**Goal:** Ship `/artists`: the Door-1 pitch (terms, Coffey precedent, human in the loop, lossless stems), a pure tested earnings calculator whose worked example renders without JavaScript, and an expression-of-interest form that lands in the existing `enquiries` table with `source = 'artist_eoi'` and shows in `/queue?tab=enquiries` (where `/leads` redirects) like any other enquiry.

**Architecture:** One new indexable page, two components, two pure modules, no new tables. The EOI form reuses the whole enquiry pipeline: with JavaScript it posts JSON to the existing `POST /api/enquiry` exactly as `components/EnquiryForm.tsx` does, with the artist-only answers folded into `message` as labelled lines by `toEnquiry()` in `lib/eoi-schema.ts`. Without JavaScript it posts natively to a tiny adapter `app/artists/eoi/route.ts`, which does the same mapping on the server, re-posts as the multipart form the enquiry route already accepts, and redirects back to `/artists?eoi=sent`. Turnstile is verified inside the enquiry route only for `source = 'artist_eoi'` on the JSON path, so `/contact` and the no-JS path behave exactly as today.

**Tech Stack:** Next 16 (App Router, async `searchParams`), React 19, TypeScript, zod 4, Vitest (`react-dom/server` for the render test), Tailwind 4, existing `supabaseAdmin()` and Resend via the existing route.

**Spec:** `docs/superpowers/specs/2026-09-22-two-doors-v2-design.md` (§8 scope, §11 ownership, §12 constraints)

## Global Constraints

- Branch `feat/v2-artists` off `develop`. PR into `develop`. Never touch `main`, the `lyrical-website` Vercel project or lyricalglobal.com.
- No em dashes anywhere: code, comments, copy, tests, commit messages. `tests/copy.test.ts` scans `app/`, `components/`, `content/` and fails the build on one.
- Do not edit `components/Nav.tsx`, `app/sitemap.ts`, `app/robots.ts`, `components/Footer.tsx` (Bot B owns them and adds the "For artists" link). Say in the PR body that `/artists` needs a sitemap entry from Bot B.
- You own (§11): `app/artists/**`, `components/EarningsCalculator.tsx`, `components/ArtistEoiForm.tsx`, `lib/earnings.ts`, `lib/eoi-schema.ts`, `tests/earnings*.test.ts`, `tests/eoi*.test.ts`. The one shared edit is Task 4's Turnstile block in `app/api/enquiry/route.ts` (no other bot owns it); nothing else in that route changes.
- Brand (`CLAUDE.md`): cream, graphite, indigo, ember. No gradients. Ember never carries body text. Fraunces (`font-brand`) for headings, Archivo otherwise. Lowercase `lyrical` everywhere, sentence-initial included. US spelling in copy (catalog, license, authorized); identifiers keep theirs (`catalogue_size` is a live column). Banned: "AI-generated", "6.4x", "2.38B", "Solutions". Say re-sung, recreated, performed.
- Readable and submittable with JavaScript disabled. The calculator renders its worked example server-side.
- Every calculator number carries the word estimate in its label or caption, and the copy-deck caveat sits under the tiles. The 30% and $0 upfront are the terms from the copy deck and are labelled as terms.
- No secrets in files. `npm test && npm run build` green before the PR.

## File structure

| File | Responsibility |
|---|---|
| `lib/earnings.ts` | `estimateEarnings()` pure, three labelled constants, clamps, `usd()`, `WORKED_EXAMPLE` |
| `tests/earnings.test.ts` | exact numbers, clamps, songs is not a multiplier |
| `components/EarningsCalculator.tsx` | client; inputs, tiles, worked example on first paint from `initial` |
| `lib/eoi-schema.ts` | `EoiSchema`, `STREAM_BANDS`, `EOI_ROLES`, `ARTIST_EOI_SOURCE`, `toEnquiry()` |
| `tests/eoi-schema.test.ts` | schema + mapper (labelled lines, links cap, enquiry-compatible) |
| `app/api/enquiry/route.ts` | ADD ONLY: Turnstile check for `source = 'artist_eoi'` on the JSON path |
| `app/artists/eoi/route.ts` | no-JS adapter: native EOI post to enquiry form post, redirect to `/artists` |
| `tests/eoi-route.test.ts` | adapter writes `artist_eoi` and redirects; Turnstile gate on JSON only |
| `components/ArtistEoiForm.tsx` | client; native form, fetch upgrade, Turnstile, honeypot, success copy |
| `app/artists/page.tsx` | hero, Door 1 vs 2 table, how it works, calculator, EOI, metadata, JSON-LD |
| `tests/artists-page.test.tsx` | renders the page to HTML, asserts the worked-example numbers and copy |

---

### Task 1: Branch and `lib/earnings.ts`

**Files:** Create `lib/earnings.ts`, `tests/earnings.test.ts`

**Interfaces:** Produces `PAYOUT_PER_STREAM_USD`, `PAYOUT_LABEL`, `ARTIST_SHARE`, `LYRICAL_SHARE`, `EarningsInput`, `EarningsEstimate`, `estimateEarnings(input)`, `clampLanguages(n)`, `clampAudienceShare(x)`, `usd(n)`, `WORKED_EXAMPLE`.

- [ ] **Step 1: Branch** `git checkout develop && git pull && git checkout -b feat/v2-artists`

- [ ] **Step 2: Failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { ARTIST_SHARE, LYRICAL_SHARE, PAYOUT_PER_STREAM_USD, WORKED_EXAMPLE, clampAudienceShare, clampLanguages, estimateEarnings, usd } from '@/lib/earnings'

describe('estimateEarnings', () => {
  it('uses the locked constants', () => {
    expect([PAYOUT_PER_STREAM_USD, ARTIST_SHARE, LYRICAL_SHARE]).toEqual([0.004, 0.7, 0.3])
  })
  it('100,000 monthly streams, 2 languages, 20% share = 1,920 extra a year', () => {
    // 100000 * 12 * 0.2 * 2 * 0.004 = 1920. Artist 70% = 1344. lyrical 30% = 576.
    const e = estimateEarnings({ monthlyStreams: 100_000, songs: 12, languages: 2, audienceShare: 0.2 })
    expect([e.extraAnnualReceipts, e.artistAnnual, e.lyricalAnnual, e.perLanguage]).toEqual([1920, 1344, 576, 960])
    expect(estimateEarnings(WORKED_EXAMPLE).extraAnnualReceipts).toBe(1920)
  })
  it('songs is context, not a multiplier', () => {
    const a = estimateEarnings({ monthlyStreams: 50_000, songs: 1, languages: 1, audienceShare: 0.2 })
    const b = estimateEarnings({ monthlyStreams: 50_000, songs: 40, languages: 1, audienceShare: 0.2 })
    expect(a.extraAnnualReceipts).toBe(480); expect(b.extraAnnualReceipts).toBe(480)
  })
  it('clamps languages to 1..3 and audience share to 0.05..1', () => {
    expect([clampLanguages(0), clampLanguages(7), clampLanguages(2.6)]).toEqual([1, 3, 3])
    expect([clampAudienceShare(0), clampAudienceShare(4)]).toEqual([0.05, 1])
    expect(estimateEarnings({ monthlyStreams: 1000, songs: 1, languages: 9, audienceShare: 9 }).extraAnnualReceipts).toBe(144)
  })
  it('never goes negative, rounds money to cents, formats whole dollars', () => {
    expect(estimateEarnings({ monthlyStreams: -5, songs: 1, languages: 1, audienceShare: 0.2 }).extraAnnualReceipts).toBe(0)
    expect(estimateEarnings({ monthlyStreams: 1234, songs: 1, languages: 1, audienceShare: 0.2 }).artistAnnual).toBe(8.29)
    expect([usd(1920), usd(0), usd(1343.6)]).toEqual(['$1,920', '$0', '$1,344'])
  })
})
```

- [ ] **Step 3: Run, expect FAIL** `npx vitest run tests/earnings.test.ts`

- [ ] **Step 4: Implement**

```ts
/**
 * The Door-1 earnings estimate. Pure, no I/O.
 *
 * Every output is an ESTIMATE from a public blended payout figure and the visitor's inputs.
 * The page says so next to every number; this module says so in its names.
 *
 * `songs` is displayed context, not a multiplier. `monthlyStreams` is already the whole
 * catalog's monthly streams, so multiplying by the song count would double count.
 */
export const PAYOUT_PER_STREAM_USD = 0.004
export const PAYOUT_LABEL = 'industry blended average, 2026, estimate'
export const ARTIST_SHARE = 0.7
export const LYRICAL_SHARE = 0.3
export const MIN_LANGUAGES = 1
export const MAX_LANGUAGES = 3
export const MIN_AUDIENCE_SHARE = 0.05
export const MAX_AUDIENCE_SHARE = 1
export const DEFAULT_AUDIENCE_SHARE = 0.2

export type EarningsInput = { monthlyStreams: number; songs: number; languages: number; audienceShare: number }
export type EarningsEstimate = {
  extraAnnualReceipts: number; artistAnnual: number; lyricalAnnual: number; perLanguage: number
  languages: number; audienceShare: number; songs: number
}

export const WORKED_EXAMPLE: EarningsInput = { monthlyStreams: 100_000, songs: 12, languages: 2, audienceShare: DEFAULT_AUDIENCE_SHARE }

const cents = (n: number) => Math.round(n * 100) / 100

export function clampLanguages(n: number): number {
  const whole = Number.isFinite(n) ? Math.round(n) : MIN_LANGUAGES
  return Math.min(MAX_LANGUAGES, Math.max(MIN_LANGUAGES, whole))
}
export function clampAudienceShare(x: number): number {
  const v = Number.isFinite(x) ? x : DEFAULT_AUDIENCE_SHARE
  return Math.min(MAX_AUDIENCE_SHARE, Math.max(MIN_AUDIENCE_SHARE, v))
}

export function estimateEarnings(input: EarningsInput): EarningsEstimate {
  const monthlyStreams = Number.isFinite(input.monthlyStreams) ? Math.max(0, input.monthlyStreams) : 0
  const songs = Number.isFinite(input.songs) ? Math.max(1, Math.round(input.songs)) : 1
  const languages = clampLanguages(input.languages)
  const audienceShare = clampAudienceShare(input.audienceShare)
  const extraAnnualReceipts = cents(monthlyStreams * 12 * audienceShare * languages * PAYOUT_PER_STREAM_USD)
  return {
    extraAnnualReceipts,
    artistAnnual: cents(extraAnnualReceipts * ARTIST_SHARE),
    lyricalAnnual: cents(extraAnnualReceipts * LYRICAL_SHARE),
    perLanguage: cents(extraAnnualReceipts / languages),
    languages, audienceShare, songs,
  }
}

/** Whole US dollars, en-US grouping, identical on the server and in the browser. */
export function usd(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}
```

- [ ] **Step 5: Run, expect PASS.** `git add lib/earnings.ts tests/earnings.test.ts && git commit -m "feat(artists): pure Door-1 earnings estimate with tests"`

### Task 2: `components/EarningsCalculator.tsx`

**Files:** Create `components/EarningsCalculator.tsx`

**Interfaces:** Consumes Task 1. Produces `EarningsCalculator({ initial })`, a client component whose first paint equals `estimateEarnings(initial)`, so the server HTML is the no-JS worked example and hydration matches.

- [ ] **Step 1: Write the component**

```tsx
'use client'

import { useState } from 'react'
import { DEFAULT_AUDIENCE_SHARE, MAX_AUDIENCE_SHARE, MAX_LANGUAGES, MIN_AUDIENCE_SHARE, MIN_LANGUAGES, PAYOUT_LABEL, PAYOUT_PER_STREAM_USD, estimateEarnings, usd, type EarningsInput } from '@/lib/earnings'

const field = 'w-full rounded-card border border-graphite/25 bg-transparent px-4 py-3 outline-none transition-colors focus-visible:border-indigo'
const tile = 'rounded-card border border-graphite/15 p-5'
const label = 'font-mono text-[11px] uppercase tracking-[0.18em] text-graphite/50'

/**
 * State starts at `initial`, so the server renders the worked example and the client hydrates
 * to the same numbers. With JavaScript off the visitor sees a real, labelled estimate and
 * inert controls: no blank tiles, no "loading".
 */
export function EarningsCalculator({ initial }: { initial: EarningsInput }) {
  const [input, setInput] = useState<EarningsInput>(initial)
  const e = estimateEarnings(input)
  const set = (patch: Partial<EarningsInput>) => setInput((v) => ({ ...v, ...patch }))
  const pct = Math.round(e.audienceShare * 100)

  return (
    <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <form className="flex flex-col gap-5" onSubmit={(ev) => ev.preventDefault()} aria-label="Earnings calculator inputs">
        <label className="flex flex-col gap-2">
          <span className="text-sm">Monthly streams across all platforms</span>
          <input type="number" name="monthlyStreams" inputMode="numeric" min={0} step={1000} value={input.monthlyStreams} onChange={(ev) => set({ monthlyStreams: Number(ev.target.value) })} className={field} />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm">Songs in your catalog <span className="text-graphite/55">(context only, not a multiplier)</span></span>
          <input type="number" name="songs" inputMode="numeric" min={1} step={1} value={input.songs} onChange={(ev) => set({ songs: Number(ev.target.value) })} className={field} />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm">Languages you want</span>
          <select name="languages" value={input.languages} onChange={(ev) => set({ languages: Number(ev.target.value) })} className={field}>
            {Array.from({ length: MAX_LANGUAGES - MIN_LANGUAGES + 1 }, (_, i) => MIN_LANGUAGES + i).map((n) => <option key={n} value={n} className="text-graphite">{n}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm">New-language audience as a share of your current one: <strong>{pct}%</strong> <span className="text-graphite/55">(an assumption, default {Math.round(DEFAULT_AUDIENCE_SHARE * 100)}%)</span></span>
          <input type="range" name="audienceShare" min={MIN_AUDIENCE_SHARE * 100} max={MAX_AUDIENCE_SHARE * 100} step={5} value={pct} onChange={(ev) => set({ audienceShare: Number(ev.target.value) / 100 })} className="accent-indigo" />
        </label>
        <p className="text-sm text-graphite/55">Payout used: {PAYOUT_PER_STREAM_USD.toFixed(3)} US dollars per stream ({PAYOUT_LABEL}).</p>
      </form>

      <div className="grid gap-4 sm:grid-cols-2" aria-live="polite">
        <div className={`${tile} sm:col-span-2`}>
          <p className={label}>Estimated extra net receipts per year</p>
          <p className="mt-2 font-brand text-4xl" data-testid="extra-annual">{usd(e.extraAnnualReceipts)}</p>
          <p className="mt-1 text-sm text-graphite/55">estimate, across {e.languages} {e.languages === 1 ? 'language' : 'languages'}, {usd(e.perLanguage)} per language estimate</p>
        </div>
        <div className={tile}><p className={label}>Your 70%, estimate</p><p className="mt-2 font-brand text-3xl" data-testid="artist-annual">{usd(e.artistAnnual)}</p></div>
        <div className={tile}><p className={label}>lyrical&rsquo;s 30%, estimate</p><p className="mt-2 font-brand text-3xl" data-testid="lyrical-annual">{usd(e.lyricalAnnual)}</p></div>
        <div className={`${tile} sm:col-span-2`}><p className={label}>Upfront cost (the terms, not an estimate)</p><p className="mt-2 font-brand text-3xl">$0 upfront</p></div>
        <p className="text-sm leading-relaxed text-graphite/55 sm:col-span-2">
          Every number here is an estimate from public payout averages and your own inputs. Real receipts depend on the songs, the markets and the release.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check** `npx tsc --noEmit`, then `git add components/EarningsCalculator.tsx && git commit -m "feat(artists): earnings calculator with server-rendered worked example"`

### Task 3: `lib/eoi-schema.ts`

**Files:** Create `lib/eoi-schema.ts`, `tests/eoi-schema.test.ts`

**Interfaces:** Consumes `CATALOGUE_SIZES` (`lib/enquiry-schema.ts`), `LANGUAGE_CODES` (`lib/languages.ts`). Produces `ARTIST_EOI_SOURCE = 'artist_eoi'`, `EOI_ROLES`, `STREAM_BANDS`, `STREAM_BAND_LABELS`, `MAX_LINKS = 3`, `EoiSchema`, `EoiInput`, `EnquiryPayload`, `toEnquiry(input)`.

- [ ] **Step 1: Failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { ARTIST_EOI_SOURCE, EoiSchema, toEnquiry } from '@/lib/eoi-schema'
import { EnquirySchema } from '@/lib/enquiry-schema'

const valid = {
  name: 'Coffey Anderson', artistName: 'Coffey Anderson', email: 'Coffey@Example.com', role: 'artist',
  catalogue_size: '11-100', monthlyStreamsBand: '100k-1m', target_languages: ['ES', 'PT'],
  links: 'https://open.spotify.com/artist/abc\nhttps://instagram.com/coffey', message: 'Ready when you are.',
}

describe('EoiSchema', () => {
  it('accepts a full submission, lowercases the email, splits links by line', () => {
    const r = EoiSchema.safeParse(valid)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.email).toBe('coffey@example.com')
      expect(r.data.links).toEqual(['https://open.spotify.com/artist/abc', 'https://instagram.com/coffey'])
    }
  })
  it('requires name, artist name, email and a streams band', () => {
    for (const bad of [{ name: '' }, { artistName: '' }, { email: 'nope' }, { monthlyStreamsBand: '' }]) {
      expect(EoiSchema.safeParse({ ...valid, ...bad }).success).toBe(false)
    }
  })
  it('accepts links as an array, caps at three, rejects non-http', () => {
    expect(EoiSchema.safeParse({ ...valid, links: ['https://a.example', 'https://b.example'] }).success).toBe(true)
    expect(EoiSchema.safeParse({ ...valid, links: 'https://a.example\nhttps://b.example\nhttps://c.example\nhttps://d.example' }).success).toBe(false)
    expect(EoiSchema.safeParse({ ...valid, links: 'not a url' }).success).toBe(false)
    expect(EoiSchema.safeParse({ ...valid, links: 'javascript:alert(1)' }).success).toBe(false)
  })
  it('maps a blank role to other, a blank catalog size to undefined, rejects unknown languages', () => {
    const r = EoiSchema.safeParse({ ...valid, role: '', catalogue_size: '' })
    expect(r.success && r.data.role).toBe('other')
    expect(r.success && r.data.catalogue_size).toBeUndefined()
    expect(EoiSchema.safeParse({ ...valid, target_languages: ['XX'] }).success).toBe(false)
  })
})

describe('toEnquiry', () => {
  const d = EoiSchema.parse(valid)
  it('produces a payload the enquiry route accepts, tagged artist_eoi, act in company', () => {
    const p = toEnquiry(d)
    expect(p.source).toBe(ARTIST_EOI_SOURCE)
    expect(p.company).toBe('Coffey Anderson')
    expect(EnquirySchema.safeParse({ ...p, elapsed_ms: 9000, website: '' }).success).toBe(true)
  })
  it('folds the artist answers into the message as labelled lines, then the free text', () => {
    expect(toEnquiry(d).message).toBe(
      'Artist or act: Coffey Anderson\nMonthly streams: 100k to 1m\nLinks: https://open.spotify.com/artist/abc | https://instagram.com/coffey\n\nReady when you are.',
    )
    expect(toEnquiry(EoiSchema.parse({ ...valid, links: '', message: '' })).message)
      .toBe('Artist or act: Coffey Anderson\nMonthly streams: 100k to 1m\nLinks: -')
  })
})
```

- [ ] **Step 2: Run, expect FAIL** `npx vitest run tests/eoi-schema.test.ts`

- [ ] **Step 3: Implement**

```ts
import { z } from 'zod'
import { CATALOGUE_SIZES } from './enquiry-schema'
import { LANGUAGE_CODES } from './languages'

/**
 * The artist expression of interest: an enquiry with three extra answers, stored as one.
 * `enquiries` has no artist columns and this round adds none. `toEnquiry` folds the extras
 * into `message` as labelled lines (readable in the inbox and in /queue?tab=enquiries) and
 * puts the act's name in `company`, which that tab already shows.
 */
export const ARTIST_EOI_SOURCE = 'artist_eoi'
export const EOI_ROLES = ['artist', 'manager', 'label', 'other'] as const
export const STREAM_BANDS = ['<10k', '10k-100k', '100k-1m', '1m+'] as const
export const STREAM_BAND_LABELS: Record<(typeof STREAM_BANDS)[number], string> = {
  '<10k': 'under 10k', '10k-100k': '10k to 100k', '100k-1m': '100k to 1m', '1m+': '1m or more',
}
export const MAX_LINKS = 3

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(''))
const blankToUndefined = (v: unknown) => (v === '' || v == null ? undefined : v)
/** A textarea gives one string, one per line; the JSON path may give an array. Both become a clean array. */
const linksToArray = (v: unknown): string[] => {
  const raw = Array.isArray(v) ? v.map(String) : typeof v === 'string' ? v.split(/[\r\n,\s]+/) : []
  return raw.map((s) => s.trim()).filter(Boolean)
}

export const EoiSchema = z.object({
  name: z.string().trim().min(2, 'Please tell us your name').max(120),
  artistName: z.string().trim().min(1, 'Please tell us the artist or act').max(160),
  email: z.string().trim().toLowerCase().email('That email address does not look right'),
  role: z.preprocess((v) => (v === '' || v == null ? 'other' : v), z.enum(EOI_ROLES)),
  catalogue_size: z.preprocess(blankToUndefined, z.enum(CATALOGUE_SIZES).optional()),
  monthlyStreamsBand: z.enum(STREAM_BANDS, { message: 'Pick a monthly streams band' }),
  target_languages: z.array(z.string().refine((c) => LANGUAGE_CODES.includes(c), 'Unknown language')).max(8).optional(),
  links: z.preprocess(
    linksToArray,
    z.array(z.string().max(300).url().refine((u) => /^https?:\/\//i.test(u), 'Links must start with http')).max(MAX_LINKS, `Up to ${MAX_LINKS} links`),
  ),
  message: optionalText(3000),
})
export type EoiInput = z.infer<typeof EoiSchema>

/** Exactly the fields `EnquirySchema` validates, minus the anti-spam ones the caller adds. */
export type EnquiryPayload = {
  name: string; email: string; role: (typeof EOI_ROLES)[number]; company: string; catalogue_size: string
  target_languages: string[]; message: string; source: typeof ARTIST_EOI_SOURCE; unlocked_audio: false
}

export function toEnquiry(d: EoiInput): EnquiryPayload {
  const lines = [
    `Artist or act: ${d.artistName}`,
    `Monthly streams: ${STREAM_BAND_LABELS[d.monthlyStreamsBand]}`,
    `Links: ${d.links.length ? d.links.join(' | ') : '-'}`,
  ]
  const free = d.message?.trim() ?? ''
  return {
    name: d.name, email: d.email, role: d.role, company: d.artistName,
    catalogue_size: d.catalogue_size ?? '', target_languages: d.target_languages ?? [],
    message: free ? `${lines.join('\n')}\n\n${free}` : lines.join('\n'),
    source: ARTIST_EOI_SOURCE, unlocked_audio: false,
  }
}
```

- [ ] **Step 4: Run, expect PASS.** `git add lib/eoi-schema.ts tests/eoi-schema.test.ts && git commit -m "feat(artists): EOI schema and enquiry mapper with tests"`

### Task 4: Turnstile gate in the enquiry route, and the no-JS adapter

**Files:** Modify `app/api/enquiry/route.ts` (two imports, one block after `const d = parsed.data`). Create `app/artists/eoi/route.ts`, `tests/eoi-route.test.ts`.

**Interfaces:** The enquiry route today has no Turnstile check (Turnstile guards studio sign-in and submit). This adds one for `source = 'artist_eoi'` on the JSON path only. `verifyTurnstile` is config-gated: no `TURNSTILE_SECRET_KEY` means `{ ok: true, skipped: true }`, so nothing changes until the keys exist. The native post (no JavaScript, so no widget) keeps the honeypot, elapsed-time floor and rate limit, like `/contact`. The adapter re-posts as multipart, calls the exported `POST` directly with forwarded headers so `clientKey` sees the real IP, then rewrites `/?enquiry=sent|error` to `/artists?eoi=sent|error#eoi`.

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const insert = vi.fn()
vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: () => ({ from: () => ({ insert: (...a: unknown[]) => insert(...a) }) }) }))
vi.mock('resend', () => ({ Resend: class { emails = { send: vi.fn().mockResolvedValue({}) } } }))

process.env.SUPABASE_URL = 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
process.env.ENQUIRY_TO_EMAIL = 'jordan@lyricalglobal.com'
process.env.ENQUIRY_FROM_EMAIL = 'onboarding@resend.dev'
process.env.RESEND_API_KEY = 'test-key'

const { POST: adapter } = await import('@/app/artists/eoi/route')
const { POST: enquiry } = await import('@/app/api/enquiry/route')
const { resetAllLimits } = await import('@/lib/rate-limit')
const { toEnquiry, EoiSchema } = await import('@/lib/eoi-schema')

const fields: Record<string, string> = {
  name: 'Coffey Anderson', artistName: 'Coffey Anderson', email: 'coffey@example.com', role: 'artist',
  catalogue_size: '11-100', monthlyStreamsBand: '100k-1m', links: 'https://open.spotify.com/artist/abc',
  message: 'Ready when you are.', elapsed_ms: '9000', website: '',
}
const formPost = (extra: Record<string, string> = {}) => {
  const fd = new FormData()
  for (const [k, v] of Object.entries({ ...fields, ...extra })) fd.set(k, v)
  fd.append('target_languages', 'ES')
  return adapter(new Request('http://localhost:3000/artists/eoi', { method: 'POST', body: fd, headers: { 'x-forwarded-for': '203.0.113.9' } }))
}
const jsonPost = (body: unknown) =>
  enquiry(new Request('http://localhost:3000/api/enquiry', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }))

beforeEach(() => { insert.mockReset(); insert.mockResolvedValue({ error: null }); resetAllLimits() })
afterEach(() => { vi.unstubAllEnvs() })

describe('POST /artists/eoi (the no-JS path)', () => {
  it('writes an artist_eoi enquiry with the labelled lines and redirects back to /artists', async () => {
    const res = await formPost()
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('http://localhost:3000/artists?eoi=sent#eoi')
    expect(insert).toHaveBeenCalledOnce()
    expect(insert.mock.calls[0][0]).toMatchObject({ source: 'artist_eoi', company: 'Coffey Anderson', target_languages: ['ES'], email: 'coffey@example.com' })
    expect(insert.mock.calls[0][0].message).toContain('Monthly streams: 100k to 1m')
    expect(insert.mock.calls[0][0].message).toContain('Links: https://open.spotify.com/artist/abc')
  })
  it('redirects to the error state on an invalid submission or a filled honeypot, writing nothing', async () => {
    for (const bad of [{ email: 'nope' }, { website: 'http://spam.example' }]) {
      const res = await formPost(bad)
      expect(res.status).toBe(303)
      expect(res.headers.get('location')).toBe('http://localhost:3000/artists?eoi=error#eoi')
    }
    expect(insert).not.toHaveBeenCalled()
  })
})

describe('Turnstile on the JSON path', () => {
  const payload = { ...toEnquiry(EoiSchema.parse({ ...fields, target_languages: ['ES'] })), elapsed_ms: 9000, website: '' }
  it('is skipped when unconfigured', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '')
    expect((await jsonPost(payload)).status).toBe(200)
  })
  it('rejects an artist_eoi JSON post with no token when configured', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret')
    expect((await jsonPost(payload)).status).toBe(400)
    expect(insert).not.toHaveBeenCalled()
  })
  it('does not gate other sources (the contact form sends no token)', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret')
    expect((await jsonPost({ ...payload, source: 'contact' })).status).toBe(200)
  })
})
```

- [ ] **Step 2: Run, expect FAIL** `npx vitest run tests/eoi-route.test.ts`

- [ ] **Step 3: Add the gate to `app/api/enquiry/route.ts`**

Two imports beside the existing ones:

```ts
import { ARTIST_EOI_SOURCE } from '@/lib/eoi-schema'
import { verifyTurnstile } from '@/lib/turnstile'
```

Insert directly after `const d = parsed.data`, before the `record` line:

```ts
  /**
   * Turnstile, for the artist EOI only and only on the JavaScript path (2026-09-22, Bot D).
   * The widget cannot exist without JavaScript, so the native form post keeps the honeypot,
   * the elapsed-time floor and the rate limit, exactly as /contact does. `verifyTurnstile`
   * is config-gated: with no secret it passes, so nothing changes until the keys land.
   * The token is read off the raw body because `EnquirySchema` strips unknown keys.
   */
  if (!isFormPost && d.source === ARTIST_EOI_SOURCE) {
    const body = raw as { turnstile_token?: unknown } | null
    const token = typeof body?.turnstile_token === 'string' ? body.turnstile_token : ''
    const remoteip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    const check = await verifyTurnstile(token, { remoteip })
    if (!check.ok) return json({ error: 'Please complete the check and send again.' }, 400)
  }
```

- [ ] **Step 4: Write `app/artists/eoi/route.ts`**

```ts
import { POST as enquiryPost } from '@/app/api/enquiry/route'
import { EoiSchema, toEnquiry } from '@/lib/eoi-schema'

export const runtime = 'nodejs'

/**
 * The no-JavaScript path for the artist EOI form.
 *
 * With JavaScript the form maps its answers with `toEnquiry` in the browser and posts JSON to
 * /api/enquiry. Without it the browser posts here natively; this route does the same mapping
 * on the server, re-posts as the multipart form the enquiry route already accepts (honeypot,
 * elapsed-time floor, rate limit, storage and email all reused, untouched), then sends the
 * visitor back to /artists with a state the page renders. Headers are forwarded so
 * `clientKey` sees the real IP. A filled honeypot fails `website: z.literal('')` in the
 * enquiry schema, so it comes back as `enquiry=error` and nothing is written.
 */
const FORWARD = ['x-forwarded-for', 'x-real-ip', 'user-agent', 'referer'] as const

export async function POST(request: Request) {
  const back = (state: 'sent' | 'error') =>
    new Response(null, { status: 303, headers: { location: new URL(`/artists?eoi=${state}#eoi`, request.url).toString() } })

  const fd = await request.formData()
  const parsed = EoiSchema.safeParse({ ...Object.fromEntries(fd.entries()), target_languages: fd.getAll('target_languages').map(String) })
  if (!parsed.success) return back('error')

  const m = toEnquiry(parsed.data)
  const out = new FormData()
  for (const [k, v] of Object.entries({ name: m.name, email: m.email, role: m.role, company: m.company, catalogue_size: m.catalogue_size, message: m.message, source: m.source })) out.set(k, v)
  for (const code of m.target_languages) out.append('target_languages', code)
  out.set('elapsed_ms', String(fd.get('elapsed_ms') ?? ''))
  out.set('website', String(fd.get('website') ?? ''))

  const headers = new Headers()
  for (const h of FORWARD) { const v = request.headers.get(h); if (v) headers.set(h, v) }

  const res = await enquiryPost(new Request(new URL('/api/enquiry', request.url), { method: 'POST', body: out, headers }))
  const location = res.headers.get('location') ?? ''
  return back(res.status === 303 && location.includes('enquiry=sent') ? 'sent' : 'error')
}
```

- [ ] **Step 5: Run, expect PASS.** Then the old suite still passes: `npx vitest run tests/enquiry-route.test.ts tests/enquiry-schema.test.ts tests/turnstile.test.ts`. Commit: `git add app/api/enquiry/route.ts app/artists/eoi/route.ts tests/eoi-route.test.ts && git commit -m "feat(artists): EOI no-JS adapter; Turnstile on artist_eoi JSON posts"`

### Task 5: `components/ArtistEoiForm.tsx`

**Files:** Create `components/ArtistEoiForm.tsx`

**Interfaces:** Consumes Task 3, `CATALOGUE_SIZES`, `LANGUAGES`, the `Turnstile` component, `CONTACT_EMAIL` and `enquiryMailto` from `lib/enquiry-email`. Produces `ArtistEoiForm({ siteKey, initialState })`: `siteKey` from the server page via `turnstileSiteKey()`; `initialState` is `'sent' | 'error' | undefined` from `?eoi=` for the no-JS round trip.

- [ ] **Step 1: Write the component**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Turnstile } from '@/components/Turnstile'
import { CONTACT_EMAIL, enquiryMailto } from '@/lib/enquiry-email'
import { CATALOGUE_SIZES } from '@/lib/enquiry-schema'
import { EOI_ROLES, EoiSchema, STREAM_BANDS, STREAM_BAND_LABELS, toEnquiry } from '@/lib/eoi-schema'
import { LANGUAGES } from '@/lib/languages'

const ROLE_LABELS: Record<(typeof EOI_ROLES)[number], string> = { artist: 'The artist', manager: 'A manager', label: 'A label', other: 'Something else' }
const SIZE_LABELS: Record<(typeof CATALOGUE_SIZES)[number], string> = { '1': 'One song', '2-10': '2 to 10', '11-100': '11 to 100', '100+': '100 or more', unsure: 'Not sure yet' }
const field = 'w-full rounded-card border border-graphite/25 bg-transparent px-4 py-3 outline-none transition-colors focus-visible:border-indigo'
const chip = 'nudge inline-flex min-h-11 cursor-pointer items-center rounded-card border border-graphite/25 px-3 text-sm transition-colors has-checked:border-ember has-checked:text-ember'
const opt = 'text-graphite'

/**
 * Native <form method="post" action="/artists/eoi"> so it submits with JavaScript disabled;
 * JS upgrades it to a JSON post to /api/enquiry, the EnquiryForm pattern, with the mapping
 * done by toEnquiry so both paths write the identical row.
 */
export function ArtistEoiForm({ siteKey, initialState }: { siteKey: string | null; initialState?: 'sent' | 'error' }) {
  const mountedAt = useRef(0)
  useEffect(() => { mountedAt.current = Date.now() }, [])
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>(initialState === 'sent' ? 'done' : initialState === 'error' ? 'error' : 'idle')
  const [error, setError] = useState(initialState === 'error' ? 'Something in the form did not look right. Please check it and send again.' : '')
  const [fallbackHref, setFallbackHref] = useState('')
  const [token, setToken] = useState('')

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState('sending'); setError(''); setFallbackHref('')
    const fd = new FormData(e.currentTarget)
    const parsed = EoiSchema.safeParse({ ...Object.fromEntries(fd.entries()), target_languages: fd.getAll('target_languages').map(String) })
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Please check the form.'); setState('error'); return }
    const body = {
      ...toEnquiry(parsed.data),
      website: String(fd.get('website') ?? ''),
      elapsed_ms: mountedAt.current ? Date.now() - mountedAt.current : 10_000,
      turnstile_token: token,
    }
    try {
      const res = await fetch('/api/enquiry', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      if (res.ok) { setState('done'); return }
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      setError(j.error ?? 'Something went wrong.')
      if (res.status >= 500) setFallbackHref(enquiryMailto(body, CONTACT_EMAIL))
      setState('error')
    } catch {
      setError('We could not reach the server.'); setFallbackHref(enquiryMailto(body, CONTACT_EMAIL)); setState('error')
    }
  }

  if (state === 'done') {
    return (
      <div>
        <p className="font-brand text-2xl leading-snug">Thank you. A person will reply within one working day.</p>
        <p className="mt-3 text-sm text-graphite/55">We will ask which song to start with and which language first. If it is urgent, reach us at {CONTACT_EMAIL}.</p>
      </div>
    )
  }

  return (
    <form method="post" action="/artists/eoi" onSubmit={submit} className="flex flex-col gap-5">
      <input type="hidden" name="elapsed_ms" value={9999} />
      <div aria-hidden="true" className="absolute h-0 w-0 overflow-hidden opacity-0">
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" defaultValue="" /></label>
      </div>
      <label className="flex flex-col gap-2"><span className="text-sm">Your name</span><input name="name" required minLength={2} autoComplete="name" className={field} /></label>
      <label className="flex flex-col gap-2"><span className="text-sm">Artist or act</span><input name="artistName" required className={field} /></label>
      <label className="flex flex-col gap-2"><span className="text-sm">Email</span><input name="email" type="email" required autoComplete="email" className={field} /></label>
      <label className="flex flex-col gap-2"><span className="text-sm">You are</span>
        <select name="role" defaultValue="" className={field}>
          <option value="" className={opt}>Prefer not to say</option>
          {EOI_ROLES.map((r) => <option key={r} value={r} className={opt}>{ROLE_LABELS[r]}</option>)}
        </select></label>
      <label className="flex flex-col gap-2"><span className="text-sm">Songs in the catalog</span>
        <select name="catalogue_size" defaultValue="" className={field}>
          <option value="" className={opt}>Prefer not to say</option>
          {CATALOGUE_SIZES.map((s) => <option key={s} value={s} className={opt}>{SIZE_LABELS[s]}</option>)}
        </select></label>
      <label className="flex flex-col gap-2"><span className="text-sm">Monthly streams across all platforms</span>
        <select name="monthlyStreamsBand" required defaultValue="" className={field}>
          <option value="" disabled className={opt}>Choose a band</option>
          {STREAM_BANDS.map((b) => <option key={b} value={b} className={opt}>{STREAM_BAND_LABELS[b]}</option>)}
        </select></label>
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm">Languages you want</legend>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.filter((l) => l.code !== 'EN').map((l) => (
            <label key={l.code} className={chip}><input type="checkbox" name="target_languages" value={l.code} className="sr-only" />{l.endonym}</label>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-2"><span className="text-sm">Links <span className="text-graphite/55">(up to 3, one per line: streaming profile, socials, a release)</span></span><textarea name="links" rows={3} className={field} /></label>
      <label className="flex flex-col gap-2"><span className="text-sm">Anything else</span><textarea name="message" rows={4} className={field} /></label>

      <Turnstile siteKey={siteKey} action="artist-eoi" onVerify={setToken} onExpire={() => setToken('')} />

      {state === 'error' && (
        <div role="alert" className="flex flex-col gap-3">
          <p className="text-sm text-ember">{error}</p>
          {fallbackHref && (
            <a href={fallbackHref} className="nudge inline-flex min-h-11 items-center gap-1.5 self-start rounded-card border border-indigo px-5 text-indigo transition-colors hover:bg-indigo hover:text-cream">
              Send it as an email instead <span className="shift-arrow">&rarr;</span>
            </a>
          )}
        </div>
      )}
      <button type="submit" disabled={state === 'sending'} className="nudge self-start rounded-card bg-ember px-7 py-4 text-cream disabled:opacity-60">
        {state === 'sending' ? 'Sending' : 'Send'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Type-check** `npx tsc --noEmit`, then `git add components/ArtistEoiForm.tsx && git commit -m "feat(artists): EOI form, native post with JSON upgrade and Turnstile"`

### Task 6: `app/artists/page.tsx` and the render test

**Files:** Create `app/artists/page.tsx`, `tests/artists-page.test.tsx`

**Interfaces:** Consumes `EarningsCalculator`, `ArtistEoiForm`, `WORKED_EXAMPLE`, `turnstileSiteKey` (`lib/turnstile`), `ldJson` (`lib/structured-data`), `SITE_URL` (`lib/site`). Page signature `ArtistsPage({ searchParams }: { searchParams: Promise<{ eoi?: string }> })` (Next 16: async only).

- [ ] **Step 1: Failing render test**

```tsx
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { default: ArtistsPage, metadata } = await import('@/app/artists/page')
const render = async (eoi?: string) => renderToStaticMarkup(await ArtistsPage({ searchParams: Promise.resolve(eoi ? { eoi } : {}) }))

describe('/artists', () => {
  it('renders the worked example numbers without JavaScript', async () => {
    const html = await render()
    for (const s of ['$1,920', '$1,344', '$576', '$0 upfront']) expect(html).toContain(s)
  })
  it('carries the copy-deck strings verbatim and labels the estimates', async () => {
    const html = await render()
    for (const s of [
      'Your songs, in every language, in your voice.',
      'Our first signed artist is Coffey Anderson.',
      'What could a new language earn you?',
      'Register your interest',
      'Every number here is an estimate from public payout averages and your own inputs.',
      'industry blended average, 2026, estimate',
    ]) expect(html).toContain(s)
    expect((html.match(/estimate/g) ?? []).length).toBeGreaterThanOrEqual(5)
  })
  it('is indexable, canonical, and its JSON-LD is scoped to the organization', async () => {
    expect(metadata.alternates?.canonical).toBe('/artists')
    expect(metadata.robots).toEqual({ index: true, follow: true })
    const html = await render()
    expect(html).toContain('application/ld+json')
    expect(html).toContain('"@type":"WebPage"')
    expect(html).toContain('/#organization')
    expect(html).not.toContain('aggregateRating')
  })
  it('renders the no-JS sent state from the query string', async () => {
    expect(await render('sent')).toContain('A person will reply within one working day.')
  })
  it('has no em dash and no banned phrase', async () => {
    const html = await render()
    expect(html).not.toMatch(/\u2014|&mdash;/)
    expect(html).not.toMatch(/AI[-\s]generated/i)
  })
})
```

- [ ] **Step 2: Run, expect FAIL** `npx vitest run tests/artists-page.test.tsx`

- [ ] **Step 3: Write the page**

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArtistEoiForm } from '@/components/ArtistEoiForm'
import { EarningsCalculator } from '@/components/EarningsCalculator'
import { WORKED_EXAMPLE } from '@/lib/earnings'
import { SITE_URL } from '@/lib/site'
import { ldJson } from '@/lib/structured-data'
import { turnstileSiteKey } from '@/lib/turnstile'

const TITLE = 'For artists: your songs in every language, in your voice'
const DESCRIPTION =
  'Door 1 at lyrical. 30% of net streaming receipts on the new-language masters, perpetual and exclusive, ' +
  '$0 upfront. Lossless stems, a human in the loop, and nothing released without your approval.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/artists' },
  robots: { index: true, follow: true },
  openGraph: { title: `${TITLE} | lyrical`, description: DESCRIPTION, url: '/artists', type: 'website' },
}

/** JSON-LD scoped to what the page visibly says, the lib/structured-data.ts rule: no offers, no ratings. */
function artistsPageLd(origin: string) {
  return {
    '@context': 'https://schema.org', '@type': 'WebPage', '@id': `${origin}/artists#webpage`,
    url: `${origin}/artists`, name: TITLE, description: DESCRIPTION,
    isPartOf: { '@id': `${origin}/#website` }, about: { '@id': `${origin}/#organization` }, inLanguage: 'en',
  }
}

const STEPS = [
  { h: 'Send stems', p: 'Your finished master, the instrumental and the dry vocal stem. Nothing else is required.' },
  { h: 'We produce', p: 'The song is re-sung in your voice in the new language over your untouched backing. A person listens before anything moves.' },
  { h: 'You approve', p: 'You hear it first. Nothing is released without your sign-off, and you can send it back.' },
  { h: 'We release', p: 'You get 24-bit WAV stems, no watermark, with a commercial license, ready for your distributor.' },
  { h: '30% flows', p: '30% of net streaming receipts on the new-language masters goes to lyrical. 70% stays with you, forever.' },
]
const ROWS: [string, string, string][] = [
  ['Who', 'Signed career artists', 'Fans and hobbyists (beta)'],
  ['Terms', '30% of net receipts, $0 upfront', 'From $9 a track'],
  ['Output', '24-bit WAV stems, no watermark', 'One 192k MP3 with an inaudible mark'],
  ['Quality', 'A human listens before delivery', 'Automated; rate it and re-roll'],
  ['Rights', 'Commercial release license', 'Personal use only'],
]
const eyebrow = 'font-mono text-xs tracking-[0.18em] text-graphite/45'
const h2 = 'mt-5 font-brand text-3xl leading-snug tracking-tight text-balance sm:text-4xl'

export default async function ArtistsPage({ searchParams }: { searchParams: Promise<{ eoi?: string }> }) {
  const { eoi } = await searchParams
  const initialState = eoi === 'sent' ? 'sent' : eoi === 'error' ? 'error' : undefined

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(artistsPageLd(SITE_URL)) }} />

      <section className="mx-auto max-w-3xl px-6 pt-20 sm:pt-28">
        <span className={eyebrow}>For artists</span>
        <h1 className="mt-5 font-brand text-5xl leading-tight tracking-tight text-balance sm:text-6xl">Your songs, in every language, in your voice.</h1>
        <p className="mt-8 text-lg leading-relaxed text-graphite/75">
          30% of net streaming receipts on the new-language masters, perpetual and exclusive, $0 upfront. You get lossless stems and a human in the loop.
        </p>
        <p className="mt-4 text-lg leading-relaxed text-graphite/75">Our first signed artist is Coffey Anderson.</p>
        <p className="mt-6 text-sm leading-relaxed text-graphite/55">
          What lyrical touches: the vocal, re-sung in your voice in the new language. What lyrical never touches: your instrumental, your melody, your release decisions. Every version is authorized before it is made and reviewed by ear before it is delivered.
        </p>
        <Link href="#eoi" className="nudge mt-8 inline-flex min-h-11 items-center gap-1.5 rounded-card bg-ember px-7 text-cream">
          Register your interest <span className="shift-arrow">&rarr;</span>
        </Link>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-20">
        <span className={eyebrow}>Two doors</span>
        <h2 className={h2}>What Door 1 delivers, and what the fan beta does not.</h2>
        <table className="mt-8 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-graphite/25 text-left font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/50">
              <th className="py-3 pr-4 font-normal">&nbsp;</th><th className="py-3 pr-4 font-normal">Door 1: artists</th><th className="py-3 font-normal">Door 2: fans</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([k, d1, d2]) => (
              <tr key={k} className="border-b border-graphite/15 align-top">
                <th scope="row" className="py-3 pr-4 text-left font-normal text-graphite/55">{k}</th>
                <td className="py-3 pr-4">{d1}</td>
                <td className="py-3 text-graphite/75">{d2}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-20">
        <span className={eyebrow}>How it works</span>
        <h2 className={h2}>Five steps, and you hold the approval at every one.</h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-2">
          {STEPS.map((s, i) => (
            <li key={s.h} className="rounded-card border border-graphite/15 p-5">
              <span className="font-mono text-[11px] tracking-[0.18em] text-graphite/45">0{i + 1}</span>
              <h3 className="mt-2 font-brand text-xl">{s.h}</h3>
              <p className="mt-2 text-sm leading-relaxed text-graphite/75">{s.p}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20" aria-labelledby="calc">
        <span className={eyebrow}>Calculator</span>
        <h2 id="calc" className={h2}>What could a new language earn you?</h2>
        <p className="mt-4 max-w-2xl leading-relaxed text-graphite/75">
          The worked example below is 100,000 monthly streams, 12 songs, two languages and a 20% new-language audience. Change the inputs to your own. Every result is an estimate.
        </p>
        <div className="mt-10"><EarningsCalculator initial={WORKED_EXAMPLE} /></div>
      </section>

      <section id="eoi" className="mx-auto max-w-xl px-6 py-20 sm:py-28">
        <span className={eyebrow}>Door 1</span>
        <h2 className={h2}>Register your interest</h2>
        <p className="mt-6 leading-relaxed text-graphite/75">Tell us who you are and where your songs are. A person reads every one of these and replies within one working day.</p>
        <div className="mt-10"><ArtistEoiForm siteKey={turnstileSiteKey()} initialState={initialState} /></div>
      </section>
    </>
  )
}
```

- [ ] **Step 4: Run, expect PASS.** Then the whole suite, `npm test` (the copy test walks `app/` and `components/`). Commit: `git add app/artists/page.tsx tests/artists-page.test.tsx && git commit -m "feat(artists): /artists page with calculator, EOI form, metadata and JSON-LD"`

### Task 7: Verify, phone check, real EOI, PR

- [ ] **Step 1: Green locally** `npm test && npm run build`. Expected: every test file passes including `tests/copy.test.ts`; the build lists `/artists` as dynamic (it reads `searchParams`) and `/artists/eoi` as a route handler.

- [ ] **Step 2: Phone-width check in the Browser pane.** Add to `.claude/launch.json` if absent: `{ "name": "web", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev"], "port": 3000 }`. `preview_start` name `web`, `navigate` to `http://localhost:3000/artists`, `resize_window` preset `mobile`, screenshot each section. Pass: no horizontal scroll, the table's three columns wrap and never overflow, the slider and every button are at least 44px tall, tiles stack in one column. Then `resize_window` preset `desktop`.

- [ ] **Step 3: No-JS check.** In Henry's Chrome (claude-in-chrome tools) open `chrome://settings/content/javascript`, block JavaScript for `localhost:3000`, reload `/artists`: the worked example ($1,920 / $1,344 / $576) is visible, the form submits and lands on `/artists?eoi=sent#eoi` with the thank-you copy. Re-enable JavaScript afterwards.

- [ ] **Step 4: Push and PR**

```bash
git push -u origin feat/v2-artists
gh pr create --base develop --title "v2 artists: /artists page, earnings calculator, EOI form" --body-file docs/bots/pr-body-artists.md
```

Write `docs/bots/pr-body-artists.md` first (not committed; delete it once the PR is open): the scope, the one shared edit to `app/api/enquiry/route.ts` and why it is source-gated, the note that Bot B must add `/artists` to `app/sitemap.ts` and the nav link, the phone-check screenshots, and the attribution line from the session's system reminder.

- [ ] **Step 5: Real EOI on omega after the merge to develop.** Once Henry merges and omega deploys, open `https://lyrical-studio-omega.vercel.app/artists` in Henry's Chrome, submit an EOI with name `Bot D test`, artist `Test act`, Henry's own email, band `10k to 100k`, one link `https://example.com`. Then open `https://lyrical-studio-omega.vercel.app/queue?tab=enquiries` (Henry signs in with the admin password himself; never type it) and confirm the row: company `Test act`, message opening `Artist or act: Test act` then `Monthly streams: 10k to 100k`. Ask Henry to mark it handled. Report the row's timestamp in Melbourne time.

## Done when

- `tests/earnings.test.ts`, `tests/eoi-schema.test.ts`, `tests/eoi-route.test.ts`, `tests/artists-page.test.tsx` pass, and `npm test && npm run build` is green.
- `/artists` renders the worked example ($1,920 extra a year estimate, $1,344 artist, $576 lyrical) with JavaScript disabled, and the EOI form submits without JavaScript to `/artists?eoi=sent#eoi`.
- A real EOI from omega appears in `/queue?tab=enquiries` with `source = artist_eoi` and the labelled lines in the message.
- `Nav.tsx`, `sitemap.ts`, `robots.ts`, `Footer.tsx` untouched; the only shared edit is the source-gated Turnstile block in `app/api/enquiry/route.ts`.
- PR open into `develop`, `main` untouched.
