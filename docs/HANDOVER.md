# Lyrical website — handover

**Date:** 2026-07-30 · **Live:** https://lyrical-website.vercel.app ·
**Repo:** https://github.com/Henrymcmahon1/lyrical-website

Read this before touching anything. Several of the constraints below were arrived at by
breaking the site first, and they are not obvious from the code.

---

## 1. What this is

A funnel-first marketing site for **Lyrical**, which re-sings existing recordings in another
language *in the original artist's voice*, keeping the melody, phrasing and the untouched
original instrumental.

**The site has one job: convert a rights holder into an enquiry.** Lyrical's own strategy
states that *authorization, not production capability, is the binding constraint* in this
category. So the site sells **trust**, not technology. Two audiences share one page: artists
and managers who want one flagship release, and labels who want catalogue infrastructure.

Founders: **Jordan Brock** (brand, commercial) and **Henry McMahon** (engineering, the user).

---

## 2. Current state

| | |
|---|---|
| Stack | Next.js 16.2 (App Router), React 19, Tailwind **4**, TypeScript |
| Tests | **61**, all passing (`npm test`, Vitest) |
| Commits | 13, all pushed to `main` |
| Hosting | Vercel, team **HJAM**, project `lyrical-website` |
| Deploy | **Manual CLI only.** The GitHub repo is NOT connected yet |
| Database | **Not set up.** No Supabase, no Resend |
| Demo audio | **None exists.** Every `hasAudio` in `content/demos.json` is `false` |

### Home page order

`S01Hero` → `S02bAudience` → `HomeInteractive` (wraps `S03Wheels`) → `S04Fidelity` →
`S05How` → `S06Receive` → `S09bNow` → `S10Enquire`

`/about` carries the depth: master-recording thesis, origin story, beliefs, artist/label
split, full founder bios, rights position. `/hear` is the listening page.

---

## 3. The four tasks you were asked to do

### 3.1 Set up the database

Everything is written and tested; it just needs credentials. `README.md` has the exact
click-path. In short:

1. Supabase project → run `supabase/schema.sql` in the SQL editor → copy the URL and the
   **`service_role`** key (not `anon`).
2. Resend account **registered with henry.jamcmahon@gmail.com** (their test sender can only
   deliver to the account owner's address until a domain is verified) → API key.
3. `openssl rand -hex 32` → `GATE_SECRET`.
4. Put all of them in Vercel → Settings → Environment Variables, and in `.env.local` locally.

**The route already degrades safely**, so nothing is broken while this is pending:

| Situation | Behaviour |
|---|---|
| Both configured | Row written, email sent, 200 |
| DB configured, email fails | 200. The lead is safe; never surface it |
| No DB, email works | 200. The email is the record |
| No DB and email fails | **502** with the direct address. The lead would be lost, so say so |
| Nothing configured | **503** with the direct address |

Do not "simplify" that ladder. Each branch is covered by a test in
`tests/enquiry-route.test.ts`.

### 3.2 Custom domain

Henry owns a domain — **ask which one**. Then:

1. Vercel → project → Settings → Domains → add it, follow the DNS records.
2. Set `NEXT_PUBLIC_SITE_URL=https://thedomain` in Vercel env vars. Without it the site
   falls back to the Vercel domain (see `lib/site.ts`) — correct, but not canonical.
3. Verify the domain in **Resend** too, then change `ENQUIRY_FROM_EMAIL` from
   `onboarding@resend.dev` to something like `hello@thedomain`. Until that is done, Resend
   can only deliver to the Resend account owner.
4. Re-check `/sitemap.xml` and the `og:url` meta after the change.

### 3.3 Mobile feels static — this is the interesting one

**It is static on purpose, and the reason matters.** Every pinned section, the audience
morph and the parallax are gated behind:

```css
@media (min-width: 768px) and (prefers-reduced-motion: no-preference) { .js-motion … }
```

That gate exists because a sticky pinned track on a phone can trap a user mid-section with
nothing but empty space. Do **not** simply lower the breakpoint — that reintroduces the trap.

What survives on mobile today: scroll reveals, staggered pop-in, the drifting language
reels, the hero Unlock animation. What is lost: all four pinned sections and the
pause-becomes-mark morph, which is why it reads flat.

**Suggested approach** (design decision, get Henry's view first):

- Give the audience morph a **non-pinned** mobile version: drive the pause→mark morph off
  the section entering the viewport rather than off a tall sticky track. The frames are
  already precomputed in `S02bAudience.tsx`; only the driver needs changing.
- Replace pinned steppers on mobile with a **snap carousel** (`scroll-snap-type: x
  mandatory`) so one idea is still on screen at a time, but the user is never held.
- Consider a light entrance transform on section headings.
- Whatever you add, re-run the blank-screen sweep in §5. Every motion bug on this project
  produced a blank screen, not a visual glitch.

### 3.4 Cleanup and partner feedback

Partner feedback is expected from **Jordan Brock**. Before acting on it, read §4 — several
of his likely instincts were already reconciled once, and the reasoning is recorded.

---

## 4. Locked decisions. Do not silently change these.

### Brand

| Token | Hex | Job |
|---|---|---|
| cream | `#F7EFE1` | space |
| graphite | `#1C1A19` | typography |
| indigo | `#4433D6` | identity |
| ember | `#EE4E22` | action |

Dark treatment (listening sections only): ground `#1B1D1F`, ink `#EDEBE4`, accent `#FF6B2C`.

- **No gradients that paint.** A gradient in a `mask-image` is fine (alpha, not paint) and
  the test allows exactly that, nothing else.
- **Ember never carries body text** — 3.2:1 on cream. Fills and large type only.
- **Indigo is never used on the dark ground** — 2.7:1.
- Fonts: **Fraunces** (brand voice) + **Archivo** (product), self-hosted woff2, never a CDN.
  Fraunces was chosen for its **optical-size axis**; Bodoni Moda was replaced because its
  hairlines vanished below ~32px.
- Headings are explicitly `font-weight: 600`. Tailwind's preflight resets headings to
  inherit, which had left every headline at 400.
- Corners: `rounded-card` = 4px, from the `--radius-card` theme token.

### Copy rules

Banned, and enforced by `tests/copy.test.ts`:

- **"AI-generated"** — say *recreated*, *re-sung*, *performed*, *transcreation*. The whole
  promise is that it does not sound like a machine; machine language argues against it.
- **`6.4×`, `2.38B`, any population multiplier.** Lyrical's own Monetization Thesis says
  population figures are an internal prioritisation heuristic and must never be presented as
  reach. A rights holder's lawyer reads this site.
- **"Solutions"** as a nav label.
- **No em-dashes** in visitor-facing copy. Test strips comments first so only rendered text
  is checked.
- **No artist names.** The founding story originally named four real artists and described
  one artist's voice on another's catalogue. That is unauthorised cross-catalogue cloning on
  a site whose entire proposition is that everything is authorised. It was removed. Do not
  restore it.

### Stated assumption, on the record

The site claims **8 languages** (EN, ES, PT, IT, FR, ZH, JA, KO). The internal capability
document only proves **Spanish ↔ English** end to end. This was raised with Henry three
times and confirmed by him. It is recorded in §7 of the spec. If a partner questions it,
that is the history.

---

## 5. Gotchas that cost real time

Every one of these was found by breaking the site, not by reading the code.

**The mark has no counter.** ≈ is two open strokes; its middle is the *gap* between them. A
punch-out aperture scaled from the centre expands that gap and renders a **blank cream
screen**. Do not build aperture, clip-through or mask-reveal effects from the mark. Use
overlapping transform+opacity layers. See `components/ZoomThroughMark.tsx` (now a
fly-through, not a punch-out).

**Never use `animation-timeline: view()` for reveals.** It was observed pinning elements at
*negative* timeline progress alongside Lenis, leaving 14 of 17 sections permanently at
`opacity: 0`. IntersectionObserver only. A test asserts no `animation-timeline` declaration.

**Reveal animations must stay scoped to `.js-motion`.** An inline script in `layout.tsx`
adds that class before first paint. Unscoped, every wrapped section renders at `opacity: 0`
with JavaScript disabled. A test enforces the scoping.

**Never define a utility-like class outside Tailwind's layers.** A custom `.tap { display:
inline-flex }` outranked Tailwind's `hidden` and silently showed nav links on mobile that
were meant to be hidden. Use utilities (`min-h-11`) or `@layer components`.

**Scroll-driven fades must key off viewport entry, not pinned-track progress.** Track
progress is 0 at the moment a panel becomes sticky, and the panel already fills the screen
there — so `opacity: 0` at progress 0 is a genuinely blank screen.

**Lenis eases scroll.** Any `scrollTo` in a test or audit must wait until `scrollY` actually
settles, not a fixed timeout. Sampling mid-flight produced false readings twice.

**Two GitHub accounts.** `Henrymcmahon1` owns the repo; `HenryMcMahon` is a different, older
account whose credential is cached in Windows Credential Manager. The remote is pinned with
`https://Henrymcmahon1@github.com/...` so it resolves the right one. Use `Henrymcmahon1` when
connecting Vercel to GitHub.

**Delete `app/favicon.ico` if a scaffold ever reintroduces it.** Next emits `favicon.ico`
*before* `icon.svg`, so the Next.js logo would become the site's favicon.
`app/icon.svg` is generated from the real mark geometry.

---

## 6. How to verify anything

```bash
npm test          # 61 tests: geometry, contrast, schema, route, copy guardrails
npx eslint .      # must be silent
npx tsc --noEmit  # must be silent
npm run build     # must compile clean
npm run dev       # http://localhost:3000
```

**The tests are not decoration.** They encode commitments: measured contrast ratios, the
banned copy list, that the Unlock animation's final frame is byte-identical to the canonical
mark, that the service key never appears in a client component, and that an email failure
never loses a lead. If one fails, fix the code, not the test.

**Blank-screen sweep.** This project's motion bugs all manifested as empty screens. After
any motion change, walk the page in third-viewport steps and measure visible non-transparent
text at each stop, waiting for scroll to settle. `scripts/audit-responsive.mjs` does this
across routes and viewports with Playwright — it was written but never run, so treat it as a
starting point rather than proven.

**Mobile.** Windows Chrome will not size a window below 500px. To test 375px, constrain the
document (`documentElement.style.width = '375px'`) — every breakpoint sits above 500, so the
same mobile CSS applies. Or use the Playwright script.

---

## 7. Open recommendations Henry has not acted on

These are mine, not his instructions. Raise them, do not just do them.

1. **Un-pin "What you receive."** It is a list, not a sequence, and it is the third pinned
   section in a row. Roughly −2 screens and it makes the remaining pins feel deliberate.
   The home page is currently **~13 screens**, which is long for a B2B page.
2. **Rights-first on the home page.** It exists as step 00 of How it works and as a line
   under the form, but the standalone trust block now only lives on `/about`. For a buyer
   whose whole hesitation is "can I trust you with my masters", that is the page most of
   them will never reach.
3. **The name.** Materials use both *Lyrical* and *Lyricall*. The site assumes **Lyrical**.
   Jordan has not confirmed.
4. **Jordan's bio** claims The Happy Co. grew past "$100 million in annual revenue". A
   specific, checkable claim about a third party on a credibility page. Worth confirming.
5. **The tagline changed** from Jordan's "One song. Any language. Same soul." to "**Every**
   song…". He authored the original in Brand Bible v1.2 and may not know.

---

## 8. File map

| Path | Responsibility |
|---|---|
| `lib/mark.ts` | Pure Bézier geometry. The mark is *generated*, never hand-drawn |
| `lib/mark-states.ts` | Named outline sets: `APPROX` (the logo), `EQUAL` (pause bars) |
| `lib/site.ts` | Canonical origin, with Vercel fallbacks |
| `lib/gate.ts` | HMAC cookie recording "this visitor asked for examples" |
| `lib/enquiry-schema.ts` | Zod schema shared by client and server |
| `app/api/enquiry/route.ts` | Validate → Supabase → Resend → cookie, with the degradation ladder |
| `app/icon.svg` | Generated from the same geometry as the mark. Regenerate if geometry changes |
| `components/Pinned*.tsx` | The pinned sections. All CSS-gated to desktop |
| `components/sections/` | One file per section, `S01`–`S10` |
| `content/demos.json` | Audio manifest. Flip `hasAudio` when files land |
| `docs/superpowers/specs/` | The design spec. Still the source of truth |
| `CLAUDE.md` | The short version of the rules, loaded automatically |

**Audio drop-in:** `public/audio/{src}-{tgt}/{slug}.original.mp3` and `.translated.mp3`,
lowercase pair folder, then set `hasAudio: true`. The wheels and player read the manifest,
so adding a pair is a data change.

⚠️ The "Send me before and afters" button currently promises **a personal email**, because no
audio exists. If audio is published, update that copy — and if a dashboard is ever built,
only then promise one.
