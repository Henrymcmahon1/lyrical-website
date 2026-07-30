# Mobile motion — design

**Date:** 2026-07-30 · **Scope:** the home page below 768px ·
**Supersedes nothing.** Extends `2026-07-30-lyrical-website-design.md`.

---

## 1. The problem

The home page reads flat on a phone. The handover (§3.3) attributes this to the motion gate:

```css
@media (min-width: 768px) and (prefers-reduced-motion: no-preference) { .js-motion … }
```

That gate is correct and stays. A sticky pinned track on a phone can hold a user in front
of a screen they cannot advance, and lowering the breakpoint reintroduces that.

But the gate is not the whole story.

### 1.1 The audience morph is mistimed on mobile, not disabled

`components/sections/S02bAudience.tsx` gates its effect on `prefers-reduced-motion` only —
**not** on the breakpoint. The rAF loop therefore runs on phones. What is gated is the
*sticky track*: `.js-motion .audience-track { height: 190vh }` exists only above 768px.

The loop reads progress as track progress:

```ts
const scrollable = rect.height - window.innerHeight
const p = scrollable > 0 ? clamp(-rect.top / scrollable) : 1
```

Below 768px there is no 190vh track, so `rect.height` is just the content height:

| Phone case | `scrollable` | Result |
|---|---|---|
| Section taller than the viewport | small and positive | `p` stays 0 until the section's top passes the top of the screen, then the entire morph fires in the remaining sliver — after the mark has scrolled away |
| Section shorter than the viewport | `<= 0` | `p = 1` immediately. Fully resolved on arrival. No morph at all |

Either way the visitor never sees the pause become the mark. **This is the single largest
contributor to "mobile feels static", and it is a driver bug, not a missing feature.**

> **Step 0 of implementation is to confirm this by measurement**, not to assume it. Load
> `/` at 375×812, log `rect.height`, `innerHeight` and `p` through the section. Record the
> numbers in the plan. The remedy below is the same under either case, but the claim should
> not enter the codebase unverified.

### 1.2 What else is lost

| Track | Component | Desktop | Mobile today |
|---|---|---|---|
| Audience morph | `S02bAudience` | 190vh sticky | runs, mistimed (§1.1) |
| Fidelity, 4 claims | `S04Fidelity` → `PinnedClaims` | 100vh + 104vh | static stacked list |
| How it works, 6 steps | `S05How` → `PinnedStepper` | 100vh + 156vh | static stacked list |
| What you receive, 4 items | `S06Receive` → `PinnedStepper` | 100vh + 104vh | static stacked list |
| The turn, 1 line | `S09bNow` | 150vh sticky | static; early return at line 28 |

What survives on mobile: scroll reveals, staggered pop-in, the drifting language reels, the
hero Unlock.

---

## 2. Decisions taken

Agreed with Henry before writing this.

| Decision | Choice |
|---|---|
| Focal point | **The mark morph carries mobile as the one hero beat.** Not five competing beats |
| Morph driver | **Scroll-linked, bidirectional.** Scrubs with the finger, un-morphs on scroll up |
| Also treated | The turn line; per-item reveals on the three list sections; a compact sticky rail |
| Rejected | Horizontal snap carousel for *What you receive* — it hides three of four deliverables behind a swipe, on the section that answers "what do I actually get" |

---

## 3. Architecture

Five units. Each is independently understandable and independently revertible.

### A. `lib/scroll-progress.ts` — pure geometry

Two functions, no DOM access, no React. Both take a plain `{ top, height }` and a viewport
height, so they are unit-testable without a browser.

```ts
/** Progress through a sticky track: 0 when the panel sticks, 1 when it releases. */
export function trackProgress(rect: Rect, vh: number): number

/** Progress as a section ENTERS the viewport: 0 when its top touches the bottom
 *  edge, 1 after it has travelled `span` viewports upward. */
export function entryProgress(rect: Rect, vh: number, span = 0.85): number
```

`trackProgress` is today's inline expression, extracted verbatim including the
`scrollable <= 0 → 1` branch. `entryProgress` is the formula already proven safe in
`S09bNow.tsx:51`, generalised.

Both clamp to `[0, 1]` and must never return `NaN` — including when `vh` is 0, which
happens in jsdom.

**Why extract:** the same two formulas are currently duplicated across four components with
subtly different edge-case handling. The distinction between them is the exact thing that
caused the blank-screen class of bug on this project (handover §5: *"Scroll-driven fades
must key off viewport entry, not pinned-track progress"*). Naming them makes the choice
explicit at every call site.

### B. Audience morph — swap the driver by breakpoint

`S02bAudience.tsx` keeps its rAF + IntersectionObserver loop unchanged. Only the progress
line changes:

```ts
const p = wide ? trackProgress(rect, vh) : entryProgress(rect, vh, 0.85)
```

where `wide` comes from `matchMedia('(min-width: 768px)')`, re-read on `change` so a device
rotation or a resized desktop window switches drivers without a reload.

Below 768px the morph therefore completes over roughly 0.85 of a viewport of scrolling,
landing on the finished mark at about the moment the section reaches the top of the screen.
The rotation split (45% rotate, 55% bend) and the `after` threshold are unchanged.

The mark is never masked, clipped or punched through — it stays two overlapping filled
paths whose `d` attribute interpolates. Handover §5's blank-cream-screen failure mode does
not apply.

### C. The turn line — let mobile run the entry animation

Remove the `if (!mq.matches) { … return }` early return at `S09bNow.tsx:28`. The entry
formula was written specifically to avoid keying off track progress, so it already behaves
correctly with no sticky panel.

One conditional remains: `drift` — the lift-away as the panel exits — is computed from track
progress and only makes sense against a pinned panel. Below 768px `drift` is forced to 0.
Without a pin there is nothing to lift away from, and a constant 14px offset on a section
that never pins is noise.

### D. Compact sticky rail — mobile only

Not the whole heading block. On a 375px screen the eyebrow + `text-4xl` h2 + intro + dots
occupies roughly 40% of the viewport; sticking that leaves too little room for the content
it is supposed to be a cue for.

Instead a new element renders below the intro, `md:hidden`:

- the existing progress dots
- the eyebrow text, **where one exists**. `PinnedStepper` takes an `eyebrow` prop;
  `PinnedClaims` does not, and `S04Fidelity` has none. That section's rail therefore renders
  dots alone. No new visitor-facing copy is invented here — copy is Jordan's and Henry's, and
  `tests/copy.test.ts` guards the page
- `position: sticky; top: 3.75rem` — clearing the 60px sticky nav (`min-h-11` + `py-2`)
- `bg-cream/85` + `backdrop-blur-sm`, matching `Nav.tsx`, so items scrolling under it stay legible

The active index is **already computed** in both `PinnedClaims` and `PinnedStepper` from
track progress; below 768px it is simply discarded because `pinned` is false. On mobile the
list is taller than the viewport, so track progress is well-defined and gives a sensible
0→1 as the reader moves through it. The rail consumes `active` directly.

`data-active` on `pin-item` continues to be gated on `pinned`, so the desktop crossfade is
untouched.

**Risk to check during implementation:** `position: sticky` fails silently inside an
ancestor with `overflow: hidden` or `overflow: clip`. Verify the ancestor chain before
declaring this done.

### E. Per-item reveals — mobile only, one observer per item

A new class, with rules that exist **only** in the mobile, motion-allowed, JS-enabled
intersection:

```css
@media (max-width: 767px) and (prefers-reduced-motion: no-preference) {
  .js-motion .pin-reveal     { opacity: 0; transform: translateY(14px);
                               transition: opacity .6s …, transform .6s …; }
  .js-motion .pin-reveal.in  { opacity: 1; transform: none; }
}
```

**Why a new class rather than reusing `.reveal`:** `.reveal` applies at every breakpoint. On
desktop the `pin-item`s are absolutely stacked and crossfade via an opacity *transition*; an
opacity *animation* layered on top wins the cascade and breaks the pin. Scoping to
`max-width: 767px` keeps the two mechanisms from ever meeting.

**Why one observer per item rather than the existing `.stagger`:** `.stagger` fires once for
the whole container. `How it works` has six steps and is several viewports tall on a phone,
so a container-level trigger would animate steps 4–6 while they are still off-screen — the
reader would arrive at content that had already finished moving. Each `<li>` is observed
individually, with `rootMargin: '0px 0px -8% 0px'` so an item commits slightly after it
enters rather than at the exact edge.

Items are observed by ref list rather than by wrapping each `<li>` in a `Reveal` component —
`<ul> > <div>` is invalid markup.

---

## 4. Blank-screen safety

Every motion bug on this project produced an empty screen rather than a visual glitch. The
defence here is structural, not vigilance.

| Condition | What happens |
|---|---|
| JavaScript disabled | `.js-motion` never added → **no rule in §E exists** → every item opaque |
| `prefers-reduced-motion: reduce` | `no-preference` query fails → **no rule exists** → opaque, and the global duration collapse at `globals.css:365` still lands `both`-filled animations on their end state |
| ≥768px | `max-width: 767px` fails → **no rule exists** → desktop pin behaves exactly as today |
| IntersectionObserver never fires | Observers are attached in `useEffect` and IO fires synchronously on `observe()` for elements already intersecting, so the first paint after hydration commits anything on screen |

The audience morph adds no new `opacity: 0`. During the morph the section still renders its
eyebrow, heading, the mark, "English" and two paragraphs — well above the sweep's 25-character
ink threshold. The existing `a-bloom` fade on the seven other language names is unchanged and
already ships.

`S09bNow` was the origin of the "fade at track progress 0 is a blank screen" lesson. This
change does not reintroduce track progress there; it removes a guard around the entry
formula that already replaced it.

---

## 5. Verification

### 5.1 Gates

```bash
npm test          # existing 61, plus the new ones below
npx eslint .      # silent
npx tsc --noEmit  # silent
npm run build     # clean
```

### 5.2 New tests

| Test | Asserts |
|---|---|
| `tests/scroll-progress.test.ts` | Both functions clamp to `[0,1]`, are monotonic in scroll, and return a finite number for `vh = 0`, zero-height rects, and rects shorter than the viewport |
| `tests/tokens.test.ts` (extend) | Every rule declaring `opacity: 0` in the mobile motion block is scoped to `.js-motion` — mirroring the existing check at line 93 |
| `tests/tokens.test.ts` (extend) | `.pin-reveal` rules appear only inside a `max-width: 767px` query, so they can never reach the desktop pin |

### 5.3 Fix the sweep before trusting it

`scripts/audit-responsive.mjs:91` waits a fixed 260ms after each `scrollTo`. Handover §5
records that fixed timeouts against Lenis produced false readings twice. **This must be
fixed before it is used as the gate for this work**, or §6 of the handover is measuring
nothing:

- poll `window.scrollY` until it is unchanged across two consecutive animation frames, with
  a ceiling of ~1.5s, then measure
- the script has been written but never run; expect to fix genuine findings unrelated to this
  work on the first pass, and report them separately rather than folding them in silently

Then run it against `/`, `/hear`, `/about` at 375×667, 393×852, 412×915, 768×1024 and
1280×800. Zero blank screens is the pass condition, and the 768 and 1280 rows must be
unchanged from a baseline captured **before** any of this work lands.

### 5.4 By hand

Windows Chrome will not size a window below 500px. Constrain the document instead
(`documentElement.style.width = '375px'`); every breakpoint sits above 500 so the same CSS
applies.

- scroll down through the audience section slowly, then **back up** — the morph must reverse
- `prefers-reduced-motion: reduce` — everything visible, nothing moving, nothing stranded
- JavaScript disabled — every section readable, the form still submittable
- rotate 375×812 → 812×375 mid-scroll and confirm the driver swap does not strand a frame

---

## 6. Out of scope

Named so they do not creep in:

- The `.zoom-track` / `.zoom-stage` / `.zoom-mark` rules at `globals.css:327-358` are **dead
  code**. `components/ZoomThroughMark.tsx` does not exist, and nothing references those
  classes. `CLAUDE.md` and handover §5 both cite the file as though it ships. This belongs
  to the cleanup task, along with correcting both documents — not to this one.
- Un-pinning *What you receive* on desktop (handover §7.1) is a separate decision Henry has
  not taken.
- Supabase, Resend, and the custom domain.
- Page length. This work is roughly length-neutral: no track heights change, and the sticky
  rail adds a ~40px strip rather than flow height.

---

## 7. Locked constraints this work must not touch

Restated so they are checkable at review, not re-litigated:

- Brand tokens, the mark geometry, `app/icon.svg`
- No gradients that paint. Transform and opacity only — never width, height, margin, top or left
- No `animation-timeline: view()`. IntersectionObserver only
- All reveal-style rules scoped to `.js-motion`
- No utility-like class defined outside Tailwind's layers
- The enquiry route's degradation ladder and the banned copy list
