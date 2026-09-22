# Bot 5: Door 2 copyright detection at upload + takedown policy

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or
> superpowers:executing-plans. Phase 1 is research (no code). Phase 2 is TDD. Steps use `- [ ]`.

**Paste this to start the session:**
> Read `docs/HANDOVER-v3-2026-09-22.md` (esp. section H),
> `docs/superpowers/specs/2026-09-22-two-doors-v2-design.md`, then
> `docs/bots/v3/BOT-5-copyright.md` in your worktree of
> `C:\Users\User\CascadeProjects\lyrical-website`. Work on branch `feat/v3-copyright` off `develop`.
> Never touch `main`. Phase 1 is a research doc; do NOT build the upload check until Henry has an
> ACRCloud trial. Tests first in phase 2. `npm test && npm run build` green before the PR. No em dashes.

**Goal:** After upload and before a Door-2 job is queued, fingerprint the vocal and instrumental and
refuse the submission when a commercial recording is matched, so a fan cannot make a version of a
recording they do not own. Store the result on `song_jobs.copyright_check`. Write the takedown and
repeat-offender policy as a page and link it from the terms. Provider: ACRCloud (trial, then metered),
AudD as fallback ($5 / 1,000 requests).

## Phase 1: research (do this immediately, no key needed)
**Deliverable:** `docs/bots/v3/copyright-research.md` with:
- [ ] ACRCloud: the identification product, the real per-request price (from their console once Henry
      has the trial; until then, record the public trial terms and where the price is), latency,
      request shape (endpoint, audio format, sample length, auth), and what a "match" looks like
      (fields: title, artists, ISRC, score/confidence).
- [ ] AudD: `/recognize` shape, the $5 / 1,000 price, confidence semantics, differences vs ACRCloud
      (source: the audd-vs-acrcloud article in the handover).
- [ ] A recommendation: which provider primary, which fallback, the confidence threshold that counts
      as a commercial match, whether to check vocal, instrumental or both, and how much audio to send
      (cost vs accuracy). Include the expected cost per submission at our volume (10 to 50 / day).
- [ ] The failure and edge cases: a fan's own recording (should pass), a cover they performed (grey
      area, state the policy), instrumentals that match a known backing track, provider timeout /
      outage (fail-open or fail-closed: recommend and justify), and the false-positive path (how a
      wrongly-blocked user appeals).
- [ ] Send Henry this doc as a short artifact/summary and get his provider + threshold decision before
      phase 2 code that hits the network. The migration and policy page can be written before the key.

## Phase 2: the upload check (build once the ACRCloud trial exists)

### Current state (verified 22 Sep)
- No `song_jobs.copyright_check` column anywhere. New (migration 006).
- Door-2 submit: `app/studio/self-serve-actions.ts` `submitSelfServeJob(raw)` verifies session +
  Turnstile, validates `SelfServeJobSchema`, requires kinds `instrumental` + `vocal`, checks
  `pathBelongsTo(asset.path, user.id, jobId)`, runs the entitlement gate, then inserts `song_jobs`
  (`status:'approved', route:'auto', pipeline_state:'queued', quota_consumed_at: now`) and then the
  `song_job_assets` rows. **The copyright check goes between validated assets and the
  `pipeline_state:'queued'` insert.** Re-rolls (`app/studio/reroll-actions.ts`) reuse the parent's
  audio and carry no assets: they inherit the parent's `copyright_check` and are NOT re-checked.
- Uploads go browser -> Storage directly (bucket `submissions`, path
  `{user}/{job}/{kind}-{index}{ext}`); the server trusts `pathBelongsTo`. To fingerprint, the server
  (or a Modal function) downloads the object with the service role, sends a clip to the provider.
- `lib/terms.ts`: `LICENCE_TERMS_*` (point 1 already: personal, non-commercial). `lib/supabase-admin.ts`
  `supabaseAdmin()`. No policy page exists under `app/` (only `app/privacy`, `app/about`).

### Files this bot owns
`lib/copyright.ts` (provider client + match decision, pure where possible), `app/api/copyright/**`
(if a route/Modal proxy is needed), the copyright block inside `app/studio/self-serve-actions.ts`
(insert-time check only; coordinate: this is a shared file, keep the diff to the added check),
`supabase/migrations/006_copyright.sql`, `app/copyright-policy/page.tsx`, the terms link to it,
`docs/bots/v3/copyright-research.md`, and its tests. Env names in `.env.example`
(`ACRCLOUD_HOST`, `ACRCLOUD_ACCESS_KEY`, `ACRCLOUD_SECRET`, `AUDD_API_TOKEN`); Henry sets values.

### Migration 006 (Henry applies; write and append to schema.sql)
```sql
alter table public.song_jobs add column if not exists copyright_check jsonb;
-- shape: { provider, match: bool, title, artists, isrc, confidence, checked_at, part: 'vocal'|'instrumental'|'both' }
-- staff-only: NOT added to the customer SELECT grant.
```

### Tasks
- [ ] **006 migration** written + appended to schema.sql (Henry applies).
- [ ] **`lib/copyright.ts`:** a provider-agnostic `checkAudio({ bucket, path })` returning
      `{ provider, match, title?, artists?, isrc?, confidence, checkedAt, part }`, and a pure
      `isCommercialMatch(result, threshold)` that the tests pin. Fail loud on a missing key in prod;
      the network client is mocked in tests (never hit the provider in CI). Decide fail-open vs
      fail-closed per the phase-1 recommendation and encode it explicitly with a test.
- [ ] **Submit-time check:** in `submitSelfServeJob`, after assets are validated and before the
      `pipeline_state:'queued'` insert, run `checkAudio` on the part(s) the research chose. On a
      commercial match: refuse the submission with a clear message ("This sounds like a commercial
      recording you may not own. Door 2 is for your own songs, or songs you have the rights to."),
      do NOT insert the job, do NOT consume a credit, and log it against the account (a
      `crm_issues` row `kind='copyright_block'` if Bot 4's table exists, else a `console`/`email_log`
      note; keep the dependency soft). On pass, store `copyright_check` on the inserted job.
- [ ] **Tests:** match -> refused, no job row, no credit consumed, logged; pass -> job inserted with
      `copyright_check`; provider error -> the chosen fail policy; a re-roll is not re-checked.
- [ ] **Policy page:** `app/copyright-policy/page.tsx` (public): what we check and why, that Door 2 is
      for your own songs or songs you have the rights to, the takedown process (how a rights-holder
      reports, our response time, removal), and the repeat-offender rule (accounts blocked after N
      confirmed infractions). Link it from `lib/terms.ts` / the licence copy and the pricing + studio
      pages where the consequence is stated. Plain words, no em dashes.
- [ ] **Copy consequence:** make sure `/pricing` and the studio submit copy state plainly that a
      commercial recording will be refused (coordinate the exact strings with Bot 3's copy where they
      overlap; keep it truthful and short).

### PR checklist
- [ ] Phase 1 doc merged/sent first; Henry's provider + threshold decision recorded in it.
- [ ] `npm test && npm run build` green. No em dashes. No provider keys in any file. Network mocked in
      tests. Migration 006 SQL in the PR body for Henry; list the env he must set.
