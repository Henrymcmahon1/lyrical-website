# Lyrical — website

Funnel-first marketing site. Three routes, ten home sections, a gated A/B audio player, and
an enquiry form that writes to Supabase and emails you.

- **Spec:** `docs/superpowers/specs/2026-07-30-lyrical-website-design.md`
- **Plan:** `docs/superpowers/plans/2026-07-30-lyrical-website.md`
- **Brand document:** `docs/brand/brand-v2.html` (open in a browser)

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # 56 tests
npm run build
```

---

## What you need to set up

**Check where you are first:**

```bash
node scripts/preflight-enquiry.mjs
```

It lists which variables exist on Vercel, tells you what a visitor currently gets when they
submit, and prints the exact commands for whatever is missing. Add `--smoke` once you think
you are done and it will send one labelled test enquiry end to end.

`ENQUIRY_TO_EMAIL`, `ENQUIRY_FROM_EMAIL` and `GATE_SECRET` are **already set** on Vercel
across all three environments. Only three remain, and all three need an account only you can
create: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`.

Until `RESEND_API_KEY` exists the route returns **503** and the form offers the visitor a
prefilled email instead, so nothing typed is thrown away. That is a safety net, not a
substitute: it costs the visitor a second step.

The site runs right now without any accounts. To make enquiries actually arrive, do these
four things. **They all have free tiers; none of this costs money.**

### 1. Supabase (the database)

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the contents of `supabase/schema.sql`, run it.
3. Go to **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **`service_role` key** (the secret one, *not* `anon`) → `SUPABASE_SERVICE_ROLE_KEY`

> The `service_role` key bypasses row-level security, which is why it is only ever read on
> the server in `lib/supabase-admin.ts`. Never put it in a client component — a test in
> `tests/copy.test.ts` guards against that.

To read your enquiries: **Table Editor → enquiries**.

### 2. Resend (the email alert)

1. Create an account at [resend.com](https://resend.com) using **henry.jamcmahon@gmail.com**.
2. **API Keys → Create API Key** → `RESEND_API_KEY`.
3. Leave `ENQUIRY_FROM_EMAIL=onboarding@resend.dev` for now.

> ⚠️ Resend's test sender can only deliver to the address that owns the Resend account.
> That is why step 1 says to sign up with your Gmail. Once you own a domain, verify it in
> Resend and change `ENQUIRY_FROM_EMAIL` to something like `hello@yourdomain.com` — then it
> can send anywhere.

### 3. A gate secret

```bash
openssl rand -hex 32
```

Put the result in `GATE_SECRET`. It signs the cookie that remembers a visitor has unlocked
the demos. Changing it later just re-gates everyone; nothing breaks.

### 4. Write the env file

Copy `.env.example` to `.env.local` and fill it in:

```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
ENQUIRY_TO_EMAIL=henry.jamcmahon@gmail.com
ENQUIRY_FROM_EMAIL=onboarding@resend.dev
GATE_SECRET=
```

`.env.local` is gitignored. Never commit it.

---

## Adding audio

Two files per demo, in a lowercase pair folder:

```
public/audio/en-es/my-track.original.mp3
public/audio/en-es/my-track.translated.mp3
```

Then add or edit the entry in `content/demos.json` and set `hasAudio` to `true`:

```json
{
  "source": "EN",
  "target": "ES",
  "artist": "Artist Name",
  "title": "Track Name",
  "slug": "my-track",
  "seconds": 18,
  "hasAudio": true
}
```

Pairs with `hasAudio: false` render as *"isn't published yet"* with a link to enquire — they
never show a broken player. The language wheels read from this file, so adding a pair is a
data change, not a code change.

---

## Deploying to Vercel

1. Push to GitHub (`origin` is already configured).
2. At [vercel.com](https://vercel.com) → **Add New → Project** → import `lyrical-website`.
3. Add every variable from `.env.local` under **Settings → Environment Variables**, and set
   `NEXT_PUBLIC_SITE_URL` to your real URL.
4. Deploy. Framework, build command and output directory are all detected automatically.

---

## Brand rules enforced by tests

`npm test` fails rather than letting these drift:

| Rule | Why |
|---|---|
| The four colours are exactly `#F7EFE1` / `#1C1A19` / `#4433D6` / `#EE4E22` | Locked with your partner |
| No gradients anywhere | Dates fast; reads as an AI product |
| Ember is never body text | Measured 3.2:1 on cream — fails accessibility |
| Indigo is never used on the dark ground | Measured 2.7:1 — fails accessibility |
| No "AI-generated", `6.4×`, `2.38B`, or "Solutions" | Contradicts the Monetization Thesis, or the brand voice |
| Reveal animations only run under `.js-motion` | Otherwise every section is invisible with JS off |
| The Unlock's final frame equals the canonical mark | A logo animation must not end on a different shape |
| The mark's lower wave diverges from the upper | It means *approximately* equal, not equal |

## The mark

`lib/mark.ts` generates it — nothing is hand-drawn. Cubic Béziers are sampled at a fixed 58
points and offset along their normals by a taper function, so:

- it is pure TypeScript (runs on the server, testable, no DOM);
- every state has an identical point count, which is why the Unlock animation can morph
  without a morph library;
- and `app/icon.svg` is generated from the same geometry, so the favicon cannot drift.

## Animation notes

| Animation | Where | Implementation |
|---|---|---|
| **The Unlock** `‖ → = → ≈` | Hero, once on load | Rotation via transform, morph via precomputed frames written straight to the DOM (no React re-renders at first paint) |
| **The Living Mark** | Hero + fidelity section only | CSS `sway` on transform. Never in the nav, footer or favicon — there the mark is an identifier and stays still |
| **Language Wheels** | Listening section | A real listbox: arrow keys, Home/End, `aria-activedescendant`. Lands and holds; never spins indefinitely |
| **Reveals** | Throughout | IntersectionObserver, opt-in via `.js-motion` |
| **Dividers** | Between sections | `stroke-dasharray` draw-on |

Everything animates `transform` and `opacity` only, and all of it is disabled under
`prefers-reduced-motion`.

## Still open

- Jordan's and Henry's real bios and roles — placeholders in `content/team.json`
- A domain (needed for a proper sending address and OG tags)
- Real demo audio
- Partner confirmation that the name is **Lyrical**, not *Lyricall*
