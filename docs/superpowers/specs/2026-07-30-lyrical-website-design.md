# Lyrical Website — Design Specification

**Date:** 2026-07-30
**Repo:** https://github.com/Henrymcmahon1/lyrical-website
**Status:** Approved for implementation

---

## 1. Purpose

A funnel-first marketing site for Lyrical, a company that re-sings existing recordings in
another language in the original artist's voice, preserving melody, phrasing and the original
instrumental.

**The site has one job:** convert a rights holder into an enquiry. Lyrical's own strategy states
that *authorization, not production capability, is the binding constraint* in this category.
The site therefore sells trust, not technology.

**Two audiences, one page:**

| Audience | Wants | CTA framing |
|---|---|---|
| Artists & managers | One flagship release | "Hear your song in another language" |
| Labels & catalogue owners | Catalogue infrastructure at scale | "Discuss a catalogue programme" |

A single enquiry form serves both, with a "who are you" field routing the conversation.

---

## 2. Brand — locked

Derived from `Brand Bible v1.2` (partner-authored) reconciled through Brand Identity v2.
Approved decisions: modulated stroke, 6% asymmetry, Indigo v1.2 retained, Bodoni Moda +
Archivo, 6.4× removed.

### 2.1 Colour — four colours, four jobs

| Token | Hex | Job |
|---|---|---|
| `--cream` | `#F7EFE1` | Owns space. The ground everything sits on. |
| `--graphite` | `#1C1A19` | Owns typography. All text, always. Never a decorative field. |
| `--indigo` | `#4433D6` | Owns identity. The mark, primary actions, anywhere the brand speaks. |
| `--ember` | `#EE4E22` | Owns action. CTAs, live states, where something is happening. |

**Hard rules from measured contrast (on cream):**

| Pairing | Ratio | Body text | Large / UI |
|---|---|---|---|
| Graphite on cream | 15.8:1 | Pass | Pass |
| Indigo on cream | 6.8:1 | Pass | Pass |
| Ember on cream | 3.2:1 | **Fail** | Pass |

- **Ember never carries body text.** Fills, large type and UI only, with graphite or cream on top.
- Dark treatment (listening sections only): ground `#1B1D1F`, type/mark `#EDEBE4`,
  accent `#FF6B2C`. Indigo is not used on dark — it does not survive the ground.
- No gradients anywhere, on any element. Solid fills only.

### 2.2 The mark

Two modulated (tapered) waves — thick at the belly, coming to a point at each tip. The lower
wave diverges from the upper by **6%**, so the mark reads as ≈ (approximately equal) rather than
= (equal). This is deliberate: a translated record is not identical to the original, and Lyrical's
client material says *transcreation*.

| Property | Value |
|---|---|
| Artboard | 64 × 64 units |
| Stroke construction | Generated: centreline sampled at 58 points, offset along the normal by `w(t) = 4.6 · sin(πt)^0.62` |
| Divergence | 6% |
| Clear space | ≥ 1 wave height on all sides |
| Minimum size | 16 px / 5 mm |
| Colour | Solid indigo, graphite, or cream. Never two-tone. |

**Lockups:**

| Variant | Use |
|---|---|
| Stacked (mark above wordmark) | Primary. Covers, footer, title cards. |
| Horizontal (mark beside wordmark) | Utility only: nav bar, email signature, letterhead, contract header. |
| Mark alone | Favicon, avatar, asset stamp. |
| As punctuation | `english ≈ español` inside running text. |

### 2.3 Typography

Both faces are open source (SIL OFL) — no licence cost, no legal exposure on assets that appear
in contracts.

| Role | Face | Rule |
|---|---|---|
| Brand voice — display | **Bodoni Moda** | Headlines, wordmark, taglines. A Didone is a modulated stroke, so it shares the mark's construction. |
| Product voice — text & data | **Archivo** | Body, labels, forms, legal copy, tabular figures. |

Rule inherited from v1.2: *if the brand is talking, Bodoni; if the product is talking, Archivo.*

Self-host both via `next/font/local` — do not use a font CDN.

### 2.4 The ≈ system

The mark is a keyboard character, so it functions as grammar throughout:

- Language pairs: `english ≈ español`
- File naming: `artist_track_EN≈ES_v3_master.wav`
- Delivery notes: `1 asset · EN ≈ ES · finished mix + dry stem`

### 2.5 Guardrails

Never: gradients · two-tone or recoloured mark · redrawing/rotating/containing the mark ·
content in the clear space · graphite as a decorative field · ember as body text ·
population multipliers (no 6.4×, no 2.38B) · the phrase "AI-generated" · robot or circuit
imagery · stock studio/headphone photography · enterprise filler words ("Solutions").

Approved vocabulary: *recreated*, *re-sung*, *performed*, *transcreation*.

---

## 3. Animation

All motion is CSS + SVG. **No Rive, no Lottie, no After Effects.** Rationale: CSS animations run
on the compositor thread and ship at 0 KB runtime, versus ~200 KB WASM for Rive and ~60 KB for
Lottie. Neither runtime's advantages (state machines, designer handoff) apply to four
deterministic vector animations.

Because tapered outlines are *generated* from centrelines at a fixed sample count, every state of
the mark has an identical point count by construction. Path morphing is therefore plain linear
interpolation between coordinate arrays — no morph library required.

### 3.1 The Unlock — hero, on load

| Beat | Shape | Meaning |
|---|---|---|
| 1 | `‖` two vertical bars | Pause. The catalogue, stopped at a language border. |
| 2 | `=` rotated 90° | "Equals" — naive translation. |
| 3 | `≈` bars bend into waves | What Lyrical actually delivers. |

~1.8 s, ease `cubic-bezier(.16,.84,.34,1)`. Plays once, then rests in canonical form. Wordmark
resolves after beat 3.

### 3.2 The Language Wheels — section 03, the centrepiece

Two vertical reels flanking the mark: source language left, target language right.

- Reels contain **only the 8 supported languages**. They **land on a pair and hold** — they never
  spin indefinitely, because perpetual motion implies unlimited capability.
- **The animation is the control.** Selecting a pair loads that pair's audio. It is the A/B player,
  not decoration.
- Keyboard accessible: reels are a labelled listbox, not a div with a scroll handler.

### 3.3 The Living Mark

| Context | Behaviour |
|---|---|
| Hero | Alive — travelling wave, ~3% amplitude, 6 s cycle |
| On scroll | Amplitude responds to scroll velocity, then settles |
| Nav, favicon, footer, documents | **Canonical and static, always** |

The mark breathes where it is a subject, never where it is an identifier. This keeps the
"never redraw the mark" guardrail intact.

### 3.4 Section dividers

The two waves stroke themselves on via `stroke-dasharray` as each section enters view, acting as
the rule between sections.

### 3.5 Implementation rules

- Native `animation-timeline: view()` / `scroll()` behind `@supports (animation-timeline: view())`,
  with an IntersectionObserver fallback. Support is ~84% (Chrome/Edge 115+, Firefox 132+, Safari 18+).
- Animate **only** `transform` and `opacity`. Never width, height, margin or top/left.
- Smooth scroll via Lenis.
- Everything disabled under `prefers-reduced-motion: reduce`.
- The site must be fully readable and the form fully submittable with JavaScript disabled.

---

## 4. Structure

Three routes. Contact is an overlay, not a page.

| Route | Purpose |
|---|---|
| `/` | The funnel. Ten sections, CTA repeated three times. |
| `/hear` | Gated A/B demo player. Email required before any audio. |
| `/about` | Story, team, rights-first position. |

### Home, in order

| # | Section | Content | Motion |
|---|---|---|---|
| 01 | Hero | "One song. Any language. Same soul." | **The Unlock** → wordmark resolves |
| 02 | The border | "A great song stops at a language border." | Headline builds word by word |
| 03 | **The Wheels** | Language pair selector + gated A/B player. **Uses the dark treatment** (§2.1) — the page dims for playback, as a studio does. | The centrepiece (§3.2) |
| 04 | What stays the same | Artist's real voice · original melody · untouched backing · singable translation | Sticky pin, content swaps |
| 05 | How it works | Send the song → recreate the lyrics → sing it in the voice → receive the assets | Horizontal rail from vertical scroll |
| 06 | What you receive | Finished mix + dry vocal stem + reference versions + per-song report | Cards settle |
| 07 | Two doors | Artist ↔ Label split | Split panel, hover expands |
| 08 | Rights-first | Voices used only with permission; artist and rights-holder approval | Deliberately still |
| 09 | Team | Jordan Brock, Henry McMahon | Quiet fade |
| 10 | The ask | Enquiry form | Ember flip |

---

## 5. Data & email

### 5.1 Supabase — `enquiries`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | `gen_random_uuid()` |
| `created_at` | timestamptz | `now()` |
| `name` | text | required |
| `email` | text | required, format-validated |
| `role` | text | enum: `artist`, `manager`, `label`, `publisher`, `distributor`, `other` |
| `company` | text | nullable |
| `catalogue_size` | text | nullable, enum bucket |
| `target_languages` | text[] | nullable |
| `message` | text | nullable |
| `source` | text | which section/CTA submitted it |
| `unlocked_audio` | boolean | true when the submission was made to unlock `/hear` |
| `user_agent`, `referrer` | text | nullable |

- Row Level Security on. Anonymous role may `INSERT` only; no `SELECT`.
- Writes go through a Next.js route handler using the service key server-side. The service key is
  never exposed to the client.
- Unique index on `lower(email)` is **not** applied — the same person may enquire twice.

### 5.2 Email

Resend, from a verified domain, to **henry.jamcmahon@gmail.com** on every submission.
Subject: `Lyrical enquiry — {name} ({role})`. Body includes every field plus a Supabase row link.

Failure rule: **if the email send fails, the DB write must still succeed** and the user must still
see success. Log the send failure; never lose the lead. This follows the project's fail-loud
philosophy for dependencies but not at the cost of the enquiry itself.

### 5.3 Anti-spam

Honeypot field plus a timing check (reject submissions faster than 2 s). No CAPTCHA — it adds
friction to a high-value, low-volume form.

---

## 6. Audio

No real audio exists yet. Build the player against placeholders with a fixed convention so files
drop in without code changes.

```
public/audio/{sourceLang}-{targetLang}/{slug}.original.mp3
public/audio/{sourceLang}-{targetLang}/{slug}.translated.mp3
```

- A manifest at `content/demos.json` lists available pairs and tracks. The wheels render from the
  manifest, so adding a pair is a data change.
- Any pair without files renders as *available on request* rather than as a broken player.
- Audio is `preload="none"`; nothing downloads until the user presses play.

**Gate:** email required before **any** playback, per approval. This applies identically to the
home wheels (§04, section 03) and to `/hear` — the wheels are visible and spinnable, but pressing
play opens the form overlay. Submitting sets `unlocked_audio = true`, writes a signed
`httpOnly` cookie, and unlocks playback everywhere for that visitor without a second gate.

Because this is the hardest of the gating options considered, the wheels must communicate what is
behind the gate before asking: name the artist, the pair and the duration, so the visitor knows
what they are trading an email for.

---

## 7. Stated assumptions

Recorded because they were raised, questioned, and confirmed by the client:

1. **All 8 languages (EN, ES, IT, FR, PT, ZH, JA, KO) are deliverable today.** The internal
   capability document describes only Spanish ↔ English as proven end to end. The concern was
   raised three times and the claim was confirmed by the client; the site states 8 languages and
   the tagline retains "Any language."
2. Deliverable is a finished mix plus a dry vocal stem (not stems only).
3. Public technical depth is limited to outcomes. No pipeline stages, vendors, tooling or costs.
4. The name is **Lyrical**, single L, pending partner confirmation.

---

## 8. Open items — not blocking

| Item | Needed for | Placeholder until then |
|---|---|---|
| Jordan & Henry roles, bios, photos | §09 Team | Names + role placeholders, initials-in-circle |
| Domain | Footer, email sending domain, OG tags | `lyrical.studio` |
| Real demo audio | §03, `/hear` | Silent placeholders via manifest |
| Partner sign-off on name | Everything | Assume Lyrical |

---

## 9. Non-goals

Not in this build: client login or dashboard · CMS · payments · multi-language UI (the site is in
English; only the *product* is multilingual) · blog · investor materials · the "Lyrical Authorized"
seal (deferred to a later phase) · any published catalogue analysis or artist-specific report.

---

## 10. Testing & verification

- Contrast asserted in a unit test against the token values, so a palette edit that breaks
  accessibility fails CI.
- Form route handler tested for: valid submit, missing required fields, malformed email,
  honeypot trip, Supabase failure, Resend failure (must still 200).
- `prefers-reduced-motion` verified — no transform or opacity animation runs.
- Every section screenshotted at 375 px, 768 px and 1280 px, light and dark, and compared before
  being called done.
- No horizontal page scroll at any breakpoint.
