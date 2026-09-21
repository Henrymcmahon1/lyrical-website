# Bot B: Marketing (landing, /pricing, /investors, nav, footer)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Paste this to start the session:**
> Read `docs/superpowers/specs/2026-09-22-two-doors-v2-design.md` then `docs/bots/BOT-B-marketing.md` in `C:\Users\User\CascadeProjects\lyrical-website`. Work on branch `feat/v2-marketing` off `develop`, after Bot 0's `feat/v2-prep` has merged (it supplies `lib/plans.ts` and `docs/v2/copy-deck.md`). Never touch `main`. Execute the brief task by task, tests first. No em dashes anywhere, code comments included.

**Goal:** Rewrite the public face of the site for "one technology, two doors": a fan-facing landing with the Coffey Anderson before/after, a `/pricing` page that reads every dollar from `lib/plans.ts`, a password-gated `/investors` page rebuilt from the v6 vision, and a nav and footer that point at Home, Pricing, For artists and Studio.

**Architecture:** Server components everywhere except one small player and the existing scroll pieces. Copy lives in `content/*.ts` so sections stay thin and tests can read the strings. Prices are never typed into JSX: `PLANS` and `priceFor()` are the only source. The Coffey section signs URLs on the server from a private bucket and returns `null` when the env or the files are absent. `/investors` clones the `/listen` gate with its own token namespace, cookie, env var and rate-limit scope.

**Tech Stack:** Next 16 (App Router, async `cookies()` and `searchParams`), React 19, TypeScript, Tailwind, Vitest with `renderToStaticMarkup`, Supabase Storage signed URLs.

**Spec:** `docs/superpowers/specs/2026-09-22-two-doors-v2-design.md` (§7, plus §11 ownership and §12 constraints)

## Global Constraints

- Branch `feat/v2-marketing` off `develop`. PR into `develop`. Never touch `main`, the `lyrical-website` Vercel project or lyricalglobal.com.
- You own (nobody else edits): `app/page.tsx`, `components/sections/**`, `app/pricing/**`, `app/investors/**`, `lib/investor-auth.ts`, `components/Nav.tsx`, `components/Footer.tsx`, `content/**`, `app/robots.ts`, `app/sitemap.ts`, `tests/copy.test.ts`, plus the new tests named below. Do not edit `lib/plans.ts`, `lib/structured-data.ts`, `lib/listen-audio.ts` or anything under `app/studio/`.
- No em dashes anywhere. `tests/copy.test.ts` scans `app/`, `components/` and `content/` and fails the build on one.
- Brand rules from `CLAUDE.md`: locked tokens only (cream, graphite, indigo, ember; dark ground, ink, accent on dark sections), no gradients, ember never carries body text, indigo never on the dark ground, Fraunces + Archivo already self-hosted via `lib/fonts.ts`, lowercase `lyrical`, US spelling, never "AI-generated" or "Solutions". Reveals go through the existing `Reveal` component (scoped to `.js-motion`, IntersectionObserver only); every page readable with JavaScript off.
- Strings come from `docs/v2/copy-deck.md` verbatim. The hero headline uses US spelling ("favorite"), per `CLAUDE.md`; decided 22 Sep, do not reopen.
- No secrets in files. `INVESTOR_PASSWORD`, `COFFEY_BUCKET`, `COFFEY_ORIGINAL_PATH`, `COFFEY_COVER_PATH` are set by Henry in the omega Vercel project. `GATE_SECRET` already exists and signs the investor token too.
- `npm test && npm run build` green before the PR.
- `/artists` is Bot D's page and merges after you (order A, C, B, D). Links to it 404 on omega for the days in between; that is the agreed order, not a bug to fix here.

## File structure

| File | Responsibility |
|---|---|
| `components/Nav.tsx`, `components/Footer.tsx` | Home, Pricing, For artists, Studio; footer adds Pricing and For artists |
| `content/two-doors.ts` | every landing and pricing string: hero, steps, beta, Door-1 block, cap rows, FAQ |
| `content/investors.ts` | the eight investor sections and the comps |
| `components/sections/S01Hero.tsx` | rewritten: fan headline, founding beta, See plans / For artists |
| `components/sections/S02Coffey.tsx`, `CoffeyPlayer.tsx` | server: signs the two files, `null` without them; client: original / new-language toggle |
| `components/sections/S03Steps.tsx` | how it works, three steps, static |
| `components/sections/PlanCards.tsx`, `S04Plans.tsx` | the three cards from `PLANS`; the home preview wrapping them |
| `components/sections/S05Beta.tsx`, `S06Artists.tsx`, `S07Close.tsx` | beta honesty; the Door-1 block; the fan close |
| `components/sections/CapTable.tsx` | capped vs unlocked table, used by `/pricing` and `/investors` |
| `app/page.tsx` | new section order |
| `app/pricing/page.tsx`, `app/pricing/structured-data.ts` | pricing page, metadata, JSON-LD |
| `lib/investor-auth.ts`, `app/investors/actions.ts`, `app/investors/page.tsx` | token sign/verify; unlock/lock; gate and content |
| `app/robots.ts`, `app/sitemap.ts` | disallow `/investors`; add `/pricing` and `/artists` |
| `tests/investor-auth.test.ts`, `tests/pricing.test.tsx`, `tests/coffey-section.test.tsx`, `tests/copy.test.ts` | tests |

**Kept on disk, removed from the home page:** `S02bAudience`, `S03Wheels` (still used by `/hear`), `S04Fidelity`, `S05How`, `S09bNow`. Their CSS (`.audience-track`, `.turn-track`) stays. `S08Rights`, `S09Team`, `S10Start` keep serving `/about` and `/ai-music-translation` untouched; the home page gets its own `S07Close` so those pages keep their voice.

---

### Task 1: Branch, nav, footer

**Files:** `components/Nav.tsx`, `components/Footer.tsx`

- [ ] **Step 1: Branch**

```bash
git checkout develop && git pull && git checkout -b feat/v2-marketing
```

- [ ] **Step 2: Failing test** (the assertions live in `tests/copy.test.ts`; append this block now, Task 7 adds more)

```ts
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Nav } from '@/components/Nav'
import { Footer } from '@/components/Footer'

describe('nav and footer carry the two doors', () => {
  it('nav is Home, Pricing, For artists, Studio in that order', () => {
    const html = renderToStaticMarkup(createElement(Nav))
    expect([...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1])).toEqual(['/', '/', '/pricing', '/artists', '/studio'])
    expect(html).not.toContain('Get started')
  })
  it('footer adds Pricing and For artists and keeps the rest', () => {
    const html = renderToStaticMarkup(createElement(Footer))
    for (const h of ['/pricing', '/artists', '/studio', '/hear', '/about', '/contact']) expect(html).toContain(`href="${h}"`)
  })
})
```

`createElement`, not JSX, so the file keeps its `.ts` name. Run `npx vitest run tests/copy.test.ts`, expect FAIL.

- [ ] **Step 3: Nav** Replace the `<div className="ml-auto ...">` block in `components/Nav.tsx` with:

```tsx
        <div className="ml-auto flex items-center gap-4 text-sm sm:gap-7">
          <Link href="/" className="inline-flex min-h-11 items-center hover:text-indigo">Home</Link>
          <Link href="/pricing" className="inline-flex min-h-11 items-center hover:text-indigo">Pricing</Link>
          <Link href="/artists" className="inline-flex min-h-11 items-center hover:text-indigo">For artists</Link>
          <Link href="/studio" className="inline-flex min-h-11 items-center rounded-card bg-indigo px-4 text-cream transition-colors hover:bg-graphite">Studio</Link>
        </div>
```

Cut the file's header comment to what is still true (plain-language labels, never "Solutions"; `min-h-11` targets) plus one line: "Rewritten 2026-09 for the two doors."

- [ ] **Step 4: Footer** Insert after the `/studio` link in `components/Footer.tsx`:

```tsx
          <Link href="/pricing" className="inline-flex min-h-11 items-center hover:text-indigo">Pricing</Link>
          <Link href="/artists" className="inline-flex min-h-11 items-center hover:text-indigo">For artists</Link>
```

The footer's top comment carries an em dash today; change it to `/** The STACKED lockup, the primary sanctioned arrangement. Mark above wordmark. */`.

- [ ] **Step 5: Run, expect PASS.** `git add components/Nav.tsx components/Footer.tsx tests/copy.test.ts && git commit -m "nav: Home, Pricing, For artists, Studio; footer adds Pricing and For artists"`

### Task 2: Copy as data

**Files:** `content/two-doors.ts`, `content/investors.ts`. Strings marked (deck) are verbatim from `docs/v2/copy-deck.md`.

- [ ] **Step 1: Write `content/two-doors.ts`**

```ts
/** Fan-facing copy (Door 2) and the Door-1 block. (deck) = verbatim from docs/v2/copy-deck.md. */
export const HERO = {
  headline: 'Sing your favorite song in any language.', // (deck)
  sub: 'Upload your song, pick a language, and hear it re-sung in the same voice. Founding beta: rough edges, honest prices, two free re-rolls on every track.', // (deck)
  primary: 'See plans', // (deck)
  secondary: 'For artists', // (deck)
}
export const BETA_LINE = 'Beta output. Personal use only.' // (deck)
export const FOUNDING_LINE = 'Founding beta prices. Sign up now and keep them for life.' // (deck)
export const REROLL_LINE = 'Every track comes with 2 free re-rolls.' // (deck)
export const ANCHOR_WEDGE = 'We never charge that for automated output.' // (deck, second sentence of the anchor line)
export const MOST_FANS = 'Most fans' // (deck)

export const STEPS = [
  { h: 'Upload your stems', p: 'The instrumental and the lead vocal, or the full mix if that is what you have.' },
  { h: 'Pick a language', p: 'Nine to choose from. The melody, the phrasing and the backing stay exactly as they are.' },
  { h: 'Get your MP3, then rate it', p: 'One 192k MP3, re-sung in the same voice. One tap to rate it. A thumbs-down unlocks a free re-roll.' },
]

export const BETA = {
  h: 'Beta, honestly',
  p: [
    'Every track you get back has a thumbs-up and a thumbs-down under it. Thumbs-down asks you to say what is wrong, then gives you a free re-roll, up to two per track.',
    'Nobody checks each track by ear before it reaches you. That is what keeps the price where it is, and it is why your rating matters: every note you write is what the engine learns from next.',
  ],
}

export const DOOR1 = {
  label: 'For artists',
  h: 'Your songs, in every language, in your voice.', // (deck)
  p: '30% of net streaming receipts on the new-language masters, perpetual and exclusive, $0 upfront. You get lossless stems and a human in the loop.', // (deck)
  precedent: 'Our first signed artist is Coffey Anderson.', // (deck)
  cta: 'Read the terms',
}

export const CLOSE = { h: 'Pick a song. Pick a language.', p: 'Founding beta, no free tier, no commitment past the track in front of you.', cta: 'See plans' }

/** What self-serve delivers against what a signed artist gets. */
export const CAP_ROWS: { what: string; capped: string; unlocked: string }[] = [
  { what: 'Delivery format', capped: 'One 192k MP3', unlocked: '24-bit WAV stems' },
  { what: 'Watermark', capped: 'Inaudible provenance mark', unlocked: 'None' },
  { what: 'Licence', capped: 'Personal use only', unlocked: 'Commercial release' },
  { what: 'Voice', capped: 'Zero-shot, 50 steps', unlocked: 'Trained voice plus RVC cascade' },
  { what: 'Repair', capped: 'Default polish', unlocked: 'Full repair pass' },
  { what: 'Human QA', capped: 'No', unlocked: 'Yes, every track by ear' },
]

export const FAQ: { q: string; a: string }[] = [
  { q: 'What do I upload?', a: 'Your song as stems: the instrumental and the lead vocal. If all you have is the full mix, upload that and we separate it.' },
  { q: 'What do I get?', a: 'One 192k MP3 of your song re-sung in the language you picked, in the same voice, over the untouched backing. It carries an inaudible provenance mark.' },
  { q: 'Can I release it?', a: 'No. Self-serve tracks are for personal use only, not for upload to streaming or sales platforms. Artists who want release rights, lossless stems and a human ear sign through the artist door.' },
  { q: 'What is a re-roll?', a: 'A fresh take of the same song in the same language with a different render seed. Give a thumbs-down with a note that says what was wrong and the re-roll button appears. Two per track, free.' },
  { q: 'What does beta mean?', a: 'Rough edges. No human listens to each track before you do. Founding prices stay yours for life, and every rating you leave makes the next track better.' },
]
```

- [ ] **Step 2: Write `content/investors.ts`**

```ts
/** The /investors page, rebuilt from the v6 vision. The $8,000 is a placeholder and says so. */
export const INVESTORS = {
  title: 'One technology, two doors.', // (deck)
  frame: 'Not a tool. A rights catalog with an engine.', // (deck)
  placeholder: 'The $8,000 per master per year is a placeholder until one real release reports.', // (deck)
}

export type InvestorSection = { n: string; h: string; p: string[] }

export const SECTIONS: InvestorSection[] = [
  { n: '01', h: 'The atom', p: [
    'One re-sung track costs about $0.50 to make, a margin near 95% at any price above a few dollars.',
    'The anchor the market already accepts: Controlla charges $2,000 per language for a human singer.' ] },
  { n: '02', h: 'The two doors', p: [
    'Door 1, the moat: signed career artists, 30% of net streaming receipts, perpetual and exclusive, $0 upfront, lossless stems, human QA.',
    'Door 2, the toy: fans and hobbyists, self-serve, one flattened MP3, inaudible watermark, personal use only, no human QA. In beta.' ] },
  { n: '03', h: 'Door 2 priced', p: [
    'Single $9 a track, Fan $19 a month for 5 tracks, Superfan $39 a month for 15. Founding prices, grandfathered. Standard prices $12, $29 and $59.',
    'The caps are format, licence and watermark, not quality tiers. Same engine, same default profile. The table below is the one /pricing shows.' ] },
  { n: '04', h: 'Launching in beta, honestly', p: [
    'Buy, rate, re-roll, upsell. Every delivered track gets a one-tap rating. A thumbs-down requires a written note and unlocks a free re-roll, two per track.',
    'The ratings are labelled data: song, language, voice, human verdict. That is the training set for the placement engine.' ] },
  { n: '05', h: 'The cap is the funnel', p: [
    'A fan who wants stems or commercial rights hits a wall and is pointed to Door 1.',
    'The bridge is a Studio Single at roughly $499 to $999: human QA, lossless, commercial, sold by hand, under the $2,000 anchor.' ] },
  { n: '06', h: 'Door 1 modelled', p: [
    'lyrical takes 30% of net receipts on each new-language master.',
    'Illustrative only: 16 masters at $8,000 net royalty a year each is about $38,000 a year to lyrical. The $8,000 per master per year is a placeholder until one real release reports.' ] },
  { n: '07', h: 'The flywheel', p: [
    'Fans make songs. Ratings become data. The engine improves. Better output signs more artists. Their reach brings more fans.' ] },
  { n: '08', h: 'Valuation frame', p: [
    'Music rights trade at roughly 10 to 18 times net royalty. AI application SaaS at roughly 8 to 20 times ARR. Legacy SaaS at 4 to 5 times.',
    'Catalog funds buy rights at 10 to 20 times. lyrical creates rights at $0.50 marginal cost.' ] },
]

export const COMPS: string[][] = [
  ['Controlla', '$2,000 per language, human singer'],
  ['ElevenLabs', 'Free tier is non-commercial'],
  ['HeyGen', 'Free tier carries a watermark'],
  ['DistroKid', 'From about $2 a month'],
]
```

- [ ] **Step 3: Commit** `git add content && git commit -m "content: two-doors and investor copy as data"`

### Task 3: The Coffey section (null without env)

**Files:** `components/sections/S02Coffey.tsx`, `components/sections/CoffeyPlayer.tsx`, `tests/coffey-section.test.tsx`

**Interfaces:** `coffeyConfig(env)` pure `{ bucket, original, cover } | null`; `S02Coffey()` async server component, `null` when config or either signed URL is missing; `CoffeyPlayer({ originalUrl, coverUrl })` client.

- [ ] **Step 1: Failing test** `tests/coffey-section.test.tsx`

```tsx
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

describe('S02Coffey', () => {
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
  it('renders the player with both signed URLs', async () => {
    withEnv()
    createSignedUrls.mockResolvedValue({ data: [row('a.mp3', 'https://sb/a?t=1'), row('b.mp3', 'https://sb/b?t=2')], error: null })
    const html = renderToStaticMarkup(await S02Coffey())
    expect(html).toContain('Coffey Anderson')
    expect(html).toContain('https://sb/a?t=1')
    expect(html).toContain('https://sb/b?t=2')
    expect(createSignedUrls).toHaveBeenCalledWith(['a.mp3', 'b.mp3'], 4 * 60 * 60)
  })
})
```

- [ ] **Step 2: Run, expect FAIL** `npx vitest run tests/coffey-section.test.tsx`

- [ ] **Step 3: Write `components/sections/CoffeyPlayer.tsx`**

```tsx
'use client'

import { useRef, useState } from 'react'

/** Original against the new-language version, one at a time. No gate: the section is public and the URLs are server-signed. Native controls so a listener can scrub both to the same bar; preload none. */
export function CoffeyPlayer({ originalUrl, coverUrl }: { originalUrl: string; coverUrl: string }) {
  const [side, setSide] = useState<'original' | 'cover'>('original')
  const originalRef = useRef<HTMLAudioElement>(null)
  const coverRef = useRef<HTMLAudioElement>(null)
  const choose = (next: 'original' | 'cover') => {
    if (next === side) return
    originalRef.current?.pause()
    coverRef.current?.pause()
    setSide(next)
  }
  const tab = (s: 'original' | 'cover') => `min-h-11 px-5 text-sm transition-colors ${side === s ? 'bg-dark-accent text-dark-ground' : 'bg-dark-ground text-dark-ink/70 hover:text-dark-ink'}`
  return (
    <div className="mt-10 flex w-full max-w-xl flex-col items-center gap-6">
      <div className="flex gap-px overflow-hidden rounded-card bg-dark-ink/20" role="group" aria-label="Choose which version to hear">
        <button type="button" onClick={() => choose('original')} aria-pressed={side === 'original'} className={tab('original')}>The original</button>
        <button type="button" onClick={() => choose('cover')} aria-pressed={side === 'cover'} className={tab('cover')}>The new language</button>
      </div>
      <audio ref={originalRef} controls preload="none" src={originalUrl} className={side === 'original' ? 'w-full' : 'hidden'} aria-label="Coffey Anderson, the original" />
      <audio ref={coverRef} controls preload="none" src={coverUrl} className={side === 'cover' ? 'w-full' : 'hidden'} aria-label="Coffey Anderson, re-sung in the new language" />
    </div>
  )
}
```

- [ ] **Step 4: Write `components/sections/S02Coffey.tsx`**

```tsx
import { supabaseAdmin } from '@/lib/supabase-admin'
import { CoffeyPlayer } from './CoffeyPlayer'

/**
 * Coffey Anderson, before and after. The files live in a PRIVATE bucket; Henry supplies the
 * paths through env. Until both files sign, this is `null`: the home page never shows a player
 * with nothing behind it. Same signing pattern as lib/listen-audio.ts; never throws.
 */
export type CoffeyConfig = { bucket: string; original: string; cover: string }

export function coffeyConfig(env: NodeJS.ProcessEnv): CoffeyConfig | null {
  const original = env.COFFEY_ORIGINAL_PATH?.trim()
  const cover = env.COFFEY_COVER_PATH?.trim()
  if (!original || !cover) return null
  return { bucket: env.COFFEY_BUCKET?.trim() || 'listen', original, cover }
}

const TTL_S = 4 * 60 * 60

async function signBoth(cfg: CoffeyConfig): Promise<{ original: string; cover: string } | null> {
  try {
    const { data, error } = await supabaseAdmin().storage.from(cfg.bucket).createSignedUrls([cfg.original, cfg.cover], TTL_S)
    if (error || !data) return null
    const ok = new Map(data.filter((r) => r.signedUrl && !r.error && r.path).map((r) => [r.path as string, r.signedUrl]))
    const original = ok.get(cfg.original)
    const cover = ok.get(cfg.cover)
    return original && cover ? { original, cover } : null
  } catch (e) {
    console.error('[coffey] storage unreachable', e)
    return null
  }
}

export default async function S02Coffey() {
  const cfg = coffeyConfig(process.env)
  if (!cfg) return null
  const urls = await signBoth(cfg)
  if (!urls) return null
  return (
    <section aria-label="Coffey Anderson, before and after" className="bg-dark-ground py-24 text-dark-ink sm:py-28">
      <div className="mx-auto flex max-w-4xl flex-col items-center px-6 text-center">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-dark-ink/50">Hear it</span>
        <h2 className="mt-5 font-brand text-4xl leading-tight tracking-tight text-balance sm:text-5xl">Coffey Anderson, in a language he never recorded.</h2>
        <p className="mt-6 max-w-xl leading-relaxed text-dark-ink/70">Same voice, same melody, the original backing untouched. Switch between the two and listen for what changed: only the words.</p>
        <CoffeyPlayer originalUrl={urls.original} coverUrl={urls.cover} />
      </div>
    </section>
  )
}
```

- [ ] **Step 5: Run, expect PASS.** `git add components/sections/S02Coffey.tsx components/sections/CoffeyPlayer.tsx tests/coffey-section.test.tsx && git commit -m "home: Coffey before/after section, null without files"`

### Task 4: Plan cards, cap table, pricing page

**Files:** `components/sections/PlanCards.tsx`, `components/sections/CapTable.tsx`, `app/pricing/structured-data.ts`, `app/pricing/page.tsx`, `tests/pricing.test.tsx`

**Interfaces:** consumes `PLANS`, `PLAN_IDS`, `priceFor`, `REROLLS_PER_TRACK`, `type PlanId` from `lib/plans.ts` (Bot 0) and `ldJson` from `lib/structured-data.ts`; produces `checkoutHref(id)`, `PlanCards({ compact? })`, `CapTable()`, `pricingLd(origin)`, `faqLd()`.

- [ ] **Step 1: Failing test** `tests/pricing.test.tsx`

```tsx
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { PLANS, PLAN_IDS, priceFor } from '@/lib/plans'
import { checkoutHref } from '@/components/sections/PlanCards'
import { pricingLd } from '@/app/pricing/structured-data'
import Pricing from '@/app/pricing/page'

const html = renderToStaticMarkup(<Pricing />)

describe('/pricing', () => {
  it('shows every founding price from priceFor and strikes the standard one', () => {
    for (const id of PLAN_IDS) {
      expect(html).toContain(`$${priceFor(id)}`)
      expect(html).toContain(`<s>$${PLANS[id].standardUsd}</s>`)
    }
  })
  it('badges Fan, promises re-rolls on every card, strikes the anchor', () => {
    expect(html).toContain('Most fans')
    expect(html.match(/2 free re-rolls/g)?.length).toBeGreaterThanOrEqual(3)
    expect(html).toContain('<s>$2,000</s>')
    expect(html).toContain('We never charge that for automated output')
  })
  it('sends every button to sign-in with the billing plan carried through', () => {
    expect(checkoutHref('fan')).toBe('/studio/sign-in?next=%2Fstudio%2Fbilling%3Fplan%3Dfan')
    for (const id of PLAN_IDS) expect(html).toContain(`href="${checkoutHref(id)}"`)
  })
  it('carries the cap table and the five FAQ questions', () => {
    for (const s of ['24-bit WAV stems', 'What do I upload?', 'What do I get?', 'Can I release it?', 'What is a re-roll?', 'What does beta mean?']) expect(html).toContain(s)
  })
  it('never types a plan price in the page or the cards', () => {
    const src = ['app/pricing/page.tsx', 'components/sections/PlanCards.tsx'].map((f) => readFileSync(f, 'utf8')).join('\n')
    for (const id of PLAN_IDS) for (const n of [PLANS[id].foundingUsd, PLANS[id].standardUsd]) expect(src).not.toMatch(new RegExp(`\\$${n}\\b`))
  })
  it('JSON-LD offers match the visible prices', () => {
    const ld = pricingLd('https://example.test') as { offers: { price: number }[] }
    expect(ld.offers.map((o) => o.price)).toEqual(PLAN_IDS.map((id) => priceFor(id)))
  })
})
```

- [ ] **Step 2: Run, expect FAIL** `npx vitest run tests/pricing.test.tsx`

- [ ] **Step 3: Write `components/sections/PlanCards.tsx`**

```tsx
import Link from 'next/link'
import { PLANS, PLAN_IDS, REROLLS_PER_TRACK, priceFor, type PlanId } from '@/lib/plans'
import { BETA_LINE, MOST_FANS } from '@/content/two-doors'

/** Sign in first, then land on billing with the plan carried through; Bot A's /studio/billing starts checkout from ?plan=. */
export function checkoutHref(id: PlanId): string {
  return `/studio/sign-in?next=${encodeURIComponent(`/studio/billing?plan=${id}`)}`
}

/** Three cards. Every dollar comes from lib/plans.ts; tests fail if one is typed here. */
export function PlanCards({ compact = false }: { compact?: boolean }) {
  return (
    <ul className="grid gap-6 sm:grid-cols-3">
      {PLAN_IDS.map((id) => {
        const plan = PLANS[id]
        const featured = id === 'fan'
        const per = plan.kind === 'subscription' ? '/ month' : '/ track'
        return (
          <li key={id} className={`relative flex flex-col rounded-card border p-6 ${featured ? 'border-indigo' : 'border-graphite/15'}`}>
            {featured && <span className="absolute -top-3 left-6 rounded-card bg-indigo px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-cream">{MOST_FANS}</span>}
            <h3 className="font-brand text-2xl tracking-tight">{plan.name}</h3>
            <p className="mt-1 text-sm text-graphite/60">{plan.blurb}</p>
            <p className="mt-5 font-brand text-5xl tracking-tight">${priceFor(id)}<span className="ml-1 text-base text-graphite/60">{per}</span></p>
            <p className="mt-1 text-sm text-graphite/55">Standard price <s>${plan.standardUsd}</s>{per}</p>
            <ul className="mt-5 flex flex-col gap-2 text-sm text-graphite/75">
              <li>{plan.tracks} {plan.tracks === 1 ? 'track' : 'tracks'}{plan.kind === 'subscription' ? ' a month' : ''}</li>
              <li>{REROLLS_PER_TRACK} free re-rolls per track</li>
              <li>{BETA_LINE}</li>
            </ul>
            <Link href={checkoutHref(id)} className={`nudge mt-6 inline-flex min-h-11 items-center justify-center rounded-card px-5 ${featured ? 'bg-ember text-cream' : 'border border-graphite/30 hover:border-indigo hover:text-indigo'}`}>
              {compact ? 'Choose' : `Choose ${plan.name}`}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
```

- [ ] **Step 4: Write `components/sections/CapTable.tsx`**

```tsx
import { CAP_ROWS } from '@/content/two-doors'

/** Capped (self-serve) against unlocked (signed artist). One table, reused on /pricing and /investors. */
export function CapTable() {
  const th = 'py-3 pr-4 font-normal'
  return (
    <table className="w-full border-collapse text-left text-sm">
      <thead>
        <tr className="border-b border-graphite/20 font-mono text-[11px] uppercase tracking-[0.16em] text-graphite/50">
          <th className={th}>What</th><th className={th}>Self-serve</th><th className="py-3 font-normal">Signed artist</th>
        </tr>
      </thead>
      <tbody>
        {CAP_ROWS.map((r) => (
          <tr key={r.what} className="border-b border-graphite/10">
            <th scope="row" className={`${th} text-graphite/70`}>{r.what}</th><td className="py-3 pr-4">{r.capped}</td><td className="py-3">{r.unlocked}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 5: Write `app/pricing/structured-data.ts`**

```ts
import { PLANS, PLAN_IDS, priceFor } from '@/lib/plans'
import { FAQ } from '@/content/two-doors'

/** Only what the page shows: three offers at the visible price, five visible questions. Same rule as lib/structured-data.ts. */
export function pricingLd(origin: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'lyrical self-serve',
    description: 'Your song, re-sung in another language in the same voice. Personal use, beta.',
    brand: { '@id': `${origin}/#organization` },
    offers: PLAN_IDS.map((id) => ({ '@type': 'Offer', name: PLANS[id].name, price: priceFor(id), priceCurrency: 'USD', url: `${origin}/pricing` })),
  }
}

export function faqLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }
}
```

- [ ] **Step 6: Write `app/pricing/page.tsx`**

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { PlanCards } from '@/components/sections/PlanCards'
import { CapTable } from '@/components/sections/CapTable'
import { ANCHOR_WEDGE, FAQ, FOUNDING_LINE, REROLL_LINE } from '@/content/two-doors'
import { ldJson } from '@/lib/structured-data'
import { SITE_URL } from '@/lib/site'
import { faqLd, pricingLd } from './structured-data'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Founding beta prices for lyrical self-serve: Single, Fan and Superfan. Two free re-rolls on every track. Personal use only.',
  alternates: { canonical: '/pricing' },
}

export default function Pricing() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(pricingLd(SITE_URL), faqLd()) }} />
      <section className="mx-auto max-w-5xl px-6 py-20 sm:py-28">
        <span className="font-mono text-xs tracking-[0.18em] text-graphite/45">Pricing</span>
        <h1 className="mt-5 font-brand text-4xl leading-[1.08] tracking-tight text-balance sm:text-5xl">{FOUNDING_LINE}</h1>
        <p className="mt-6 max-w-xl leading-relaxed text-graphite/75">{REROLL_LINE}</p>
        <div className="mt-14"><PlanCards /></div>
        {/* The deck's anchor line with its figure struck; the figure is typed once, here. */}
        <p className="mt-10 max-w-xl text-sm leading-relaxed text-graphite/60">A human singer costs <s>$2,000</s> a language. {ANCHOR_WEDGE}</p>
      </section>
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="font-brand text-3xl tracking-tight">What self-serve delivers, and what a signed artist gets</h2>
        <div className="mt-8"><CapTable /></div>
        <p className="mt-6 text-sm text-graphite/60">Want the right-hand column? <Link href="/artists" className="underline underline-offset-4 hover:text-indigo">Read the artist terms</Link>.</p>
      </section>
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="font-brand text-3xl tracking-tight">Questions</h2>
        <dl className="mt-8 flex flex-col gap-8">
          {FAQ.map((f) => (
            <div key={f.q}>
              <dt className="font-brand text-xl tracking-tight">{f.q}</dt>
              <dd className="mt-2 leading-relaxed text-graphite/75">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  )
}
```

- [ ] **Step 7: Run, expect PASS.** `git add app/pricing components/sections/PlanCards.tsx components/sections/CapTable.tsx tests/pricing.test.tsx && git commit -m "pricing: three plans from lib/plans, cap table, FAQ, JSON-LD"`

### Task 5: The landing page

**Files:** `components/sections/S01Hero.tsx` (edit), `S03Steps.tsx`, `S04Plans.tsx`, `S05Beta.tsx`, `S06Artists.tsx`, `S07Close.tsx` (new), `app/page.tsx`

- [ ] **Step 1: Failing assertions** Append to `tests/pricing.test.tsx`:

```tsx
import Home from '@/app/page'
import { HERO, DOOR1 } from '@/content/two-doors'

describe('/ (landing)', () => {
  it('reads as the two doors, in order', async () => {
    const h = renderToStaticMarkup(await Home())
    const idx = [HERO.headline, 'How it works', 'Most fans', 'Beta, honestly', DOOR1.h, 'Pick a song. Pick a language.'].map((s) => h.indexOf(s))
    expect(idx.every((i) => i >= 0)).toBe(true)
    expect([...idx].sort((a, b) => a - b)).toEqual(idx)
    expect(h).toContain('href="/pricing"')
    expect(h).toContain('href="/artists"')
    expect(h).not.toContain('Make your song multilingual')
  })
})
```

The Coffey env is unset here, so that section is absent; Task 3 covers it.

- [ ] **Step 2: Rewrite `components/sections/S01Hero.tsx`** (keep `MarkUnlock`, `Parallax`, `ScrollCue`; replace the historical comments with one line: rewritten 2026-09 for Door 2, the rights-holder story lives on /about and /ai-music-translation)

```tsx
import Link from 'next/link'
import { HERO } from '@/content/two-doors'
import { MarkUnlock } from '../MarkUnlock'
import { Parallax } from '../Parallax'
import { ScrollCue } from '../ScrollCue'

export default function S01Hero() {
  return (
    <section className="relative mx-auto flex min-h-[84vh] max-w-6xl flex-col items-center justify-center px-6 py-20 text-center">
      <Parallax speed={0.06}><div className="text-indigo"><MarkUnlock size={156} /></div></Parallax>
      <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.18em] text-graphite/45">Founding beta</p>
      <h1 className="mt-4 font-brand text-5xl leading-[1.02] tracking-tight text-balance sm:text-6xl lg:text-7xl">{HERO.headline}</h1>
      <p className="mt-8 max-w-xl text-lg leading-relaxed text-graphite/75">{HERO.sub}</p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <Link href="/pricing" className="nudge rounded-card bg-ember px-7 py-4 text-cream">{HERO.primary} <span className="shift-arrow">&rarr;</span></Link>
        <Link href="/artists" className="nudge rounded-card border border-graphite/30 px-7 py-4 transition-colors hover:border-indigo hover:text-indigo">{HERO.secondary}</Link>
      </div>
      <ScrollCue />
    </section>
  )
}
```

- [ ] **Step 3: Write `S03Steps.tsx`** (static; `PinnedStepper` is the rights-holder journey and stays with `S05How`)

```tsx
import { STEPS } from '@/content/two-doors'
import { Reveal } from '../Reveal'

export default function S03Steps() {
  return (
    <section id="how" className="mx-auto max-w-5xl px-6 py-24">
      <h2 className="font-brand text-4xl leading-tight tracking-tight sm:text-5xl">How it works</h2>
      <ol className="mt-12 grid gap-10 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.h}>
            <Reveal delay={i * 90}>
              <span className="font-mono text-xs tabular-nums text-indigo">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="mt-3 font-brand text-2xl tracking-tight">{s.h}</h3>
              <p className="mt-3 leading-relaxed text-graphite/75">{s.p}</p>
            </Reveal>
          </li>
        ))}
      </ol>
    </section>
  )
}
```

- [ ] **Step 4: Write `S04Plans.tsx` and `S05Beta.tsx`**

```tsx
// S04Plans.tsx
import Link from 'next/link'
import { FOUNDING_LINE } from '@/content/two-doors'
import { PlanCards } from './PlanCards'

export default function S04Plans() {
  return (
    <section id="plans" className="mx-auto max-w-5xl px-6 py-24">
      <h2 className="font-brand text-4xl leading-tight tracking-tight sm:text-5xl">{FOUNDING_LINE}</h2>
      <div className="mt-12"><PlanCards compact /></div>
      <p className="mt-8 text-sm text-graphite/60">
        <Link href="/pricing" className="nudge inline-flex min-h-11 items-center underline underline-offset-4 hover:text-indigo">Everything on the pricing page <span className="shift-arrow">&rarr;</span></Link>
      </p>
    </section>
  )
}
```

```tsx
// S05Beta.tsx. Deliberately still, like S08Rights: honesty reads better without motion.
import { BETA } from '@/content/two-doors'

export default function S05Beta() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-24 text-center">
      <span className="font-mono text-xs tracking-[0.18em] text-graphite/45">Rate it, re-roll it</span>
      <h2 className="mt-5 font-brand text-3xl leading-snug tracking-tight text-balance sm:text-4xl">{BETA.h}</h2>
      {BETA.p.map((p) => <p key={p.slice(0, 24)} className="mt-6 leading-relaxed text-graphite/75">{p}</p>)}
    </section>
  )
}
```

- [ ] **Step 5: Write `S06Artists.tsx`** (dark ground, so `dark-accent` for the action; indigo fails contrast there)

```tsx
import Link from 'next/link'
import { DOOR1 } from '@/content/two-doors'

export default function S06Artists() {
  return (
    <section id="artists" className="bg-dark-ground py-24 text-dark-ink sm:py-28">
      <div className="mx-auto flex max-w-3xl flex-col items-start px-6">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-dark-ink/50">{DOOR1.label}</span>
        <h2 className="mt-5 font-brand text-4xl leading-tight tracking-tight text-balance sm:text-5xl">{DOOR1.h}</h2>
        <p className="mt-6 max-w-xl leading-relaxed text-dark-ink/70">{DOOR1.p}</p>
        <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.16em] text-dark-ink/55">
          <li>30% royalty</li><li>$0 upfront</li><li>Lossless stems</li><li>Human QA</li>
        </ul>
        <p className="mt-6 text-sm text-dark-ink/55">{DOOR1.precedent}</p>
        <Link href="/artists" className="nudge mt-10 rounded-card bg-dark-accent px-8 py-4 text-dark-ground">{DOOR1.cta} <span className="shift-arrow">&rarr;</span></Link>
      </div>
    </section>
  )
}
```

- [ ] **Step 6: Write `S07Close.tsx`** (the fan close; `S10Start` keeps serving `/about` and `/ai-music-translation`)

```tsx
import Link from 'next/link'
import { CLOSE } from '@/content/two-doors'
import { Reveal } from '../Reveal'

export default function S07Close() {
  return (
    <section id="start" className="bg-graphite py-24 text-cream sm:py-28">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <Reveal><h2 className="font-brand text-5xl leading-[1.05] tracking-tight text-balance sm:text-6xl">{CLOSE.h}</h2></Reveal>
        <Reveal delay={120}><p className="mx-auto mt-7 max-w-xl leading-relaxed text-cream/70">{CLOSE.p}</p></Reveal>
        <Reveal delay={200}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/pricing" className="nudge rounded-card bg-ember px-7 py-4 text-cream sm:px-8 sm:text-lg">{CLOSE.cta} <span className="shift-arrow">&rarr;</span></Link>
            <Link href="/artists" className="nudge inline-flex min-h-11 items-center rounded-card border border-cream/30 px-7 py-4 transition-colors hover:border-cream">For artists</Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
```

- [ ] **Step 7: Rewrite `app/page.tsx`**

```tsx
import S01Hero from '@/components/sections/S01Hero'
import S02Coffey from '@/components/sections/S02Coffey'
import S03Steps from '@/components/sections/S03Steps'
import S04Plans from '@/components/sections/S04Plans'
import S05Beta from '@/components/sections/S05Beta'
import S06Artists from '@/components/sections/S06Artists'
import S07Close from '@/components/sections/S07Close'

/**
 * Two doors, fan door first (2026-09-22, spec §7): hero, Coffey before/after (null until the
 * files are in the bucket), how it works, plan preview, beta honesty, the artist door, close.
 * S02bAudience, S03Wheels, S04Fidelity, S05How and S09bNow left this page and stay on disk
 * (/hear uses S03Wheels; /about carries the rights-holder story).
 *
 * force-dynamic: S02Coffey signs storage URLs per request; a prerender would bake in the empty
 * state. It is awaited here and placed as a node, not written as <S02Coffey />, because the
 * render test does renderToStaticMarkup(await Home()) and that cannot render a nested async
 * component.
 */
export const dynamic = 'force-dynamic'

export default async function Home() {
  const coffey = await S02Coffey()
  return (
    <>
      <S01Hero />
      {coffey}
      <S03Steps />
      <S04Plans />
      <S05Beta />
      <S06Artists />
      <S07Close />
    </>
  )
}
```

- [ ] **Step 8: Run, expect PASS** `npx vitest run tests/pricing.test.tsx tests/copy.test.ts` (the copy test still finds "dry vocal stem" in `S05How.tsx`, which stays on disk). `git add app/page.tsx components/sections tests/pricing.test.tsx && git commit -m "home: two-doors landing (hero, Coffey, steps, plans, beta, artists, close)"`

### Task 6: /investors gate and page

**Files:** `lib/investor-auth.ts`, `app/investors/actions.ts`, `app/investors/page.tsx`, `tests/investor-auth.test.ts`

**Interfaces:** `INVESTOR_COOKIE = 'lyr_investor'`, `INVESTOR_MAX_AGE_MS` (4 h), `signInvestorSession(issuedAtMs)`, `verifyInvestorSession(token, nowMs)`, `checkInvestorPassword(supplied)`.

- [ ] **Step 1: Failing test** `tests/investor-auth.test.ts`

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { INVESTOR_MAX_AGE_MS, checkInvestorPassword, signInvestorSession, verifyInvestorSession } from '@/lib/investor-auth'
import { signDemoSession, verifyDemoSession } from '@/lib/demo-auth'
import { signAdminSession, verifyAdminSession } from '@/lib/admin-auth'

const NOW = 1_800_000_000_000
beforeEach(() => {
  process.env.GATE_SECRET = 'a'.repeat(64)
  process.env.INVESTOR_PASSWORD = 'a password for investors'
  process.env.DEMO_PASSWORD = 'a different listening password'
})
afterEach(() => { delete process.env.INVESTOR_PASSWORD; delete process.env.DEMO_PASSWORD })

describe('the /investors session token', () => {
  it('verifies what it signed, for four hours', () => {
    const t = signInvestorSession(NOW)
    expect(verifyInvestorSession(t, NOW + INVESTOR_MAX_AGE_MS - 1000)).toBe(true)
    expect(verifyInvestorSession(t, NOW + INVESTOR_MAX_AGE_MS + 1)).toBe(false)
    expect(INVESTOR_MAX_AGE_MS).toBe(4 * 60 * 60 * 1000)
  })
  it('rejects the future, tampering and nonsense', () => {
    expect(verifyInvestorSession(signInvestorSession(NOW + 60_000), NOW)).toBe(false)
    const [p] = signInvestorSession(NOW).split('.')
    expect(verifyInvestorSession(`${p}.${'0'.repeat(64)}`, NOW)).toBe(false)
    expect(verifyInvestorSession(undefined, NOW)).toBe(false)
    expect(verifyInvestorSession('not-a-token', NOW)).toBe(false)
  })
})

describe('namespaces reject each other', () => {
  it('an INVESTOR token opens neither /listen nor /leads', () => {
    expect(verifyDemoSession(signInvestorSession(NOW), NOW)).toBe(false)
    expect(verifyAdminSession(signInvestorSession(NOW), NOW)).toBe(false)
  })
  it('a LISTEN or ADMIN token does not open /investors', () => {
    expect(verifyInvestorSession(signDemoSession(NOW), NOW)).toBe(false)
    expect(verifyInvestorSession(signAdminSession(NOW), NOW)).toBe(false)
  })
})

describe('the /investors password', () => {
  it('accepts its own, rejects the listen password, fails closed when unset', () => {
    expect(checkInvestorPassword('a password for investors')).toBe(true)
    expect(checkInvestorPassword(process.env.DEMO_PASSWORD)).toBe(false)
    delete process.env.INVESTOR_PASSWORD
    expect(checkInvestorPassword('')).toBe(false)
    expect(checkInvestorPassword('a password for investors')).toBe(false)
  })
})
```

- [ ] **Step 2: Run, expect FAIL** `npx vitest run tests/investor-auth.test.ts`

- [ ] **Step 3: Write `lib/investor-auth.ts`**

```ts
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Authentication for /investors. Same shape as demo-auth, a SEPARATE namespace and password:
 * an investor must never hold a token that opens /listen or /leads, and revoking one must not
 * revoke the others. GATE_SECRET signs all of them; the payload prefix keeps them apart.
 */
export const INVESTOR_COOKIE = 'lyr_investor'
export const INVESTOR_MAX_AGE_MS = 4 * 60 * 60 * 1000
const PREFIX = 'investor:'

function secret(): string {
  const s = process.env.GATE_SECRET
  if (!s) throw new Error('GATE_SECRET must be set. Generate with: openssl rand -hex 32')
  return s
}
const mac = (payload: string) => createHmac('sha256', secret()).update(payload).digest('hex')
function sameString(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8'); const bb = Buffer.from(b, 'utf8')
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

export function signInvestorSession(issuedAtMs: number): string {
  const payload = `${PREFIX}${issuedAtMs}`
  return `${Buffer.from(payload).toString('base64url')}.${mac(payload)}`
}

/** Never throws: a missing secret means "ask again", not a 500. */
export function verifyInvestorSession(token: string | undefined, nowMs: number): boolean {
  if (!token) return false
  const [b64, given] = token.split('.')
  if (!b64 || !given) return false
  try {
    const payload = Buffer.from(b64, 'base64url').toString('utf8')
    if (!payload.startsWith(PREFIX) || !sameString(given, mac(payload))) return false
    const issuedAt = Number(payload.slice(PREFIX.length))
    if (!Number.isFinite(issuedAt) || issuedAt > nowMs) return false
    return nowMs - issuedAt < INVESTOR_MAX_AGE_MS
  } catch {
    return false
  }
}

/** Fails closed: unset means nobody gets in, including with an empty submission. */
export function checkInvestorPassword(supplied: string | undefined): boolean {
  const expected = process.env.INVESTOR_PASSWORD
  if (!expected || !supplied) return false
  return sameString(supplied, expected)
}
```

- [ ] **Step 4: Write `app/investors/actions.ts`**

```ts
'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { INVESTOR_COOKIE, INVESTOR_MAX_AGE_MS, checkInvestorPassword, signInvestorSession } from '@/lib/investor-auth'
import { clientKey, consume } from '@/lib/rate-limit'

/** Scoped to /investors so the cookie never rides along to /listen, /leads or the studio. */
const COOKIE_OPTIONS = { httpOnly: true, sameSite: 'lax' as const, path: '/investors', secure: process.env.NODE_ENV === 'production' }

export async function unlock(formData: FormData) {
  const limit = consume(clientKey(await headers(), 'investor'), 5, 10 * 60 * 1000, Date.now())
  if (!limit.allowed) redirect('/investors?error=rate')
  if (!checkInvestorPassword(String(formData.get('password') ?? ''))) {
    await new Promise((resolve) => setTimeout(resolve, 500))
    redirect('/investors?error=1')
  }
  const jar = await cookies()
  jar.set(INVESTOR_COOKIE, signInvestorSession(Date.now()), { ...COOKIE_OPTIONS, maxAge: Math.floor(INVESTOR_MAX_AGE_MS / 1000) })
  redirect('/investors')
}

export async function lock() {
  const jar = await cookies()
  jar.set(INVESTOR_COOKIE, '', { ...COOKIE_OPTIONS, maxAge: 0 })
  redirect('/investors')
}
```

- [ ] **Step 5: Write `app/investors/page.tsx`**

```tsx
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { Mark } from '@/components/Mark'
import { Trademark } from '@/components/Trademark'
import { CapTable } from '@/components/sections/CapTable'
import { COMPS, INVESTORS, SECTIONS } from '@/content/investors'
import { INVESTOR_COOKIE, verifyInvestorSession } from '@/lib/investor-auth'
import { lock, unlock } from './actions'

/** Gated, noindex, disallowed in robots.ts, absent from the sitemap, linked from nowhere. */
export const metadata: Metadata = { title: 'Investors', robots: { index: false, follow: false, nocache: true } }
export const dynamic = 'force-dynamic'

const field = 'w-full rounded-card border border-graphite/25 bg-transparent px-4 py-3 outline-none focus-visible:border-indigo'

function Gate({ error }: { error?: string }) {
  return (
    <section className="mx-auto flex min-h-[70vh] max-w-2xl flex-col justify-center px-6 py-20">
      <div className="text-indigo"><Mark size={40} /></div>
      <h1 className="mt-8 font-brand text-4xl leading-tight tracking-tight">lyrical<Trademark /></h1>
      <p className="mt-4 max-w-sm leading-relaxed text-graphite/70">A private page for investors. If you were sent a password, it goes here.</p>
      <form action={unlock} className="mt-10 flex max-w-sm flex-col gap-4">
        <label className="flex flex-col gap-2"><span className="text-sm">Password</span><input name="password" type="password" required autoComplete="current-password" className={field} /></label>
        {error === '1' && <p role="alert" className="text-sm text-indigo">That password is not right.</p>}
        {error === 'rate' && <p role="alert" className="text-sm text-indigo">Too many attempts. Wait ten minutes and try again.</p>}
        <button type="submit" className="nudge inline-flex min-h-11 items-center self-start rounded-card bg-indigo px-6 text-cream">Open</button>
      </form>
    </section>
  )
}

export default async function Investors({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [jar, params] = await Promise.all([cookies(), searchParams])
  if (!verifyInvestorSession(jar.get(INVESTOR_COOKIE)?.value, Date.now())) return <Gate error={params.error} />
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
      <div className="flex items-start justify-between gap-6">
        <div className="text-indigo"><Mark size={32} /></div>
        <form action={lock}><button type="submit" className="inline-flex min-h-11 items-center text-sm text-graphite/50 underline underline-offset-4 hover:text-graphite">Lock</button></form>
      </div>
      <h1 className="mt-8 font-brand text-4xl leading-tight tracking-tight text-balance sm:text-5xl">{INVESTORS.title}</h1>
      <p className="mt-6 text-lg leading-relaxed text-graphite/75">{INVESTORS.frame}</p>
      {SECTIONS.map((s) => (
        <section key={s.n} className="mt-16">
          <div className="flex items-baseline gap-4"><span className="font-mono text-xs tabular-nums text-indigo">{s.n}</span><h2 className="font-brand text-2xl leading-tight tracking-tight">{s.h}</h2></div>
          {s.p.map((p) => <p key={p.slice(0, 32)} className="mt-4 leading-relaxed text-graphite/75">{p}</p>)}
          {s.n === '03' && <div className="mt-6"><CapTable /></div>}
          {s.n === '06' && <p className="mt-4 rounded-card border border-graphite/20 px-4 py-3 text-sm text-graphite/70">{INVESTORS.placeholder}</p>}
        </section>
      ))}
      <section className="mt-16">
        <h2 className="font-brand text-2xl tracking-tight">Verified comps</h2>
        <table className="mt-6 w-full text-left text-sm"><tbody>
          {COMPS.map(([who, what]) => <tr key={who} className="border-b border-graphite/10"><th scope="row" className="py-3 pr-4 font-normal">{who}</th><td className="py-3">{what}</td></tr>)}
        </tbody></table>
      </section>
      <p className="mt-16 text-xs leading-relaxed text-graphite/45">Shared privately. Please do not forward this link.</p>
    </article>
  )
}
```

Section 03 renders the shared `CapTable`, so the investor table and the pricing table cannot drift apart.

- [ ] **Step 6: Run, expect PASS.** `git add lib/investor-auth.ts app/investors tests/investor-auth.test.ts && git commit -m "investors: gated page, investor: token namespace, 4-hour session"`

### Task 7: robots, sitemap, copy guardrails

**Files:** `app/robots.ts`, `app/sitemap.ts`, `tests/copy.test.ts`

- [ ] **Step 1: Failing assertions** Append to `tests/copy.test.ts` (`files` and `readFileSync` are already in scope there):

```ts
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
    const allowed = /(lib[\\/]plans\.ts|content[\\/]investors\.ts)$/ // either path separator: this runs on Windows too
    const src = files.filter((f) => !allowed.test(f)).map((f) => readFileSync(f, 'utf8')).join('\n')
    for (const price of ['$9', '$19', '$39', '$12', '$29', '$59']) {
      expect(src, `${price} typed outside lib/plans.ts`).not.toMatch(new RegExp(`\\${price}(?![\\d,])`))
    }
  })
})
```

`content/investors.ts` is allowed because the investor page states the prices as prose for a reader who is not buying; Task 4's test guards the cards. If this fires on an unrelated file, fix that file rather than widening the allowance.

- [ ] **Step 2: Edit `app/robots.ts`** (and add to its comment: "/investors is gated, noindex and absent from the sitemap, same four reasons as /listen")

```ts
        disallow: ['/api/', '/auth', '/investors', '/leads', '/listen', '/queue', '/studio'],
```

- [ ] **Step 3: Edit `app/sitemap.ts`**

```ts
  // /pricing and /artists joined 2026-09-22 with the two doors. /artists is Bot D's page and
  // this file is Bot B's, so the entry lands a few days before the page does on omega.
  return ['', '/pricing', '/artists', '/ai-music-translation', '/hear', '/about', '/contact'].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: 'monthly',
    priority: path === '' ? 1 : path === '/pricing' ? 0.9 : 0.7,
  }))
```

- [ ] **Step 4: Run, expect PASS** `npx vitest run tests/copy.test.ts`. `git add app/robots.ts app/sitemap.ts tests/copy.test.ts && git commit -m "seo: /investors hidden, /pricing and /artists in the sitemap, price and placeholder guardrails"`

### Task 8: Verify, look, PR

- [ ] **Step 1:** `npm test && npm run build`. Both green; no warning about dynamic usage on `/`.
- [ ] **Step 2: Phone-width check.** Add (or reuse) a `next dev` entry on port 3000 in `.claude/launch.json`, `preview_start` it, `resize_window` preset `mobile`, screenshot `/`, `/pricing` and `/investors` (the gate, then unlocked with a local `INVESTOR_PASSWORD` in `.env.local`, never committed). Check: no horizontal scroll, the three cards stack, the "Most fans" badge does not clip, the cap table fits at 375px, the nav's four labels sit on one row, no em dash on screen. Reset with preset `desktop`.
- [ ] **Step 3: No-JS check.** `curl -s localhost:3000/ | grep -c 'class="reveal'` is at least 5, and each of those elements contains its text in the static HTML (the `.js-motion` opt-in means no-JS visitors see everything).
- [ ] **Step 4: PR.** `git push -u origin feat/v2-marketing`. PR into `develop` titled "v2 marketing: two-doors landing, /pricing, gated /investors, nav". Body: the section map (reused / new / removed-but-kept), the env names Henry sets on omega (`INVESTOR_PASSWORD`, `COFFEY_ORIGINAL_PATH`, `COFFEY_COVER_PATH`, optional `COFFEY_BUCKET`), and the note that `/artists` 404s until Bot D merges. End the body with the attribution line the session reminder gives you.

## Done when

- `npm test && npm run build` green on `feat/v2-marketing`.
- `/` renders hero, steps, plans, beta, artist door, close; the Coffey section appears only once Henry's two files sign.
- `/pricing` shows `priceFor()` values with struck standard prices, the "Most fans" badge, "2 free re-rolls per track" on every card, the struck $2,000 anchor, the cap table and the five FAQ questions; every button goes to `/studio/sign-in?next=...billing?plan=<id>`.
- `/investors` asks for a password, an investor token opens nothing else, the page is noindex, disallowed and absent from the sitemap.
- Nav reads Home, Pricing, For artists, Studio; footer carries Pricing and For artists.
- PR open into `develop`, with the env names and the spelling question in the body.
