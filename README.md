# Lyrical — website

Funnel-first marketing site. Three routes, ten home sections, a gated A/B audio player, and
an enquiry form that writes to Supabase and emails you.

- **Spec:** `docs/superpowers/specs/2026-07-30-lyrical-website-design.md`
- **Plan:** `docs/superpowers/plans/2026-07-30-lyrical-website.md`
- **Brand document:** `docs/brand/brand-v2.html` (open in a browser)

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # 186 tests
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

**Every variable is set on Vercel and the pipeline is live**, verified end to end on
production. What follows is the setup record, and what you would repeat to stand this up
somewhere else.

The site still runs without any of these. With no `RESEND_API_KEY` the route returns **503**
and the form offers the visitor a prefilled email instead, so nothing typed is thrown away.
That is a safety net, not a substitute: it costs the visitor a second step.

**All four have free tiers; none of this costs money.**

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

**Already done.** The account is owned by `info@lyricalglobal.com`, `lyricalglobal.com` is
verified, and the live key is named `lyrical-website-prod` with sending access only.

Kept for whoever sets this up again somewhere else:

1. Create an account at [resend.com](https://resend.com).
2. **Domains → Add Domain**, then add the DKIM and SPF records it gives you.
3. **API Keys → Create API Key** → `RESEND_API_KEY`. Sending access, not full access.
4. Set `ENQUIRY_FROM_EMAIL` to an address on the verified domain.

> ⚠️ Until a domain is verified, Resend's test sender only delivers to the address that owns
> the account. `canEmailStrangers()` in `lib/enquiry-email.ts` reads that from the sender, so
> the enquirer confirmation switches itself on the moment `ENQUIRY_FROM_EMAIL` stops being an
> `@resend.dev` address, and off again if it ever goes back.

> ⚠️ If the domain also receives mail elsewhere, put Resend's SPF on a subdomain such as
> `send.`, and never add its "Enable Receiving" record. That one is an MX at the apex with a
> lower priority number than most mail hosts use, so it silently captures all inbound mail.

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
ENQUIRY_TO_EMAIL=jordan@lyricalglobal.com,henry@lyricalglobal.com
ENQUIRY_FROM_EMAIL=info@lyricalglobal.com
GATE_SECRET=
```

`ENQUIRY_TO_EMAIL` is a **comma separated list**. Adding or removing a founder is an
environment change with no deploy.

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

- Real demo audio. Nothing is rights-cleared yet, so this is a commercial task, not a
  technical one
- No social proof and no pricing signal anywhere on the site

Settled since: the domain is live at **lyricalglobal.com**, and the name is **Lyrical**, one L.
