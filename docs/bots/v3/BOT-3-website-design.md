# Bot 3: leaner /artists with an animated earnings graph, Coffey slot, investor placeholders

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or
> superpowers:executing-plans. Tests first, task by task. Steps use `- [ ]`. Also load
> superpowers:brainstorming only if a design choice is genuinely open; the design is largely decided
> below.

**Paste this to start the session:**
> Read `docs/HANDOVER-v3-2026-09-22.md`, `docs/superpowers/specs/2026-09-22-two-doors-v2-design.md`,
> then `docs/bots/v3/BOT-3-website-design.md` in your worktree of
> `C:\Users\User\CascadeProjects\lyrical-website`. Work on branch `feat/v3-website-design` off
> `develop`. Never touch `main`. Tests first. `npm test && npm run build` green before the PR. No em
> dashes. Brand is locked: cream, graphite, indigo, ember; Fraunces + Archivo; no gradients;
> lowercase `lyrical`; US spelling.

**Goal:** Three visual pieces, all fully unblocked (no schema, no Henry key needed to build):
1. `/artists` leaner and closer to the home page, with the calculator as the centrepiece and an
   **animated earnings graph** (gross only, every number an estimate).
2. A **Coffey Anderson before/after slot inside the home audience section** (`S02bAudience`), reusing
   the existing `S02Coffey` component; renders nothing until the files exist.
3. **Investor placeholders**: pitch deck (signed URL behind the gate), pitch flyer (a written
   section), and a YouTube-unlisted embed (`INVESTOR_VIDEO_ID`, renders nothing until set).

## Current state (verified 22 Sep)
- `/artists`: `app/artists/page.tsx` + `app/artists/eoi/` native POST. Uses
  `components/EarningsCalculator.tsx` (`initial={WORKED_EXAMPLE}`) and `components/ArtistEoiForm.tsx`.
  `lib/earnings.ts`: `PAYOUT_PER_STREAM_USD=0.004`, `MIN/MAX/DEFAULT_LANGUAGES` (1/8/2),
  `MIN/MAX/DEFAULT_AUDIENCE_SHARE` (0.1/1/0.8), `WORKED_EXAMPLE`, `estimateEarnings(input)`, `usd(n)`.
  GROSS only already (no 30%, no "human in the loop"). Sections today: hero, "What you receive" (3
  cards), "How it works" (5 steps), calculator, `#eoi`.
- Home `app/page.tsx` order: `S01Hero → S02bAudience → S03Wheels → S04Fidelity → S05How → S09bNow →
  S09cDoors`. The audience section is `components/sections/S02bAudience.tsx` (client; heading
  "Everyone who was always going to love it.").
- Coffey: `components/sections/S02Coffey.tsx` (server, currently UNUSED by any page). Exports
  `coffeyConfig(env)`, default `S02Coffey`, reads `COFFEY_ORIGINAL_PATH`, `COFFEY_COVER_PATH`,
  `COFFEY_BUCKET` (default `'listen'`); returns `null` until both paths set; renders
  `components/sections/CoffeyPlayer.tsx` with 4h signed URLs via `supabaseAdmin`.
- Investors: `app/investors/page.tsx` (gated, noindex) + `app/investors/actions.ts`.
  `content/investors.ts`: `INVESTORS`, `SECTIONS` (01-08), `COMPS`. Section 06 renders
  `INVESTORS.placeholder` text; section 03 renders `components/sections/CapTable.tsx`. **No video, no
  deck/flyer slot. `INVESTOR_VIDEO_ID` is used by nothing and is not in `.env.example`.**
- `components/Nav.tsx`: Home, Get started (`/#doors`), Studio. `components/Footer.tsx` as documented.

## Files this bot owns (Bot 3 alone edits Nav, Footer, content, sections)
`app/artists/**`, `components/EarningsCalculator.tsx`, `components/EarningsGraph.tsx` (new),
`app/page.tsx` (the audience/Coffey wiring), `components/sections/S02bAudience.tsx`,
`components/sections/S02Coffey.tsx`, `components/sections/CoffeyPlayer.tsx`,
`app/investors/**`, `content/investors.ts`, `components/sections/InvestorMedia.tsx` (new: deck +
video + flyer), `components/Nav.tsx`, `components/Footer.tsx`, `.env.example` (add `INVESTOR_VIDEO_ID`,
`INVESTOR_DECK_PATH`, `INVESTOR_DECK_BUCKET`), and its tests.

## Constraints
- No em dashes. Brand locked (see paste block). No gradients; ember never carries body text.
- Animations: SVG transform + opacity only, disabled under `prefers-reduced-motion`. The graph must
  render a correct static state with JavaScript off (the numbers are the point, motion is polish).
  Note: rAF motion cannot be measured in the Browser pane (memory `raf-paused-in-browser-pane`); rely
  on the reduced-motion static render for tests, verify motion by eye if a real browser is used.
- Every number in the calculator and graph carries the word "estimate". Gross new-language receipts
  only, no lyrical share, no 30%.
- Secrets never in files. Signed URLs are minted server-side from env paths Henry supplies.

---

### Task 1: The animated earnings graph
**Files:** `components/EarningsGraph.tsx`, wire into `components/EarningsCalculator.tsx`, tests.
- [ ] Failing test (render): given an `EarningsEstimate`, the graph renders one bar per language with
      an accessible label and the gross estimate per bar, a total, and the word "estimate"; under
      reduced motion it renders the full-height bars immediately (assert final heights present in
      SSR markup). No em dashes in labels.
- [ ] Implement an inline SVG bar chart driven by the calculator inputs: bars per language grow from
      zero (transform: scaleY / translate, opacity), CSS transition or a tiny rAF, gated by a
      `prefers-reduced-motion` check that renders final state. Colours from the brand tokens (indigo
      bars, graphite axis). It is the centrepiece: give it room and clear labels.
- [ ] Wire it into `EarningsCalculator` so it updates as inputs change. Keep the existing pure
      `estimateEarnings` and its tests green.

### Task 2: /artists leaner and closer to home
**Files:** `app/artists/page.tsx`, tests.
- [ ] Fewer words, more air, home-page rhythm. Keep the pitch (Door 1 terms on their own terms,
      Coffey precedent, streaming quality, proprietary voice models, being involved in the process,
      lossless stems, $0 upfront). Remove any dense comparison table. The calculator + graph is the
      centrepiece; the EOI form stays at `#eoi`. Keep the `app/artists/eoi/` no-JS path working.
- [ ] Render test: the page shows the calculator, the graph, the EOI form, and no `\u2014`; it does
      not show a royalty percentage (30% is investor-only).

### Task 3: Coffey slot in the home audience section
**Files:** `app/page.tsx`, `components/sections/S02bAudience.tsx`, `components/sections/S02Coffey.tsx`, `components/sections/CoffeyPlayer.tsx`, tests.
- [ ] Move the Coffey before/after player INTO the audience section (`S02bAudience`) as a slot that
      renders only when both `COFFEY_ORIGINAL_PATH` and `COFFEY_COVER_PATH` are set (reuse
      `coffeyConfig`). Remove any standalone Coffey section usage. Keep the signed-URL minting
      server-side. Because `S02bAudience` is a client component and Coffey needs server-side signed
      URLs, pass the rendered Coffey slot (or its signed URLs) in from the server page as a prop /
      child, rather than reaching for `supabaseAdmin` in the client.
- [ ] Test: with the env unset the audience section renders and contains no player; with both paths
      set (mock `coffeyConfig` / the signed-URL fetch) the before/after player appears. No `\u2014`.

### Task 4: Investor placeholders
**Files:** `app/investors/page.tsx`, `content/investors.ts`, `components/sections/InvestorMedia.tsx`, `.env.example`, tests.
- [ ] `InvestorMedia.tsx` renders three things behind the existing gate:
  - **Pitch deck:** a "View the deck" link to a signed URL minted server-side from `INVESTOR_DECK_PATH`
    in `INVESTOR_DECK_BUCKET` (private, same pattern as Coffey / `/listen`); renders nothing if unset.
  - **Pitch flyer:** a written section built from the v6 vision content already in `content/investors.ts`
    (reuse `SECTIONS`; add a flyer-styled summary block, no new claims).
  - **Screen recording:** a YouTube-unlisted embed from `INVESTOR_VIDEO_ID`; renders nothing until set.
    Use a privacy-friendly embed (`youtube-nocookie.com`), title it, lazy-load.
- [ ] Keep `noindex`, `robots.ts` disallow, and absence from the sitemap. The gate and password are
      unchanged. Add the three env names to `.env.example` with comments (Henry sets values).
- [ ] Tests: the media block renders nothing for each of deck/video when its env is unset, and renders
      the link/iframe when set (mock env); the page is still gated and noindex; no `\u2014`.

### PR checklist
- [ ] `npm test && npm run build` green. No em dashes. Brand tokens only, no gradients.
- [ ] PR body: list the env Henry sets (`INVESTOR_VIDEO_ID`, `INVESTOR_DECK_PATH`,
      `INVESTOR_DECK_BUCKET`, the Coffey paths) and where each is used. If you ran the dev server,
      attach screenshots of /artists (with the graph) and the investor media block.
