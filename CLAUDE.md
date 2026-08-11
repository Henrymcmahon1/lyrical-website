# Lyrical website

Brand is LOCKED. Do not invent colours or faces, and do not redraw the mark.
Spec: docs/superpowers/specs/2026-07-30-lyrical-website-design.md

## Next.js version note
This is Next.js 16 and it has breaking changes vs older versions. Read the relevant guide in
`node_modules/next/dist/docs/` before writing framework code. Notably: `cookies()`,
`headers()`, `params` and `searchParams` are async-only.

## Tokens
cream #F7EFE1 (space) · graphite #1C1A19 (type) · indigo #4433D6 (identity) · ember #EE4E22 (action)
Dark sections only: ground #1B1D1F · ink #EDEBE4 · accent #FF6B2C

## Hard rules
- No gradients, anywhere, on anything.
- Ember never carries body text (3.2:1 on cream). Fills and large type only.
- Indigo is never used on the dark ground (2.7:1).
- Animate transform and opacity only. Never width/height/margin/top/left.
- Fonts: Fraunces (brand voice) + Archivo (product voice), self-hosted. Never a CDN.
- Banned copy: "AI-generated", "6.4x", "2.38B", "Solutions".
  Say: recreated, re-sung, performed, transcreation.
- "AI" ON ITS OWN IS ALLOWED, since 2026-08-09, on Henry's explicit instruction after the
  trade-off was put to him. It appears as a CATEGORY LABEL, in the page title, the meta
  description, the hero paragraph and `/ai-music-translation`, because every phrase a buyer
  searches contains it. "AI-generated" is still banned and `tests/copy.test.ts` still enforces
  it: that phrase implies the recording is fabricated, which is the claim the rule exists to
  prevent. Nothing on the site says the output is synthetic.
- US spelling in all visitor-facing copy: authorized, catalog, program, not authorised,
  catalogue, programme. IDENTIFIERS KEEP THE OLD SPELLING. `catalogue_size` is a live
  Supabase column, a form field name and a CSV header; renaming it needs a migration.
  Same for `centre`/`centreline` in lib/mark.ts, which are geometry variables.
- All motion off under prefers-reduced-motion.
- The site must be readable and the form submittable with JavaScript disabled.
- Reveal animations must stay scoped to `.js-motion`, or no-JS visitors see blank sections.
- Do NOT use `animation-timeline: view()` for reveals; it was observed pinning elements at
  negative progress (permanently invisible). IntersectionObserver only.

## The mark
Generated in lib/mark.ts, never hand-drawn. app/icon.svg is generated from the same
geometry. If you change the geometry, regenerate the icon.

## Verify before claiming done
npm test && npm run build

## The mark has no counter
Do NOT build aperture, punch-out or clip-through effects from the mark. It is two open
strokes with no enclosed area; its middle is the GAP between the waves, so centred content
sits in the opaque part and the screen renders blank. Use overlapping transform+opacity
layers instead. The safe pattern is the pause-to-mark morph in
`components/sections/S02bAudience.tsx`: it interpolates the outline and never masks it.
(An earlier `ZoomThroughMark.tsx` demonstrated this and no longer exists. Its orphaned
`.zoom-*` CSS was removed on 2026-07-30.)

## Two scroll clocks, and they are not interchangeable
`lib/scroll-progress.ts` exports `trackProgress` and `entryProgress`. Track progress is 0 at
the moment a sticky panel sticks, by which point the panel already fills the screen, so a
fade keyed to it starts at opacity 0 on a full screen. It is also forced to 1 whenever an
element is shorter than the viewport, which silently disables anything driving off it on a
phone. Use it ONLY where something actually pins. Everywhere else, use entry progress.
