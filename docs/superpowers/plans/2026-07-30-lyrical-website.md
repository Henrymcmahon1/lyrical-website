# Lyrical Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Lyrical marketing website — a funnel-first, animated, three-route site that converts rights holders into enquiries stored in Supabase and emailed to the founder.

**Architecture:** Next.js App Router. All brand geometry (the ≈ mark, every animation state) is generated from one pure TypeScript module that evaluates cubic Béziers and offsets them along their normals — no DOM, no animation library, SSR-safe, and every state has an identical point count so path morphing is plain array interpolation. Motion is CSS transforms and opacity only, driven by native scroll-driven animations with an IntersectionObserver fallback. The enquiry form posts to one route handler that writes to Supabase and sends via Resend, where an email failure must never lose the lead.

**Tech Stack:** Next.js 16.2, React 19, TypeScript, Tailwind CSS 4.3, Lenis 1.3, `@supabase/supabase-js` 2.111, Resend 6.18, Zod 4.4, Vitest.

## Global Constraints

- **Colour tokens, exact values:** cream `#F7EFE1`, graphite `#1C1A19`, indigo `#4433D6`, ember `#EE4E22`. Dark treatment only: ground `#1B1D1F`, type/mark `#EDEBE4`, accent `#FF6B2C`.
- **Ember never carries body text** (3.2:1 on cream). Fills, large type and UI only.
- **Indigo is never used on the dark ground.**
- **No gradients anywhere, on any element.** Solid fills only.
- **The mark is never redrawn, rotated, outlined, recoloured two-tone, or given a container** — except the Unlock animation, which is the single sanctioned exception and returns to canonical form.
- Mark clear space ≥ 1 wave height. Minimum size 16 px.
- Typefaces: **Fraunces** (brand voice — headlines, wordmark, tagline) and **Archivo** (product voice — body, labels, forms, data). Self-hosted via `next/font/local`. **Never a font CDN.**
- Animate **only** `transform` and `opacity`. Never width, height, margin, top or left.
- All motion disabled under `prefers-reduced-motion: reduce`.
- The site must be readable and the form submittable with **JavaScript disabled**.
- No horizontal page scroll at any breakpoint.
- **Banned copy:** the phrase "AI-generated"; any population multiplier (`6.4×`, `2.38B`); the word "Solutions" as a nav item. Use *recreated*, *re-sung*, *performed*, *transcreation*.
- Languages stated on the site: EN, ES, IT, FR, PT, ZH, JA, KO (8). Tagline: "One song. Any language. Same soul."
- Deliverable described as **finished mix + dry vocal stem**.
- Secrets live only in `.env.local` / Vercel env vars. `.env.local` is gitignored and never committed.

---

## File Structure

| Path | Responsibility |
|---|---|
| `app/layout.tsx` | Root shell, fonts, metadata, `<Nav>`, `<Footer>` |
| `app/page.tsx` | Home — composes the ten sections |
| `app/hear/page.tsx` | Gated demo page |
| `app/about/page.tsx` | Story, team, rights position |
| `app/api/enquiry/route.ts` | Validate → Supabase → Resend → set cookie |
| `app/globals.css` | Tailwind import, `@theme` tokens, keyframes, reduced-motion |
| `lib/mark.ts` | **Pure geometry.** Bézier sampling, normal offset, taper, path strings, lerp |
| `lib/mark-states.ts` | Named outline sets: `pause`, `equal`, `approx` |
| `lib/languages.ts` | The 8 languages: code, endonym, English name |
| `lib/enquiry-schema.ts` | Zod schema shared by client and server |
| `lib/supabase-admin.ts` | Server-only Supabase client (service key) |
| `lib/gate.ts` | Sign/verify the unlock cookie |
| `content/demos.json` | Audio manifest — which pairs and tracks exist |
| `components/Mark.tsx` | Canonical static mark |
| `components/MarkUnlock.tsx` | The ‖→=→≈ animation |
| `components/MarkLiving.tsx` | Breathing hero mark |
| `components/Divider.tsx` | Self-stroking section rule |
| `components/Reveal.tsx` | Scroll-reveal wrapper |
| `components/SmoothScroll.tsx` | Lenis provider |
| `components/Wheels.tsx` | Language reels (listbox) |
| `components/AbPlayer.tsx` | Original ↔ translated audio |
| `components/EnquiryForm.tsx` | Form UI + client validation |
| `components/EnquiryOverlay.tsx` | Modal wrapper for the form |
| `components/sections/*.tsx` | One file per home section, `S01`–`S10` |
| `tests/*.test.ts` | Vitest — geometry, contrast, schema, route handler |
| `CLAUDE.md` | Locked brand tokens so they can't drift |

---

## Task 1: Scaffold, tokens, fonts

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `.gitignore`, `.env.example`, `CLAUDE.md`, `lib/fonts.ts`
- Test: `tests/tokens.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: CSS custom properties `--color-cream|graphite|indigo|ember|dark-ground|dark-ink|dark-accent`; `lib/fonts.ts` exporting `bodoni` and `archivo` (each with `.variable`); Tailwind utilities `font-brand`, `font-product`

- [ ] **Step 1: Scaffold**

```bash
cd /c/Users/User/Documents/Claude/lyrical-website
npx --yes create-next-app@latest . --ts --app --tailwind --eslint --no-src-dir --import-alias "@/*" --use-npm --yes
```

If it refuses because `docs/` exists, scaffold into a temp dir and copy in:

```bash
npx --yes create-next-app@latest ../_lyr_tmp --ts --app --tailwind --eslint --no-src-dir --import-alias "@/*" --use-npm --yes
cp -r ../_lyr_tmp/. . && rm -rf ../_lyr_tmp
```

- [ ] **Step 2: Read what the scaffold produced**

Read `app/globals.css`, `postcss.config.mjs` and `package.json`. Tailwind 4 is CSS-first — tokens go in an `@theme` block in CSS, **not** a `tailwind.config.js`. Confirm this before writing tokens.

- [ ] **Step 3: Install runtime deps**

```bash
npm i @supabase/supabase-js resend zod lenis
npm i -D vitest @vitejs/plugin-react jsdom
```

- [ ] **Step 4: Download the fonts**

```bash
mkdir -p public/fonts
curl -L -o public/fonts/BodoniModa.ttf "https://github.com/google/fonts/raw/main/ofl/bodonimoda/BodoniModa%5Bopsz%2Cwght%5D.ttf"
curl -L -o public/fonts/Archivo.ttf "https://github.com/google/fonts/raw/main/ofl/archivo/Archivo%5Bwdth%2Cwght%5D.ttf"
ls -la public/fonts
```

Both must be > 100 KB. If a URL 404s, find the current path under `https://github.com/google/fonts/tree/main/ofl/<family>` — do not fall back to a CDN link.

- [ ] **Step 5: `lib/fonts.ts`**

```ts
import localFont from 'next/font/local'

export const bodoni = localFont({
  src: '../public/fonts/BodoniModa.ttf',
  variable: '--font-brand',
  display: 'swap',
  weight: '400 900',
})

export const archivo = localFont({
  src: '../public/fonts/Archivo.ttf',
  variable: '--font-product',
  display: 'swap',
  weight: '100 900',
})
```

- [ ] **Step 6: Replace `app/globals.css`**

```css
@import "tailwindcss";

@theme {
  --color-cream:       #F7EFE1;
  --color-graphite:    #1C1A19;
  --color-indigo:      #4433D6;
  --color-ember:       #EE4E22;
  --color-dark-ground: #1B1D1F;
  --color-dark-ink:    #EDEBE4;
  --color-dark-accent: #FF6B2C;

  --font-brand:   var(--font-brand), Georgia, "Times New Roman", serif;
  --font-product: var(--font-product), system-ui, sans-serif;
}

html { scroll-behavior: smooth; }

body {
  background: var(--color-cream);
  color: var(--color-graphite);
  font-family: var(--font-product);
  -webkit-font-smoothing: antialiased;
}

/* Ember is a fill, never body text — enforced by review, asserted in tests. */

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 7: `app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { bodoni, archivo } from '@/lib/fonts'
import './globals.css'

export const metadata: Metadata = {
  title: 'Lyrical — One song. Any language. Same soul.',
  description:
    'Lyrical recreates a finished record in another language, in the artist’s own voice, over the untouched original backing.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bodoni.variable} ${archivo.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 8: Write the failing token test**

```ts
// tests/tokens.test.ts
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

const css = readFileSync('app/globals.css', 'utf8')

// Relative luminance per WCAG 2.1
function lum(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const l = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]
}
function ratio(a: string, b: string) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

const CREAM = '#F7EFE1', GRAPHITE = '#1C1A19', INDIGO = '#4433D6', EMBER = '#EE4E22'
const DARK_GROUND = '#1B1D1F', DARK_INK = '#EDEBE4', DARK_ACCENT = '#FF6B2C'

describe('brand tokens', () => {
  it('declares every locked token verbatim', () => {
    for (const hex of [CREAM, GRAPHITE, INDIGO, EMBER, DARK_GROUND, DARK_INK, DARK_ACCENT]) {
      expect(css).toContain(hex)
    }
  })

  it('never declares a gradient', () => {
    expect(css).not.toMatch(/linear-gradient|radial-gradient|conic-gradient/)
  })

  it('graphite and indigo pass AA for body text on cream', () => {
    expect(ratio(GRAPHITE, CREAM)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(INDIGO, CREAM)).toBeGreaterThanOrEqual(4.5)
  })

  it('ember fails body text on cream — this is why it is fill-only', () => {
    expect(ratio(EMBER, CREAM)).toBeLessThan(4.5)
  })

  it('dark treatment passes AA', () => {
    expect(ratio(DARK_INK, DARK_GROUND)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(DARK_ACCENT, DARK_GROUND)).toBeGreaterThanOrEqual(4.5)
  })
})
```

- [ ] **Step 9: Wire Vitest, run the test, watch it pass**

Add to `package.json` scripts: `"test": "vitest run"`.

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { environment: 'node', include: ['tests/**/*.test.ts'] } })
```

Run: `npm test`
Expected: 5 passing. If the ember assertion fails, the palette was mistyped — fix the CSS, not the test.

- [ ] **Step 10: `.env.example`, `.gitignore`, `CLAUDE.md`**

`.env.example`:

```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
ENQUIRY_TO_EMAIL=henry.jamcmahon@gmail.com
ENQUIRY_FROM_EMAIL=onboarding@resend.dev
GATE_SECRET=
```

Confirm `.gitignore` contains `.env*.local`. Add it if absent.

`CLAUDE.md`:

```markdown
# Lyrical website

Brand is LOCKED. Do not invent colours, faces, or redraw the mark.
Spec: docs/superpowers/specs/2026-07-30-lyrical-website-design.md

## Tokens
cream #F7EFE1 (space) · graphite #1C1A19 (type) · indigo #4433D6 (identity) · ember #EE4E22 (action)
Dark sections only: ground #1B1D1F · ink #EDEBE4 · accent #FF6B2C

## Hard rules
- No gradients, anywhere.
- Ember never carries body text (3.2:1 on cream). Fills and large type only.
- Indigo is never used on the dark ground.
- Animate transform and opacity only.
- Fonts: Fraunces (brand voice) + Archivo (product voice), self-hosted. Never a CDN.
- Banned copy: "AI-generated", "6.4x", "2.38B", "Solutions".
  Say: recreated, re-sung, performed, transcreation.
- All motion off under prefers-reduced-motion.
```

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js app with locked brand tokens and self-hosted fonts"
```

---

## Task 2: The mark — pure geometry

**Files:**
- Create: `lib/mark.ts`, `lib/mark-states.ts`, `components/Mark.tsx`
- Test: `tests/mark.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type Pt = { x: number; y: number }`
  - `ART = 64`
  - `cubic(p0, p1, p2, p3, t): Pt`
  - `sampleCentreline(segs: [Pt,Pt,Pt,Pt][], n: number): Pt[]`
  - `outline(centre: Pt[], wmax: number, power: number): Pt[]`
  - `toPath(pts: Pt[]): string`
  - `lerpOutline(a: Pt[], b: Pt[], t: number): Pt[]`
  - `SAMPLES = 58`
  - From `mark-states`: `APPROX`, `EQUAL` — each `{ top: Pt[]; bottom: Pt[] }` of outline points
  - `<Mark size?: number, className?: string, title?: string />`

- [ ] **Step 1: Write the failing geometry test**

```ts
// tests/mark.test.ts
import { describe, it, expect } from 'vitest'
import { cubic, sampleCentreline, outline, toPath, lerpOutline, SAMPLES } from '@/lib/mark'
import { APPROX, EQUAL } from '@/lib/mark-states'

describe('cubic', () => {
  it('hits both endpoints exactly', () => {
    const p = [{x:0,y:0},{x:0,y:10},{x:10,y:10},{x:10,y:0}] as const
    expect(cubic(...p, 0)).toEqual({ x: 0, y: 0 })
    expect(cubic(...p, 1)).toEqual({ x: 10, y: 0 })
  })
})

describe('sampleCentreline', () => {
  it('returns exactly n points', () => {
    const seg: [any,any,any,any] = [{x:0,y:0},{x:1,y:1},{x:2,y:1},{x:3,y:0}]
    expect(sampleCentreline([seg, seg], 58)).toHaveLength(58)
  })
})

describe('outline', () => {
  const centre = sampleCentreline(
    [[{x:7,y:20},{x:14,y:8},{x:22,y:8},{x:32,y:20}],
     [{x:32,y:20},{x:42,y:32},{x:50,y:32},{x:57,y:20}]], SAMPLES)

  it('produces two points per sample (both sides)', () => {
    expect(outline(centre, 4.6, 0.62)).toHaveLength(SAMPLES * 2)
  })

  it('tapers to zero width at both tips', () => {
    const o = outline(centre, 4.6, 0.62)
    const firstUp = o[0], lastDn = o[o.length - 1]
    expect(Math.hypot(firstUp.x - lastDn.x, firstUp.y - lastDn.y)).toBeLessThan 0.01
  })

  it('is widest near the middle', () => {
    const o = outline(centre, 4.6, 0.62)
    const width = (i: number) =>
      Math.hypot(o[i].x - o[o.length - 1 - i].x, o[i].y - o[o.length - 1 - i].y)
    expect(width(Math.floor(SAMPLES / 2))).toBeGreaterThan(width(3))
  })

  it('stays inside the 64-unit artboard', () => {
    for (const p of outline(centre, 4.6, 0.62)) {
      expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x).toBeLessThanOrEqual(64)
      expect(p.y).toBeGreaterThanOrEqual(0); expect(p.y).toBeLessThanOrEqual(64)
    }
  })
})

describe('morph compatibility', () => {
  it('every state has identical point counts — this is what makes lerp work', () => {
    expect(APPROX.top).toHaveLength(EQUAL.top.length)
    expect(APPROX.bottom).toHaveLength(EQUAL.bottom.length)
  })

  it('lerp at 0 and 1 returns the endpoints', () => {
    expect(lerpOutline(EQUAL.top, APPROX.top, 0)).toEqual(EQUAL.top)
    expect(lerpOutline(EQUAL.top, APPROX.top, 1)).toEqual(APPROX.top)
  })
})

describe('asymmetry', () => {
  it('the lower wave differs from the upper — the mark means approximately equal', () => {
    const shifted = APPROX.top.map((p) => ({ x: p.x, y: p.y + 24 }))
    const maxDelta = Math.max(...APPROX.bottom.map((p, i) =>
      Math.hypot(p.x - shifted[i].x, p.y - shifted[i].y)))
    expect(maxDelta).toBeGreaterThan(0.4)
  })
})

describe('toPath', () => {
  it('emits a closed path with no NaN', () => {
    const d = toPath(APPROX.top)
    expect(d.startsWith('M')).toBe(true)
    expect(d.endsWith('Z')).toBe(true)
    expect(d).not.toContain('NaN')
  })
})
```

Note: `expect(...).toBeLessThan 0.01` above is a deliberate syntax error to catch — write it as `expect(...).toBeLessThan(0.01)`.

- [ ] **Step 2: Run it, confirm it fails**

Run: `npm test -- tests/mark.test.ts`
Expected: FAIL — cannot resolve `@/lib/mark`.

Add the alias to `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'
export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, '.') } },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
})
```

- [ ] **Step 3: Implement `lib/mark.ts`**

```ts
export type Pt = { x: number; y: number }
export type Seg = [Pt, Pt, Pt, Pt]

export const ART = 64
export const SAMPLES = 58
export const WMAX = 4.6
export const POWER_WAVE = 0.62
export const POWER_BAR = 0.18

export function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  }
}

/** Sample `n` points across all segments, evenly in t per segment. */
export function sampleCentreline(segs: Seg[], n: number): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < n; i++) {
    const g = (i / (n - 1)) * segs.length          // global position in segment space
    const si = Math.min(Math.floor(g), segs.length - 1)
    const t = g - si
    out.push(cubic(...segs[si], t))
  }
  return out
}

/**
 * Offset a centreline along its normal by w(t) = wmax * sin(pi*t)^power,
 * returning a closed outline: forward along one side, back along the other.
 * Width reaches zero at both tips, so the stroke comes to a point.
 */
export function outline(centre: Pt[], wmax = WMAX, power = POWER_WAVE): Pt[] {
  const n = centre.length
  const up: Pt[] = [], dn: Pt[] = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const a = centre[Math.max(0, i - 1)]
    const b = centre[Math.min(n - 1, i + 1)]
    const dx = b.x - a.x, dy = b.y - a.y
    const m = Math.hypot(dx, dy) || 1
    const nx = -dy / m, ny = dx / m
    const w = wmax * Math.pow(Math.sin(Math.PI * t), power)
    up.push({ x: centre[i].x + nx * w, y: centre[i].y + ny * w })
    dn.push({ x: centre[i].x - nx * w, y: centre[i].y - ny * w })
  }
  return [...up, ...dn.reverse()]
}

export function toPath(pts: Pt[]): string {
  const f = (v: number) => Math.round(v * 100) / 100
  return `M ${f(pts[0].x)} ${f(pts[0].y)} ` +
    pts.slice(1).map((p) => `L ${f(p.x)} ${f(p.y)}`).join(' ') + ' Z'
}

export function lerpOutline(a: Pt[], b: Pt[], t: number): Pt[] {
  if (a.length !== b.length) throw new Error(`outline length mismatch: ${a.length} vs ${b.length}`)
  if (t <= 0) return a
  if (t >= 1) return b
  return a.map((p, i) => ({ x: p.x + (b[i].x - p.x) * t, y: p.y + (b[i].y - p.y) * t }))
}
```

- [ ] **Step 4: Implement `lib/mark-states.ts`**

```ts
import { outline, sampleCentreline, POWER_BAR, POWER_WAVE, SAMPLES, type Pt, type Seg } from './mark'

/** Upper wave: rises then falls, spanning x 7..57 about y=20. */
const UPPER: Seg[] = [
  [{x:7,y:20},{x:14,y:8},{x:22,y:8},{x:32,y:20}],
  [{x:32,y:20},{x:42,y:32},{x:50,y:32},{x:57,y:20}],
]

/**
 * Lower wave at 6% divergence. Same envelope, different signal — the mark means
 * approximately equal, not equal. Do not "tidy" these control points to match UPPER.
 */
const LOWER: Seg[] = [
  [{x:7,y:44},{x:12.9,y:38.2},{x:23.6,y:34.3},{x:32,y:44}],
  [{x:32,y:44},{x:41.4,y:53.7},{x:50.8,y:50.9},{x:57,y:42.9}],
]

/** Straight bars at the same y positions — the `=` state. */
const BAR_TOP: Seg[] = [
  [{x:7,y:20},{x:24,y:20},{x:40,y:20},{x:57,y:20}],
]
const BAR_BOTTOM: Seg[] = [
  [{x:7,y:44},{x:24,y:44},{x:40,y:44},{x:57,y:44}],
]

export type MarkState = { top: Pt[]; bottom: Pt[] }

export const APPROX: MarkState = {
  top: outline(sampleCentreline(UPPER, SAMPLES), undefined, POWER_WAVE),
  bottom: outline(sampleCentreline(LOWER, SAMPLES), undefined, POWER_WAVE),
}

export const EQUAL: MarkState = {
  top: outline(sampleCentreline(BAR_TOP, SAMPLES), undefined, POWER_BAR),
  bottom: outline(sampleCentreline(BAR_BOTTOM, SAMPLES), undefined, POWER_BAR),
}
```

- [ ] **Step 5: Run the tests**

Run: `npm test -- tests/mark.test.ts`
Expected: all PASS. If "stays inside the artboard" fails, a LOWER control point pushed past 64 — clamp the control point, never the output.

- [ ] **Step 6: `components/Mark.tsx`**

```tsx
import { toPath } from '@/lib/mark'
import { APPROX } from '@/lib/mark-states'

const TOP = toPath(APPROX.top)
const BOTTOM = toPath(APPROX.bottom)

export function Mark({ size = 40, className = '', title }: {
  size?: number; className?: string; title?: string
}) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className}
         role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}
         aria-label={title}>
      <path d={TOP} fill="currentColor" />
      <path d={BOTTOM} fill="currentColor" />
    </svg>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add lib components/Mark.tsx tests/mark.test.ts vitest.config.ts
git commit -m "feat: generate the approximation mark from pure Bezier geometry"
```

---

## Task 3: Shell — nav, footer, smooth scroll

**Files:**
- Create: `components/Nav.tsx`, `components/Footer.tsx`, `components/SmoothScroll.tsx`, `components/Wordmark.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `Mark` from Task 2
- Produces: `<Nav>`, `<Footer>`, `<SmoothScroll>`, `<Wordmark size?: 'sm'|'lg'>`

- [ ] **Step 1: `components/Wordmark.tsx` — horizontal utility lockup**

```tsx
import { Mark } from './Mark'

export function Wordmark({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const mark = size === 'lg' ? 40 : 26
  return (
    <span className="inline-flex items-center gap-3">
      <Mark size={mark} className="text-indigo" />
      <span className={`font-brand tracking-tight ${size === 'lg' ? 'text-4xl' : 'text-2xl'}`}>
        lyrical
      </span>
    </span>
  )
}
```

- [ ] **Step 2: `components/SmoothScroll.tsx`**

```tsx
'use client'
import { useEffect } from 'react'
import Lenis from 'lenis'

export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const lenis = new Lenis({ duration: 1.1, smoothWheel: true })
    let id = 0
    const raf = (t: number) => { lenis.raf(t); id = requestAnimationFrame(raf) }
    id = requestAnimationFrame(raf)
    return () => { cancelAnimationFrame(id); lenis.destroy() }
  }, [])
  return null
}
```

- [ ] **Step 3: `components/Nav.tsx`**

Nav items are **Hear it · How it works · About** — never "Solutions".

```tsx
import Link from 'next/link'
import { Wordmark } from './Wordmark'

export function Nav() {
  return (
    <header className="sticky top-0 z-40 bg-cream/90 backdrop-blur-sm">
      <nav className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4"
           aria-label="Primary">
        <Link href="/" className="focus-visible:outline-2 focus-visible:outline-indigo">
          <Wordmark />
        </Link>
        <div className="ml-auto flex items-center gap-6 text-sm">
          <Link href="/hear" className="hover:text-indigo">Hear it</Link>
          <Link href="/#how" className="hidden hover:text-indigo sm:inline">How it works</Link>
          <Link href="/about" className="hover:text-indigo">About</Link>
          <Link href="/#enquire"
                className="bg-indigo px-4 py-2 text-cream hover:bg-graphite">
            Start a conversation
          </Link>
        </div>
      </nav>
    </header>
  )
}
```

- [ ] **Step 4: `components/Footer.tsx`**

Stacked lockup (the primary arrangement), the tagline, and the ≈ grammar line.

```tsx
import { Mark } from './Mark'

export function Footer() {
  return (
    <footer className="mt-32 border-t border-graphite/15 px-6 py-16">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 text-center">
        <Mark size={44} className="text-indigo" />
        <span className="font-brand text-3xl tracking-tight">lyrical</span>
        <p className="font-brand text-lg text-graphite/70">One song. Any language. Same soul.</p>
        <p className="mt-6 font-mono text-xs tracking-widest text-graphite/50">
          english &#8776; espa&ntilde;ol
        </p>
        <p className="text-xs text-graphite/50">
          Artist voices are used only with the artist&rsquo;s or rights holder&rsquo;s permission.
        </p>
      </div>
    </footer>
  )
}
```

- [ ] **Step 5: Wire into `app/layout.tsx`**

Add inside `<body>`: `<SmoothScroll />`, `<Nav />`, `<main>{children}</main>`, `<Footer />`.

- [ ] **Step 6: Verify it runs**

```bash
npm run dev
```

Then load `http://localhost:3000` via the browser tool, screenshot, and confirm: mark visible in indigo, wordmark in Bodoni (a serif — if it looks like Arial the font failed to load, check the Network panel for the font request), no horizontal scroll.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: app shell with nav, stacked-lockup footer and smooth scroll"
```

---

## Task 4: Motion primitives

**Files:**
- Create: `components/Reveal.tsx`, `components/Divider.tsx`
- Modify: `app/globals.css` (keyframes)

**Interfaces:**
- Consumes: `APPROX`, `toPath`
- Produces: `<Reveal delay?: number, children>`, `<Divider />`

- [ ] **Step 1: Add keyframes to `app/globals.css`**

```css
@keyframes rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
@keyframes sway { from { transform: translateX(-1.5%) scaleY(0.97); } to { transform: translateX(1.5%) scaleY(1.03); } }
@keyframes draw { from { stroke-dashoffset: 260; } to { stroke-dashoffset: 0; } }

.reveal { animation: rise 0.75s cubic-bezier(.16,.84,.34,1) both; }

/* Native scroll-driven where supported; IntersectionObserver fallback otherwise. */
@supports (animation-timeline: view()) {
  .reveal { animation-timeline: view(); animation-range: entry 0% entry 60%; }
}
@supports not (animation-timeline: view()) {
  .reveal { animation-play-state: paused; }
  .reveal.in { animation-play-state: running; }
}
```

- [ ] **Step 2: `components/Reveal.tsx`**

```tsx
'use client'
import { useEffect, useRef } from 'react'

export function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (CSS.supports('animation-timeline: view()')) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) { el.classList.add('in'); io.unobserve(el) } }),
      { threshold: 0.2 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return <div ref={ref} className="reveal" style={{ animationDelay: `${delay}ms` }}>{children}</div>
}
```

- [ ] **Step 3: `components/Divider.tsx`**

Strokes the two waves on as it enters view. Uses the centrelines as strokes rather than the filled outline, because `stroke-dasharray` needs a stroked path.

```tsx
export function Divider() {
  return (
    <div className="mx-auto my-24 max-w-6xl px-6" aria-hidden="true">
      <svg viewBox="0 0 640 24" className="h-6 w-full text-indigo/40" preserveAspectRatio="none">
        <path d="M0 8 C 70 -4, 150 -4, 250 8 C 350 20, 430 20, 500 8 C 560 -2, 600 -2, 640 6"
              fill="none" stroke="currentColor" strokeWidth="1.5"
              style={{ strokeDasharray: 260, animation: 'draw 1.6s ease-out both' }} />
        <path d="M0 18 C 60 10, 160 6, 250 18 C 340 30, 440 26, 500 18 C 555 11, 605 12, 640 17"
              fill="none" stroke="currentColor" strokeWidth="1.5"
              style={{ strokeDasharray: 260, animation: 'draw 1.6s ease-out 0.2s both' }} />
      </svg>
    </div>
  )
}
```

- [ ] **Step 4: Verify reduced motion**

In the browser tool, emulate `prefers-reduced-motion: reduce`, reload, and confirm content is visible and static (the global media query collapses durations to 0.001ms, so nothing is stuck invisible). **A reveal that leaves content at `opacity: 0` is a blocking bug** — the `both` fill plus the collapsed duration must land on the end state.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: scroll-reveal and self-drawing divider primitives"
```

---

## Task 5: The Unlock + the Living Mark

**Files:**
- Create: `components/MarkUnlock.tsx`, `components/MarkLiving.tsx`
- Test: `tests/unlock.test.ts`

**Interfaces:**
- Consumes: `lerpOutline`, `toPath`, `APPROX`, `EQUAL`
- Produces: `<MarkUnlock size?: number />`, `<MarkLiving size?: number />`

**The three beats.** Bars are drawn horizontally and the group starts rotated −90°, so they *appear* vertical (pause). Beat 1→2 animates rotation to 0 — a compositor transform, free. Beat 2→3 morphs `EQUAL`→`APPROX` by interpolating outline arrays, which is only possible because both have identical point counts.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unlock.test.ts
import { describe, it, expect } from 'vitest'
import { lerpOutline, toPath } from '@/lib/mark'
import { APPROX, EQUAL } from '@/lib/mark-states'

describe('unlock morph', () => {
  it('produces a valid path at every step of the morph', () => {
    for (let i = 0; i <= 20; i++) {
      const d = toPath(lerpOutline(EQUAL.top, APPROX.top, i / 20))
      expect(d).not.toContain('NaN')
      expect(d.startsWith('M')).toBe(true)
    }
  })

  it('the bar state is flatter than the wave state', () => {
    const spread = (pts: { y: number }[]) =>
      Math.max(...pts.map(p => p.y)) - Math.min(...pts.map(p => p.y))
    expect(spread(EQUAL.top)).toBeLessThan(spread(APPROX.top))
  })
})
```

- [ ] **Step 2: Run it**

Run: `npm test -- tests/unlock.test.ts`
Expected: PASS (geometry already exists). If the second assertion fails, `POWER_BAR` is producing a fatter bar than intended — lower it.

- [ ] **Step 3: `components/MarkUnlock.tsx`**

```tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { lerpOutline, toPath } from '@/lib/mark'
import { APPROX, EQUAL } from '@/lib/mark-states'

const ROTATE_MS = 620
const HOLD_MS = 180
const MORPH_MS = 900

export function MarkUnlock({ size = 190 }: { size?: number }) {
  const [rot, setRot] = useState(-90)
  const [t, setT] = useState(0)
  const raf = useRef(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setRot(0); setT(1); return
    }
    const t0 = performance.now()
    const ease = (x: number) => 1 - Math.pow(1 - x, 3)
    const tick = (now: number) => {
      const e = now - t0
      if (e < ROTATE_MS) {
        setRot(-90 + 90 * ease(e / ROTATE_MS))
      } else if (e < ROTATE_MS + HOLD_MS) {
        setRot(0)
      } else {
        const p = Math.min(1, (e - ROTATE_MS - HOLD_MS) / MORPH_MS)
        setRot(0); setT(ease(p))
        if (p >= 1) return
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [])

  const top = toPath(lerpOutline(EQUAL.top, APPROX.top, t))
  const bottom = toPath(lerpOutline(EQUAL.bottom, APPROX.bottom, t))

  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img"
         aria-label="The Lyrical mark: a pause becoming an approximation">
      <g transform={`rotate(${rot.toFixed(2)} 32 32)`}>
        <path d={top} fill="currentColor" />
        <path d={bottom} fill="currentColor" />
      </g>
    </svg>
  )
}
```

- [ ] **Step 4: `components/MarkLiving.tsx`**

CSS-only sway on the two paths — transform and opacity only, so it stays on the compositor. Canonical geometry is untouched.

```tsx
import { toPath } from '@/lib/mark'
import { APPROX } from '@/lib/mark-states'

const TOP = toPath(APPROX.top)
const BOTTOM = toPath(APPROX.bottom)

export function MarkLiving({ size = 190 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <path d={TOP} fill="currentColor"
            style={{ transformOrigin: '32px 20px',
                     animation: 'sway 6s cubic-bezier(.45,0,.55,1) infinite alternate' }} />
      <path d={BOTTOM} fill="currentColor"
            style={{ transformOrigin: '32px 44px',
                     animation: 'sway 6s cubic-bezier(.45,0,.55,1) 0.4s infinite alternate-reverse' }} />
    </svg>
  )
}
```

- [ ] **Step 5: Visual verification**

Render `MarkUnlock` on the home page temporarily. In the browser tool: reload, screenshot at ~300 ms, ~800 ms and ~2 s. Confirm the sequence reads vertical bars → horizontal bars → waves, and the final frame matches `<Mark>` exactly. **If the final frame differs from the canonical mark, the morph endpoint is wrong** — the guardrail is that the animation always resolves to the real logo.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: the Unlock animation and the living hero mark"
```

---

## Task 6: Home sections 01, 02, 04, 05, 06, 07, 08

**Files:**
- Create: `components/sections/S01Hero.tsx`, `S02Border.tsx`, `S04Fidelity.tsx`, `S05How.tsx`, `S06Receive.tsx`, `S07Doors.tsx`, `S08Rights.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `MarkUnlock`, `MarkLiving`, `Reveal`, `Divider`
- Produces: seven section components, each a default-exported function taking no props

Copy is drawn from the Client Overview and capability documents. **Do not invent claims.**

- [ ] **Step 1: `S01Hero.tsx`**

```tsx
import { MarkUnlock } from '../MarkUnlock'

export default function S01Hero() {
  return (
    <section className="mx-auto flex min-h-[86vh] max-w-6xl flex-col items-center justify-center px-6 text-center">
      <div className="text-indigo"><MarkUnlock size={168} /></div>
      <h1 className="mt-10 font-brand text-5xl leading-[1.02] tracking-tight text-balance sm:text-7xl">
        One song. Any language.<br />Same soul.
      </h1>
      <p className="mt-8 max-w-xl text-lg text-graphite/75">
        We recreate a finished record in another language so it sounds like the artist genuinely
        recorded it that way &mdash; the melody, the rhythm and the feel kept intact, sung in the
        artist&rsquo;s own voice, over the untouched original backing.
      </p>
      <a href="#hear" className="mt-10 bg-ember px-7 py-4 text-cream">
        Hear a before and after
      </a>
    </section>
  )
}
```

- [ ] **Step 2: `S02Border.tsx`**

```tsx
import { Reveal } from '../Reveal'

export default function S02Border() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-24">
      <Reveal>
        <h2 className="font-brand text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
          A great song stops at a language border.
        </h2>
      </Reveal>
      <Reveal delay={120}>
        <p className="mt-8 max-w-2xl text-lg text-graphite/75">
          Subtitles don&rsquo;t sing, and a cover by a different singer isn&rsquo;t the same record.
          Traditional localisation means booking the artist, a studio, a translator and an
          engineer &mdash; so it only ever happens for the biggest releases.
        </p>
      </Reveal>
    </section>
  )
}
```

- [ ] **Step 3: `S04Fidelity.tsx` — sticky pin, four claims**

Left column sticks while the four claims scroll past it.

```tsx
import { MarkLiving } from '../MarkLiving'
import { Reveal } from '../Reveal'

const CLAIMS = [
  { h: 'The artist’s real voice',
    p: 'Not a cover and not a soundalike. The new vocal carries the artist’s own timbre and character.' },
  { h: 'The original melody and feel',
    p: 'We never rewrite the tune. New lyrics are crafted to sing naturally on the exact original melody, rhythm and phrasing.' },
  { h: 'The backing stays untouched',
    p: 'Only the vocal changes. The original instrumental, groove and production are delivered exactly as they were.' },
  { h: 'Natural, singable translations',
    p: 'Never literal or robotic. Rewritten to feel native in the new language while staying true to the meaning of the original.' },
]

export default function S04Fidelity() {
  return (
    <section className="mx-auto grid max-w-6xl gap-16 px-6 py-24 md:grid-cols-2">
      <div className="md:sticky md:top-32 md:self-start">
        <div className="text-indigo"><MarkLiving size={150} /></div>
        <h2 className="mt-8 font-brand text-4xl leading-tight tracking-tight">
          What changes is the language. Nothing else.
        </h2>
      </div>
      <ul className="flex flex-col gap-14">
        {CLAIMS.map((c, i) => (
          <li key={c.h}>
            <Reveal delay={i * 60}>
              <span className="font-mono text-xs tracking-[0.18em] text-graphite/45">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-3 font-brand text-2xl tracking-tight">{c.h}</h3>
              <p className="mt-3 text-graphite/75">{c.p}</p>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  )
}
```

- [ ] **Step 4: `S05How.tsx`**

Four numbered steps. Numbering is legitimate here — it is a real sequence.

```tsx
import { Reveal } from '../Reveal'

const STEPS = [
  { h: 'You send the song', p: 'The finished master, and the language or languages you want it in.' },
  { h: 'We recreate the lyrics', p: 'Rewritten to sing naturally on the original melody and rhythm, syllable by syllable.' },
  { h: 'We sing it in the voice', p: 'The vocal is performed in the artist’s own voice, in the new language.' },
  { h: 'You receive the assets', p: 'A finished mix plus a dry vocal stem, reviewed by ear before delivery.' },
]

export default function S05How() {
  return (
    <section id="how" className="mx-auto max-w-6xl px-6 py-24">
      <h2 className="font-brand text-4xl leading-tight tracking-tight sm:text-5xl">How it works</h2>
      <ol className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.h}>
            <Reveal delay={i * 80}>
              <span className="font-mono text-xs tracking-[0.18em] text-indigo">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-3 font-brand text-2xl tracking-tight">{s.h}</h3>
              <p className="mt-3 text-sm text-graphite/75">{s.p}</p>
            </Reveal>
          </li>
        ))}
      </ol>
    </section>
  )
}
```

- [ ] **Step 5: `S06Receive.tsx`**

```tsx
import { Reveal } from '../Reveal'

const ITEMS = [
  { h: 'Finished full mix', p: 'Matched to the original record’s vocal balance.' },
  { h: 'Dry vocal stem', p: 'Unprocessed, for your own engineer to mix.' },
  { h: 'Reference versions', p: 'For A/B comparison against the original.' },
  { h: 'A per-song report', p: 'What was covered, what was left original, and where.' },
]

export default function S06Receive() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <h2 className="font-brand text-4xl leading-tight tracking-tight sm:text-5xl">What you receive</h2>
      <div className="mt-14 grid gap-px border border-graphite/15 bg-graphite/15 sm:grid-cols-2">
        {ITEMS.map((it, i) => (
          <div key={it.h} className="bg-cream p-8">
            <Reveal delay={i * 70}>
              <h3 className="font-brand text-2xl tracking-tight">{it.h}</h3>
              <p className="mt-3 text-graphite/75">{it.p}</p>
            </Reveal>
          </div>
        ))}
      </div>
      <p className="mt-8 max-w-2xl text-sm text-graphite/60">
        You keep full creative and mixing control. Every song is checked by ear, and we iterate
        with you until the phrasing, pronunciation and feel are right.
      </p>
    </section>
  )
}
```

- [ ] **Step 6: `S07Doors.tsx`**

```tsx
const DOORS = [
  { k: 'For artists and managers', h: 'One flagship release.',
    p: 'Open a song to a new market without re-recording it. Artist-approved, and delivered ready for release.',
    cta: 'Start with one song' },
  { k: 'For labels and catalogue owners', h: 'A catalogue programme.',
    p: 'Selected high-performing songs, priority territories, authorised asset creation, and reporting that feeds the next round of decisions.',
    cta: 'Discuss a catalogue programme' },
]

export default function S07Doors() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="grid gap-px border border-graphite/15 bg-graphite/15 md:grid-cols-2">
        {DOORS.map((d) => (
          <div key={d.h} className="flex flex-col bg-cream p-10">
            <span className="font-mono text-xs tracking-[0.16em] text-graphite/45">{d.k}</span>
            <h3 className="mt-4 font-brand text-3xl leading-tight tracking-tight">{d.h}</h3>
            <p className="mt-4 text-graphite/75">{d.p}</p>
            <a href="#enquire" className="mt-8 self-start border border-indigo px-5 py-3 text-sm text-indigo hover:bg-indigo hover:text-cream">
              {d.cta}
            </a>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 7: `S08Rights.tsx` — deliberately still, no animation**

```tsx
export default function S08Rights() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-24 text-center">
      <span className="font-mono text-xs tracking-[0.18em] text-graphite/45">Rights first</span>
      <h2 className="mt-5 font-brand text-3xl leading-snug tracking-tight text-balance sm:text-4xl">
        An artist&rsquo;s voice is used only with the artist&rsquo;s or rights holder&rsquo;s permission.
      </h2>
      <p className="mt-6 text-graphite/75">
        Every version is authorised before it is made, and reviewed by ear before it is delivered.
        Voice models are built only from catalogues we have permission to use.
      </p>
    </section>
  )
}
```

- [ ] **Step 8: Compose `app/page.tsx`**

```tsx
import S01Hero from '@/components/sections/S01Hero'
import S02Border from '@/components/sections/S02Border'
import S04Fidelity from '@/components/sections/S04Fidelity'
import S05How from '@/components/sections/S05How'
import S06Receive from '@/components/sections/S06Receive'
import S07Doors from '@/components/sections/S07Doors'
import S08Rights from '@/components/sections/S08Rights'
import { Divider } from '@/components/Divider'

export default function Home() {
  return (
    <>
      <S01Hero />
      <S02Border />
      <Divider />
      <S04Fidelity />
      <Divider />
      <S05How />
      <S06Receive />
      <Divider />
      <S07Doors />
      <S08Rights />
    </>
  )
}
```

Sections 03 (Wheels), 09 (Team) and 10 (form) are inserted in Tasks 7, 8 and 12.

- [ ] **Step 9: Visual verification at three breakpoints**

Screenshot at 375, 768 and 1280 px. Confirm: no horizontal scroll, headline balance is sane, sticky column behaves on desktop and stacks on mobile.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat: home sections - hero, border, fidelity, how, receive, doors, rights"
```

---

## Task 7: Languages, manifest, Wheels and A/B player

**Files:**
- Create: `lib/languages.ts`, `content/demos.json`, `components/Wheels.tsx`, `components/AbPlayer.tsx`, `components/sections/S03Wheels.tsx`, `public/audio/.gitkeep`
- Modify: `app/page.tsx`
- Test: `tests/languages.test.ts`

**Interfaces:**
- Consumes: `Mark`
- Produces:
  - `LANGUAGES: { code: string; endonym: string; english: string }[]` — exactly 8
  - `type Demo = { source: string; target: string; artist: string; title: string; slug: string; seconds: number }`
  - `demos: Demo[]` from `content/demos.json`
  - `<Wheels unlocked: boolean, onLocked: () => void />`
  - `<AbPlayer demo: Demo, unlocked: boolean, onLocked: () => void />`

- [ ] **Step 1: `lib/languages.ts`**

```ts
export const LANGUAGES = [
  { code: 'EN', endonym: 'English',  english: 'English' },
  { code: 'ES', endonym: 'Español', english: 'Spanish' },
  { code: 'PT', endonym: 'Português', english: 'Portuguese' },
  { code: 'IT', endonym: 'Italiano', english: 'Italian' },
  { code: 'FR', endonym: 'Français', english: 'French' },
  { code: 'ZH', endonym: '中文', english: 'Mandarin' },
  { code: 'JA', endonym: '日本語', english: 'Japanese' },
  { code: 'KO', endonym: '한국어', english: 'Korean' },
] as const
```

- [ ] **Step 2: Write the failing test**

```ts
// tests/languages.test.ts
import { describe, it, expect } from 'vitest'
import { LANGUAGES } from '@/lib/languages'
import demos from '@/content/demos.json'

describe('languages', () => {
  it('lists exactly the eight approved languages', () => {
    expect(LANGUAGES.map(l => l.code)).toEqual(['EN','ES','PT','IT','FR','ZH','JA','KO'])
  })
  it('has an endonym for every language', () => {
    for (const l of LANGUAGES) expect(l.endonym.length).toBeGreaterThan(0)
  })
})

describe('demo manifest', () => {
  it('only references approved language codes', () => {
    const codes = new Set(LANGUAGES.map(l => l.code))
    for (const d of demos as any[]) {
      expect(codes.has(d.source)).toBe(true)
      expect(codes.has(d.target)).toBe(true)
    }
  })
})
```

Run: `npm test -- tests/languages.test.ts` — fails until `content/demos.json` exists.

- [ ] **Step 3: `content/demos.json` — placeholder entry**

`hasAudio: false` renders the pair as *available on request* rather than a broken player.

```json
[
  {
    "source": "EN",
    "target": "ES",
    "artist": "Placeholder Artist",
    "title": "Placeholder Track",
    "slug": "placeholder",
    "seconds": 18,
    "hasAudio": false
  }
]
```

Add `public/audio/.gitkeep`, and document the convention in a comment in `S03Wheels.tsx`:
`public/audio/{source}-{target}/{slug}.original.mp3` and `.translated.mp3`, lowercase pair folder.

- [ ] **Step 4: Run the test**

Run: `npm test -- tests/languages.test.ts`
Expected: PASS. Add `"resolveJsonModule": true` to `tsconfig.json` compilerOptions if the import errors.

- [ ] **Step 5: `components/Wheels.tsx`**

Two reels as real listboxes — arrow keys work, selection is announced. The reel *lands and holds*; it never spins indefinitely.

```tsx
'use client'
import { useState } from 'react'
import { LANGUAGES } from '@/lib/languages'
import { Mark } from './Mark'

const ITEM_H = 44

function Reel({ label, index, onChange }: {
  label: string; index: number; onChange: (i: number) => void
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-dark-ink/50">{label}</span>
      <ul role="listbox" aria-label={label} tabIndex={0}
          className="h-[132px] w-40 overflow-hidden text-center outline-none focus-visible:ring-2 focus-visible:ring-dark-accent"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); onChange((index + 1) % LANGUAGES.length) }
            if (e.key === 'ArrowUp') { e.preventDefault(); onChange((index - 1 + LANGUAGES.length) % LANGUAGES.length) }
          }}>
        <div className="transition-transform duration-700 ease-[cubic-bezier(.16,.84,.34,1)]"
             style={{ transform: `translateY(${ITEM_H - index * ITEM_H}px)` }}>
          {LANGUAGES.map((l, i) => (
            <li key={l.code} role="option" aria-selected={i === index}
                onClick={() => onChange(i)}
                style={{ height: ITEM_H }}
                className={`flex cursor-pointer items-center justify-center font-brand text-2xl
                  ${i === index ? 'text-dark-ink' : 'text-dark-ink/30'}`}>
              {l.endonym}
            </li>
          ))}
        </div>
      </ul>
    </div>
  )
}

export function Wheels({ onPair }: { onPair: (s: string, t: string) => void }) {
  const [si, setSi] = useState(0)
  const [ti, setTi] = useState(1)
  const set = (which: 's' | 't') => (i: number) => {
    const ns = which === 's' ? i : si
    const nt = which === 't' ? i : ti
    if (which === 's') setSi(i); else setTi(i)
    onPair(LANGUAGES[ns].code, LANGUAGES[nt].code)
  }
  return (
    <div className="flex items-center justify-center gap-6 sm:gap-12">
      <Reel label="From" index={si} onChange={set('s')} />
      <Mark size={54} className="shrink-0 text-dark-accent" />
      <Reel label="Into" index={ti} onChange={set('t')} />
      <p aria-live="polite" className="sr-only">
        {LANGUAGES[si].english} to {LANGUAGES[ti].english}
      </p>
    </div>
  )
}
```

- [ ] **Step 6: `components/AbPlayer.tsx`**

Two `<audio preload="none">` elements, A/B toggle. Pressing play while locked calls `onLocked()` and plays nothing.

```tsx
'use client'
import { useRef, useState } from 'react'

export type Demo = {
  source: string; target: string; artist: string; title: string
  slug: string; seconds: number; hasAudio: boolean
}

export function AbPlayer({ demo, unlocked, onLocked }: {
  demo: Demo | undefined; unlocked: boolean; onLocked: () => void
}) {
  const [side, setSide] = useState<'original' | 'translated'>('original')
  const [playing, setPlaying] = useState(false)
  const refs = {
    original: useRef<HTMLAudioElement>(null),
    translated: useRef<HTMLAudioElement>(null),
  }

  if (!demo || !demo.hasAudio) {
    return (
      <p className="mt-10 text-center text-sm text-dark-ink/60">
        A before-and-after for this pair is available on request.
        <a href="#enquire" className="ml-2 text-dark-accent underline">Ask for it</a>
      </p>
    )
  }

  const dir = `/audio/${demo.source.toLowerCase()}-${demo.target.toLowerCase()}`

  const toggle = () => {
    if (!unlocked) { onLocked(); return }
    const el = refs[side].current
    if (!el) return
    const other = refs[side === 'original' ? 'translated' : 'original'].current
    other?.pause()
    if (playing) { el.pause(); setPlaying(false) } else { void el.play(); setPlaying(true) }
  }

  return (
    <div className="mt-12 flex flex-col items-center gap-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-dark-ink/55">
        {demo.artist} &mdash; {demo.title} &middot; {demo.seconds}s excerpt
      </p>
      <div className="flex gap-px bg-dark-ink/20" role="group" aria-label="Choose version">
        {(['original', 'translated'] as const).map((s) => (
          <button key={s} onClick={() => setSide(s)} aria-pressed={side === s}
            className={`px-5 py-2 text-sm ${side === s ? 'bg-dark-accent text-dark-ground' : 'bg-dark-ground text-dark-ink/70'}`}>
            {s === 'original' ? demo.source : demo.target} {s}
          </button>
        ))}
      </div>
      <button onClick={toggle}
              className="bg-dark-accent px-7 py-4 text-dark-ground">
        {unlocked ? (playing ? 'Pause' : 'Play') : 'Unlock to listen'}
      </button>
      <audio ref={refs.original} preload="none" src={`${dir}/${demo.slug}.original.mp3`}
             onEnded={() => setPlaying(false)} />
      <audio ref={refs.translated} preload="none" src={`${dir}/${demo.slug}.translated.mp3`}
             onEnded={() => setPlaying(false)} />
    </div>
  )
}
```

- [ ] **Step 7: `components/sections/S03Wheels.tsx` — dark treatment**

```tsx
'use client'
import { useMemo, useState } from 'react'
import { Wheels } from '../Wheels'
import { AbPlayer, type Demo } from '../AbPlayer'
import raw from '@/content/demos.json'

const demos = raw as Demo[]

export default function S03Wheels({ unlocked, onLocked }: {
  unlocked: boolean; onLocked: () => void
}) {
  const [pair, setPair] = useState({ s: 'EN', t: 'ES' })
  const demo = useMemo(
    () => demos.find((d) => d.source === pair.s && d.target === pair.t),
    [pair],
  )
  return (
    <section id="hear" className="bg-dark-ground py-28 text-dark-ink">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-dark-ink/50">
          Hear it
        </span>
        <h2 className="mt-5 font-brand text-4xl leading-tight tracking-tight sm:text-5xl">
          Choose a pair. Hear the same performance twice.
        </h2>
        <div className="mt-14">
          <Wheels onPair={(s, t) => setPair({ s, t })} />
        </div>
        <AbPlayer demo={demo} unlocked={unlocked} onLocked={onLocked} />
      </div>
    </section>
  )
}
```

- [ ] **Step 8: Verify keyboard access**

In the browser tool: Tab to a reel, press ArrowDown, confirm the selection moves and the visual reel translates. **A reel that only responds to clicks is a bug** — the spec requires a labelled listbox.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: language wheels and gated A/B player on the dark treatment"
```

---

## Task 8: Enquiry schema, form, overlay

**Files:**
- Create: `lib/enquiry-schema.ts`, `components/EnquiryForm.tsx`, `components/EnquiryOverlay.tsx`, `components/sections/S10Enquire.tsx`
- Test: `tests/enquiry-schema.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `EnquirySchema` (Zod), `type EnquiryInput = z.infer<typeof EnquirySchema>`
  - `ROLES: readonly string[]`
  - `<EnquiryForm source: string, onSuccess?: () => void />`
  - `<EnquiryOverlay open: boolean, onClose: () => void, onSuccess: () => void />`

- [ ] **Step 1: `lib/enquiry-schema.ts`**

```ts
import { z } from 'zod'

export const ROLES = ['artist','manager','label','publisher','distributor','other'] as const

export const EnquirySchema = z.object({
  name: z.string().trim().min(2, 'Please tell us your name').max(120),
  email: z.string().trim().toLowerCase().email('That email address doesn’t look right'),
  role: z.enum(ROLES),
  company: z.string().trim().max(160).optional().or(z.literal('')),
  catalogue_size: z.enum(['1','2-10','11-100','100+','unsure']).optional(),
  target_languages: z.array(z.string().length(2)).max(8).optional(),
  message: z.string().trim().max(4000).optional().or(z.literal('')),
  source: z.string().trim().max(60),
  unlocked_audio: z.boolean().default(false),
  // anti-spam
  website: z.literal('').optional(),          // honeypot: must stay empty
  elapsed_ms: z.number().int().nonnegative(),
})

export type EnquiryInput = z.infer<typeof EnquirySchema>
export const MIN_ELAPSED_MS = 2000
```

- [ ] **Step 2: Write the failing test**

```ts
// tests/enquiry-schema.test.ts
import { describe, it, expect } from 'vitest'
import { EnquirySchema, MIN_ELAPSED_MS } from '@/lib/enquiry-schema'

const base = { name: 'Jordan Brock', email: 'J@Example.com', role: 'label',
  source: 'hero', elapsed_ms: 5000 }

describe('EnquirySchema', () => {
  it('accepts a minimal valid enquiry and lowercases the email', () => {
    const r = EnquirySchema.safeParse(base)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.email).toBe('j@example.com')
  })
  it('rejects a malformed email', () => {
    expect(EnquirySchema.safeParse({ ...base, email: 'nope' }).success).toBe(false)
  })
  it('rejects a one-character name', () => {
    expect(EnquirySchema.safeParse({ ...base, name: 'J' }).success).toBe(false)
  })
  it('rejects an unknown role', () => {
    expect(EnquirySchema.safeParse({ ...base, role: 'ceo' }).success).toBe(false)
  })
  it('rejects a filled honeypot', () => {
    expect(EnquirySchema.safeParse({ ...base, website: 'http://spam' }).success).toBe(false)
  })
  it('defaults unlocked_audio to false', () => {
    const r = EnquirySchema.safeParse(base)
    if (r.success) expect(r.data.unlocked_audio).toBe(false)
  })
  it('exposes a 2 second minimum fill time', () => {
    expect(MIN_ELAPSED_MS).toBe(2000)
  })
})
```

Run: `npm test -- tests/enquiry-schema.test.ts` → all PASS once the schema exists.

- [ ] **Step 3: `components/EnquiryForm.tsx`**

Native `<form method="post" action="/api/enquiry">` so it works with JS disabled; JS upgrades it to fetch.

```tsx
'use client'
import { useRef, useState } from 'react'
import { ROLES } from '@/lib/enquiry-schema'
import { LANGUAGES } from '@/lib/languages'

export function EnquiryForm({ source, onSuccess }: { source: string; onSuccess?: () => void }) {
  const mounted = useRef(Date.now())
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState('sending'); setError('')
    const fd = new FormData(e.currentTarget)
    const body = {
      name: String(fd.get('name') ?? ''),
      email: String(fd.get('email') ?? ''),
      role: String(fd.get('role') ?? 'other'),
      company: String(fd.get('company') ?? ''),
      catalogue_size: String(fd.get('catalogue_size') ?? 'unsure'),
      target_languages: fd.getAll('target_languages').map(String),
      message: String(fd.get('message') ?? ''),
      source,
      unlocked_audio: source === 'gate',
      website: String(fd.get('website') ?? ''),
      elapsed_ms: Date.now() - mounted.current,
    }
    const res = await fetch('/api/enquiry', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) { setState('done'); onSuccess?.() }
    else {
      const j = await res.json().catch(() => ({}))
      setError(j.error ?? 'Something went wrong. Please email henry.jamcmahon@gmail.com.')
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <p className="font-brand text-2xl">
        Thank you &mdash; we&rsquo;ll be in touch shortly.
      </p>
    )
  }

  const field = 'w-full border border-graphite/25 bg-transparent px-4 py-3 outline-none focus-visible:border-indigo'

  return (
    <form method="post" action="/api/enquiry" onSubmit={submit} className="flex flex-col gap-5">
      <input type="hidden" name="source" value={source} />
      {/* honeypot: visually hidden, not display:none, so bots still fill it */}
      <div aria-hidden="true" className="absolute h-0 w-0 overflow-hidden opacity-0">
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-sm">Your name</span>
        <input name="name" required minLength={2} autoComplete="name" className={field} />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm">Email</span>
        <input name="email" type="email" required autoComplete="email" className={field} />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm">You are</span>
        <select name="role" required className={field} defaultValue="artist">
          {ROLES.map(r => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm">Company <span className="text-graphite/50">(optional)</span></span>
        <input name="company" className={field} />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm">How many songs?</span>
        <select name="catalogue_size" className={field} defaultValue="unsure">
          <option value="1">One song</option>
          <option value="2-10">2&ndash;10</option>
          <option value="11-100">11&ndash;100</option>
          <option value="100+">100+</option>
          <option value="unsure">Not sure yet</option>
        </select>
      </label>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm">Languages you&rsquo;re interested in</legend>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.filter(l => l.code !== 'EN').map(l => (
            <label key={l.code} className="cursor-pointer border border-graphite/25 px-3 py-2 text-sm has-checked:border-indigo has-checked:text-indigo">
              <input type="checkbox" name="target_languages" value={l.code} className="sr-only" />
              {l.endonym}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-2">
        <span className="text-sm">Anything else <span className="text-graphite/50">(optional)</span></span>
        <textarea name="message" rows={4} className={field} />
      </label>

      {state === 'error' && <p role="alert" className="text-sm text-ember">{error}</p>}

      <button type="submit" disabled={state === 'sending'}
              className="self-start bg-ember px-7 py-4 text-cream disabled:opacity-60">
        {state === 'sending' ? 'Sending…' : 'Send enquiry'}
      </button>
    </form>
  )
}
```

- [ ] **Step 4: `components/EnquiryOverlay.tsx`**

Focus trap is out of scope; Escape-to-close and initial focus are not.

```tsx
'use client'
import { useEffect, useRef } from 'react'
import { EnquiryForm } from './EnquiryForm'

export function EnquiryOverlay({ open, onClose, onSuccess }: {
  open: boolean; onClose: () => void; onSuccess: () => void
}) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    box.current?.querySelector<HTMLInputElement>('input[name="name"]')?.focus()
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open, onClose])

  if (!open) return null
  return (
    <div role="dialog" aria-modal="true" aria-label="Unlock the demos"
         className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-graphite/70 p-6">
      <div ref={box} className="w-full max-w-lg bg-cream p-8">
        <div className="flex items-start justify-between gap-6">
          <h2 className="font-brand text-2xl leading-tight tracking-tight">
            Tell us who you are, and the demos open up.
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-2xl leading-none">&times;</button>
        </div>
        <p className="mt-3 text-sm text-graphite/70">
          One email, and every before-and-after unlocks. We don&rsquo;t send newsletters.
        </p>
        <div className="mt-6"><EnquiryForm source="gate" onSuccess={onSuccess} /></div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: `components/sections/S10Enquire.tsx`**

```tsx
import { EnquiryForm } from '../EnquiryForm'

export default function S10Enquire() {
  return (
    <section id="enquire" className="bg-graphite py-28 text-cream">
      <div className="mx-auto grid max-w-5xl gap-14 px-6 md:grid-cols-2">
        <div>
          <h2 className="font-brand text-4xl leading-tight tracking-tight sm:text-5xl">
            One song, or a whole catalogue.
          </h2>
          <p className="mt-6 text-cream/75">
            Tell us what you have and where you want it to reach. We&rsquo;ll come back with what a
            first release would look like.
          </p>
          <p className="mt-8 font-mono text-xs tracking-[0.16em] text-cream/50">
            english &#8776; espa&ntilde;ol
          </p>
        </div>
        <div className="[&_input]:text-cream [&_select]:text-cream [&_textarea]:text-cream">
          <EnquiryForm source="footer" />
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: enquiry schema, form with no-JS fallback, and gate overlay"
```

---

## Task 9: API route — Supabase, Resend, cookie

**Files:**
- Create: `lib/supabase-admin.ts`, `lib/gate.ts`, `app/api/enquiry/route.ts`, `supabase/schema.sql`
- Test: `tests/enquiry-route.test.ts`

**Interfaces:**
- Consumes: `EnquirySchema`, `MIN_ELAPSED_MS`
- Produces: `POST /api/enquiry`; `signGate(email): string`; `verifyGate(token): boolean`; `supabaseAdmin()`

- [ ] **Step 1: `supabase/schema.sql`**

```sql
create extension if not exists pgcrypto;

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  role text not null,
  company text,
  catalogue_size text,
  target_languages text[],
  message text,
  source text,
  unlocked_audio boolean not null default false,
  user_agent text,
  referrer text
);

alter table public.enquiries enable row level security;

-- No anon policy at all: every write goes through the server with the service key,
-- which bypasses RLS. Anonymous clients can neither read nor write directly.
```

- [ ] **Step 2: `lib/supabase-admin.ts`**

```ts
import { createClient } from '@supabase/supabase-js'

export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  return createClient(url, key, { auth: { persistSession: false } })
}
```

- [ ] **Step 3: `lib/gate.ts`**

```ts
import { createHmac, timingSafeEqual } from 'node:crypto'

export const GATE_COOKIE = 'lyr_unlocked'

function secret() {
  const s = process.env.GATE_SECRET
  if (!s) throw new Error('GATE_SECRET must be set')
  return s
}

export function signGate(email: string): string {
  const mac = createHmac('sha256', secret()).update(email).digest('hex')
  return `${Buffer.from(email).toString('base64url')}.${mac}`
}

export function verifyGate(token: string | undefined): boolean {
  if (!token) return false
  const [b64, mac] = token.split('.')
  if (!b64 || !mac) return false
  try {
    const email = Buffer.from(b64, 'base64url').toString('utf8')
    const expected = createHmac('sha256', secret()).update(email).digest('hex')
    return timingSafeEqual(Buffer.from(mac), Buffer.from(expected))
  } catch { return false }
}
```

- [ ] **Step 4: Write the failing route test**

```ts
// tests/enquiry-route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const insert = vi.fn()
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({ from: () => ({ insert: (...a: any[]) => insert(...a) }) }),
}))
const send = vi.fn()
vi.mock('resend', () => ({ Resend: class { emails = { send: (...a: any[]) => send(...a) } } }))

process.env.GATE_SECRET = 'test-secret'
process.env.ENQUIRY_TO_EMAIL = 'henry.jamcmahon@gmail.com'
process.env.ENQUIRY_FROM_EMAIL = 'onboarding@resend.dev'
process.env.RESEND_API_KEY = 'test'

const { POST } = await import('@/app/api/enquiry/route')

const valid = {
  name: 'Jordan Brock', email: 'jordan@example.com', role: 'label',
  source: 'hero', elapsed_ms: 5000, unlocked_audio: true,
}
const req = (body: unknown) =>
  new Request('http://localhost/api/enquiry', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

beforeEach(() => { insert.mockReset(); send.mockReset(); insert.mockResolvedValue({ error: null }) })

describe('POST /api/enquiry', () => {
  it('stores a valid enquiry and returns 200', async () => {
    send.mockResolvedValue({})
    const res = await POST(req(valid))
    expect(res.status).toBe(200)
    expect(insert).toHaveBeenCalledOnce()
  })

  it('emails the founder', async () => {
    send.mockResolvedValue({})
    await POST(req(valid))
    expect(send.mock.calls[0][0].to).toBe('henry.jamcmahon@gmail.com')
  })

  it('sets the unlock cookie when the submission came from the gate', async () => {
    send.mockResolvedValue({})
    const res = await POST(req(valid))
    expect(res.headers.get('set-cookie') ?? '').toContain('lyr_unlocked=')
  })

  it('rejects an invalid payload with 400 and does not write', async () => {
    const res = await POST(req({ ...valid, email: 'nope' }))
    expect(res.status).toBe(400)
    expect(insert).not.toHaveBeenCalled()
  })

  it('silently drops a filled honeypot without writing', async () => {
    const res = await POST(req({ ...valid, website: 'http://spam' }))
    expect(res.status).toBe(200)          // look successful to the bot
    expect(insert).not.toHaveBeenCalled()
  })

  it('drops a submission filled faster than 2 seconds', async () => {
    const res = await POST(req({ ...valid, elapsed_ms: 300 }))
    expect(res.status).toBe(200)
    expect(insert).not.toHaveBeenCalled()
  })

  it('STILL RETURNS 200 when the email fails - never lose the lead', async () => {
    send.mockRejectedValue(new Error('resend down'))
    const res = await POST(req(valid))
    expect(res.status).toBe(200)
    expect(insert).toHaveBeenCalledOnce()
  })

  it('returns 500 when the database write fails', async () => {
    insert.mockResolvedValue({ error: { message: 'db down' } })
    const res = await POST(req(valid))
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 5: Run it, confirm it fails**

Run: `npm test -- tests/enquiry-route.test.ts`
Expected: FAIL — route does not exist.

- [ ] **Step 6: Implement `app/api/enquiry/route.ts`**

```ts
import { Resend } from 'resend'
import { EnquirySchema, MIN_ELAPSED_MS } from '@/lib/enquiry-schema'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { GATE_COOKIE, signGate } from '@/lib/gate'

export const runtime = 'nodejs'

const ok = (extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { 'content-type': 'application/json', ...extraHeaders },
  })

export async function POST(request: Request) {
  let raw: unknown
  const ct = request.headers.get('content-type') ?? ''
  if (ct.includes('application/json')) {
    raw = await request.json().catch(() => null)
  } else {
    // no-JS path: native form post
    const fd = await request.formData()
    raw = {
      ...Object.fromEntries(fd.entries()),
      target_languages: fd.getAll('target_languages').map(String),
      elapsed_ms: Number(fd.get('elapsed_ms') ?? MIN_ELAPSED_MS),
      unlocked_audio: fd.get('source') === 'gate',
    }
  }

  const parsed = EnquirySchema.safeParse(raw)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: parsed.error.issues[0]?.message ?? 'Invalid submission' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    )
  }
  const d = parsed.data

  // Anti-spam: look successful, write nothing.
  if (d.website || d.elapsed_ms < MIN_ELAPSED_MS) return ok()

  const { error } = await supabaseAdmin().from('enquiries').insert({
    name: d.name, email: d.email, role: d.role,
    company: d.company || null,
    catalogue_size: d.catalogue_size || null,
    target_languages: d.target_languages?.length ? d.target_languages : null,
    message: d.message || null,
    source: d.source,
    unlocked_audio: d.unlocked_audio,
    user_agent: request.headers.get('user-agent'),
    referrer: request.headers.get('referer'),
  })

  if (error) {
    console.error('[enquiry] supabase insert failed', error)
    return new Response(JSON.stringify({ error: 'We could not save that. Please try again.' }),
      { status: 500, headers: { 'content-type': 'application/json' } })
  }

  // The lead is safe. An email failure must never surface to the user or lose the row.
  try {
    await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: process.env.ENQUIRY_FROM_EMAIL!,
      to: process.env.ENQUIRY_TO_EMAIL!,
      subject: `Lyrical enquiry — ${d.name} (${d.role})`,
      text: [
        `Name: ${d.name}`, `Email: ${d.email}`, `Role: ${d.role}`,
        `Company: ${d.company || '-'}`, `Songs: ${d.catalogue_size || '-'}`,
        `Languages: ${d.target_languages?.join(', ') || '-'}`,
        `Source: ${d.source}`, `Unlocked audio: ${d.unlocked_audio}`,
        '', 'Message:', d.message || '(none)',
      ].join('\n'),
    })
  } catch (e) {
    console.error('[enquiry] resend send failed, row was still written', e)
  }

  const headers: Record<string, string> = {}
  if (d.unlocked_audio) {
    headers['set-cookie'] =
      `${GATE_COOKIE}=${signGate(d.email)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000` +
      (process.env.NODE_ENV === 'production' ? '; Secure' : '')
  }
  return ok(headers)
}
```

- [ ] **Step 7: Run the tests**

Run: `npm test -- tests/enquiry-route.test.ts`
Expected: all 8 PASS. The email-failure test is the important one — **if it fails, the route is losing leads.**

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: enquiry route with Supabase write, Resend alert and signed unlock cookie"
```

---

## Task 10: Wire the gate into the home page

**Files:**
- Modify: `app/page.tsx`, create `components/HomeInteractive.tsx`

**Interfaces:**
- Consumes: `S03Wheels`, `EnquiryOverlay`, `verifyGate`, `GATE_COOKIE`
- Produces: `<HomeInteractive initiallyUnlocked: boolean />`

- [ ] **Step 1: `components/HomeInteractive.tsx`**

```tsx
'use client'
import { useState } from 'react'
import S03Wheels from './sections/S03Wheels'
import { EnquiryOverlay } from './EnquiryOverlay'

export function HomeInteractive({ initiallyUnlocked }: { initiallyUnlocked: boolean }) {
  const [unlocked, setUnlocked] = useState(initiallyUnlocked)
  const [open, setOpen] = useState(false)
  return (
    <>
      <S03Wheels unlocked={unlocked} onLocked={() => setOpen(true)} />
      <EnquiryOverlay open={open} onClose={() => setOpen(false)}
                      onSuccess={() => { setUnlocked(true); setOpen(false) }} />
    </>
  )
}
```

- [ ] **Step 2: Read the cookie in `app/page.tsx` (server component)**

```tsx
import { cookies } from 'next/headers'
import { GATE_COOKIE, verifyGate } from '@/lib/gate'
import { HomeInteractive } from '@/components/HomeInteractive'
// ...section imports as in Task 6, plus S10Enquire

export default async function Home() {
  const jar = await cookies()
  const unlocked = verifyGate(jar.get(GATE_COOKIE)?.value)
  return (
    <>
      <S01Hero />
      <S02Border />
      <HomeInteractive initiallyUnlocked={unlocked} />
      <Divider />
      <S04Fidelity />
      <Divider />
      <S05How />
      <S06Receive />
      <Divider />
      <S07Doors />
      <S08Rights />
      <S10Enquire />
    </>
  )
}
```

Section 09 (Team) is added in Task 12, immediately before `S10Enquire`.

- [ ] **Step 3: Verify the gate end to end**

With dev running and env vars set: press Play → overlay opens. Submit → overlay closes, button reads Play. Reload → still unlocked (cookie). Clear cookies → gated again.

If Supabase env vars are absent, `supabaseAdmin()` throws and the route 500s — that is correct fail-loud behaviour. Note it and continue; Task 14 documents the setup.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: wire the audio gate through a signed cookie"
```

---

## Task 11: Team section and /about

**Files:**
- Create: `components/sections/S09Team.tsx`, `app/about/page.tsx`, `content/team.json`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: `team: { name: string; role: string; bio: string; initials: string }[]`

- [ ] **Step 1: `content/team.json` — placeholder bios, approved by the client**

```json
[
  {
    "name": "Jordan Brock",
    "role": "Co-founder",
    "initials": "JB",
    "bio": "Leads brand and commercial strategy, and the relationships with artists, labels and rights holders."
  },
  {
    "name": "Henry McMahon",
    "role": "Co-founder",
    "initials": "HM",
    "bio": "Builds the production system — the translation, the voice work, and the pipeline that turns a master into a finished release."
  }
]
```

- [ ] **Step 2: `components/sections/S09Team.tsx`**

Initials in a circle — no photos, so nothing looks unfinished.

```tsx
import team from '@/content/team.json'
import { Reveal } from '../Reveal'

export default function S09Team() {
  return (
    <section id="team" className="mx-auto max-w-5xl px-6 py-24">
      <h2 className="font-brand text-4xl leading-tight tracking-tight sm:text-5xl">Who you&rsquo;ll deal with</h2>
      <div className="mt-14 grid gap-12 sm:grid-cols-2">
        {team.map((m, i) => (
          <Reveal key={m.name} delay={i * 80}>
            <div className="flex items-start gap-5">
              <span aria-hidden="true"
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-indigo font-mono text-sm text-indigo">
                {m.initials}
              </span>
              <div>
                <h3 className="font-brand text-2xl tracking-tight">{m.name}</h3>
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-graphite/50">{m.role}</p>
                <p className="mt-3 text-graphite/75">{m.bio}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: `app/about/page.tsx`**

```tsx
import S09Team from '@/components/sections/S09Team'
import S08Rights from '@/components/sections/S08Rights'

export const metadata = { title: 'About — Lyrical' }

export default function About() {
  return (
    <>
      <section className="mx-auto max-w-3xl px-6 pt-24">
        <h1 className="font-brand text-5xl leading-tight tracking-tight text-balance">
          A song shouldn&rsquo;t stop at a border.
        </h1>
        <p className="mt-8 text-lg text-graphite/75">
          Lyrical exists because the catalogue that already works in one language is the safest
          place to start in another. We don&rsquo;t manufacture demand for unknown songs &mdash; we
          take records that have already proven they connect, and make an authorised version for
          an audience that couldn&rsquo;t hear them properly before.
        </p>
        <p className="mt-6 text-lg text-graphite/75">
          Everything is built around one rule: the artist&rsquo;s performance is the source of
          truth. We transfer a performance. We don&rsquo;t invent one.
        </p>
      </section>
      <S09Team />
      <S08Rights />
    </>
  )
}
```

- [ ] **Step 4: Insert `S09Team` into `app/page.tsx`** immediately before `<S10Enquire />`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: team section and about page"
```

---

## Task 12: /hear route

**Files:**
- Create: `app/hear/page.tsx`

**Interfaces:**
- Consumes: `HomeInteractive`, `verifyGate`
- Produces: the `/hear` route

- [ ] **Step 1: `app/hear/page.tsx`**

```tsx
import { cookies } from 'next/headers'
import { GATE_COOKIE, verifyGate } from '@/lib/gate'
import { HomeInteractive } from '@/components/HomeInteractive'

export const metadata = { title: 'Hear it — Lyrical' }

export default async function Hear() {
  const jar = await cookies()
  const unlocked = verifyGate(jar.get(GATE_COOKIE)?.value)
  return (
    <>
      <section className="mx-auto max-w-3xl px-6 pt-24 text-center">
        <h1 className="font-brand text-5xl leading-tight tracking-tight text-balance">
          The same performance, twice.
        </h1>
        <p className="mt-8 text-lg text-graphite/75">
          Choose a language pair and hear the original against the recreated version. The melody,
          the phrasing and the backing are identical &mdash; only the language changes.
        </p>
      </section>
      <div className="mt-16"><HomeInteractive initiallyUnlocked={unlocked} /></div>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: /hear route with the gated A/B player"
```

---

## Task 13: Metadata, favicon, sitemap, robots

**Files:**
- Create: `app/icon.svg`, `app/opengraph-image.tsx`, `app/sitemap.ts`, `app/robots.ts`
- Modify: `app/layout.tsx`

- [ ] **Step 1: `app/icon.svg`**

The mark alone, indigo on cream, at 64×64. Paste the two `d` strings printed by:

```bash
node --experimental-strip-types -e "import('./lib/mark-states.ts').then(async m => { const {toPath} = await import('./lib/mark.ts'); console.log(toPath(m.APPROX.top)); console.log(toPath(m.APPROX.bottom)) })"
```

If that fails, add a temporary script that writes `app/icon.svg` and delete it afterwards. **Do not hand-draw the paths** — they must match the generator exactly.

- [ ] **Step 2: `app/sitemap.ts` and `app/robots.ts`**

```ts
// app/sitemap.ts
import type { MetadataRoute } from 'next'
const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/hear', '/about'].map((p) => ({ url: `${base}${p}`, changeFrequency: 'monthly' }))
}
```

```ts
// app/robots.ts
import type { MetadataRoute } from 'next'
const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', allow: '/' }], sitemap: `${base}/sitemap.xml` }
}
```

- [ ] **Step 3: Extend metadata in `app/layout.tsx`**

Add `openGraph` (title, description, type `website`), `twitter: { card: 'summary_large_image' }` and `metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000')`.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: favicon from the generated mark, OG metadata, sitemap and robots"
```

---

## Task 14: Copy audit, verification pass, README

**Files:**
- Create: `README.md`
- Test: `tests/copy.test.ts`

- [ ] **Step 1: Write the copy-guard test**

```ts
// tests/copy.test.ts
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

function walk(dir: string, out: string[] = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next' || e === '.git' || e === 'docs') continue
    const p = join(dir, e)
    statSync(p).isDirectory() ? walk(p, out)
      : /\.(tsx?|json|css)$/.test(e) && out.push(p)
  }
  return out
}

const files = walk('.').filter(f => !f.includes('tests'))
const corpus = files.map(f => `${f}\n${readFileSync(f, 'utf8')}`).join('\n')

describe('copy guardrails', () => {
  it('never says "AI-generated"', () => {
    expect(corpus).not.toMatch(/AI[- ]generated/i)
  })
  it('never publishes a population multiplier', () => {
    expect(corpus).not.toMatch(/6\.4\s*[x×]/i)
    expect(corpus).not.toMatch(/2\.38\s*B/i)
  })
  it('never uses "Solutions" as a nav label', () => {
    expect(corpus).not.toMatch(/>\s*Solutions\s*</)
  })
  it('declares no gradients', () => {
    expect(corpus).not.toMatch(/linear-gradient|radial-gradient|conic-gradient/)
  })
})
```

Run: `npm test` — the whole suite must be green.

- [ ] **Step 2: Build cleanly**

```bash
npm run build
```

Zero TypeScript errors, zero ESLint errors. Fix rather than suppress.

- [ ] **Step 3: Visual verification matrix**

With `npm run dev`, using the browser tool, for `/`, `/hear`, `/about` at 375 / 768 / 1280 px:

- [ ] Screenshot each. No horizontal scroll (`document.documentElement.scrollWidth <= window.innerWidth + 2`).
- [ ] Bodoni is actually loading (headlines are a serif, not a fallback sans).
- [ ] The Unlock resolves to exactly the canonical mark.
- [ ] Wheels: keyboard arrows change the selection.
- [ ] Gate: Play opens the overlay when locked.
- [ ] Emulate `prefers-reduced-motion: reduce` — all content visible, nothing stuck at `opacity: 0`.
- [ ] Disable JavaScript — every section readable, form still visible and submittable.

- [ ] **Step 4: `README.md`**

Document, with exact steps: creating the Supabase project and running `supabase/schema.sql`; where to find the service role key; creating the Resend key; that `ENQUIRY_FROM_EMAIL` must be `onboarding@resend.dev` until a domain is verified, and that Resend's test sender can only deliver to the Resend account's own address; generating `GATE_SECRET` with `openssl rand -hex 32`; dropping audio into `public/audio/{src}-{tgt}/` and flipping `hasAudio` in `content/demos.json`; and deploying to Vercel with the same env vars.

- [ ] **Step 5: Commit and push**

```bash
git add -A
git commit -m "test: copy guardrails; docs: setup and deployment README"
git push -u origin main
```

---

## Self-Review

**Spec coverage.** §2 brand → Task 1 (tokens, fonts) + Task 2 (mark). §2.4 ≈ grammar → Footer, S10. §2.5 guardrails → Task 14 copy test. §3.1 Unlock → Task 5. §3.2 Wheels → Task 7. §3.3 Living mark → Task 5. §3.4 dividers → Task 4. §3.5 motion rules → Task 4 + Task 14 verification. §4 routes and ten sections → Tasks 6, 7, 8, 10, 11, 12. §5 data and email → Task 9. §5.3 anti-spam → Task 9. §6 audio manifest and gate → Tasks 7, 10. §8 open items → placeholders in Tasks 7 and 11. §10 testing → Tasks 1, 2, 8, 9, 14.

**Gap found and closed:** the spec's §5.2 rule that an email failure must not lose the lead had no explicit test; it is now Task 9 Step 4, test 7.

**Type consistency.** `Demo` is defined in `AbPlayer.tsx` and imported by `S03Wheels`. `MarkState` is `{ top: Pt[]; bottom: Pt[] }` throughout. `GATE_COOKIE` and `verifyGate` are imported identically in `app/page.tsx` and `app/hear/page.tsx`. `onLocked` is the prop name in `S03Wheels`, `AbPlayer` and `HomeInteractive`. `onPair` is the callback name in `Wheels`.

**Deliberate deviation flagged:** Task 2 Step 1 contains a syntax error (`toBeLessThan 0.01`) that the implementer must fix — noted inline so it is caught rather than copied.
