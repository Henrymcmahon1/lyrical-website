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
- Fonts: Bodoni Moda (brand voice) + Archivo (product voice), self-hosted. Never a CDN.
- Banned copy: "AI-generated", "6.4x", "2.38B", "Solutions".
  Say: recreated, re-sung, performed, transcreation.
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
