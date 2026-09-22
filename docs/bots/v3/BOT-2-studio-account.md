# Bot 2: the studio account page + the turnaround promise across the studio

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or
> superpowers:executing-plans. Tests first, task by task. Steps use `- [ ]`.

**Paste this to start the session:**
> Read `docs/HANDOVER-v3-2026-09-22.md`, `docs/superpowers/specs/2026-09-22-two-doors-v2-design.md`,
> then `docs/bots/v3/BOT-2-studio-account.md` in your worktree of
> `C:\Users\User\CascadeProjects\lyrical-website`. Work on branch `feat/v3-studio-account` off
> `develop`. Never touch `main`. Execute the brief task by task, tests first. `npm test && npm run
> build` green before the PR. No em dashes.

**Goal:** A professional `/studio/account` page, and the fixed turnaround promise shown everywhere it
belongs. This bot is independent code; it depends only on copy that Bot 1's deck also uses.

## The turnaround promise (CONFIRMED 22 Sep)
One line for every plan: **"usually within 1 hour"**, with the exception line **"up to 3 hours at
busy times"**. Put a single source-of-truth constant in `lib/turnaround.ts` and use it in every place
below. Keep the heartbeat line ("Renders are paused, your song will start when they resume") as the
exception path where it already appears.

## Current state (verified 22 Sep)
- `app/studio/account/**` does NOT exist.
- The studio shell is `app/studio/layout.tsx` (rail + `components/studio/StudioNav.tsx` + signOut).
  Tabs come from `lib/studio-shell.ts`: `STUDIO_TABS` = Create (`/studio/new`), Songs (`/studio`),
  Voices (`/studio/voices`), Billing (`/studio/billing`). Add an Account entry (see Task 3).
- Studio UI kit: `components/studio/ui.tsx` (`PageHead`, `Panel`, `StatChip`, `Notice`, `button`,
  `eyebrow`, `link`). Reuse it; match the existing pages' look exactly.
- Entitlement: `lib/entitlement-db.ts` `getBillingSummary(userId)` → `{ entitlement, sub,
  usedThisPeriod, creditBalance }`, `getEntitlementFor(userId)`. `lib/plans.ts` `planById(id)`
  (display names: fan→"Plus", superfan→"Pro").
- Auth: `lib/supabase-server.ts` `currentUser()`, `supabaseServer()` (RLS); `lib/supabase-admin.ts`
  `supabaseAdmin()`.
- Terms: `lib/terms.ts` `RIGHTS_TERMS_VERSION`, `LICENCE_TERMS_VERSION` and the point arrays.
- Turnaround copy today: `lib/language-pairs.ts` `turnaroundNote()`, the "48 hours" claim in
  `components/sections/S10Start.tsx`, `app/llms.txt/route.ts`, `app/queue/actions.ts`, the post-submit
  `<Notice>` in `app/studio/page.tsx`, plan cards `components/sections/PlanCards.tsx`.
- Email preferences and `welcomed_at` live on `profiles` and are added by **Bot 1's migration 004**
  (`product_emails`, `rating_reminders`, `welcomed_at`). If 004 is not merged yet, this bot's account
  page reads those columns defensively (treat missing as true) and its email-preferences save is
  behind a small helper that no-ops if the column is absent, with a test. Note the dependency in the PR.

## Files this bot owns
`app/studio/account/**`, `lib/turnaround.ts`, `lib/account-data.ts` (download-my-data + soft-delete
helpers), and its tests. It EDITS (small, additive) `lib/studio-shell.ts` (add the Account tab),
`app/studio/page.tsx` (swap the in-progress + notice copy to the turnaround constant),
`components/sections/PlanCards.tsx` (turnaround line on each card), `components/SongSubmitForm.tsx`
or its notice (turnaround on the "That is with us" path). Do NOT edit `components/Nav.tsx` (Bot 3).

## Constraints
- Customer reads use the USER's client (RLS). The download-my-data export and soft-delete run with the
  service-role client after `currentUser()` is confirmed, and only ever touch the caller's own rows.
- Soft delete is SOFT: retire voice models (set a status), keep ledger rows (`song_credits`,
  `subscriptions`, deliveries). Never hard-delete. It sets a marker (propose `profiles.retired_at`;
  add to migration 004 space by coordinating with Bot 1, or a tiny migration 004b owned here) and
  signs the user out. If you add a column, write the migration file and note it for Henry; do not
  apply it.
- No em dashes. `song_jobs` column grant: never `select *` on a customer path.

---

### Task 1: `lib/turnaround.ts` (single source of truth)
- [ ] Failing test: exports `TURNAROUND_PROMISE = 'usually within 1 hour'`, `TURNAROUND_BUSY = 'up to
      3 hours at busy times'`, and a helper `turnaroundLine()` returning the combined sentence used in
      copy. No em dashes in either string.
- [ ] Implement. Commit.

### Task 2: turnaround promise everywhere
- [ ] Replace the turnaround/48-hour copy in: plan cards (each card shows the promise), the studio
      post-submit `<Notice>`, each in-progress job card (`components/JobStatus.tsx` context in
      `app/studio/page.tsx`), and the submit form's "That is with us" notice. Use `lib/turnaround.ts`.
      Leave the heartbeat "paused" line as is. Update `app/llms.txt` and `S10Start` only if they state
      a turnaround (keep them consistent; do not invent new claims).
- [ ] Tests: a render test asserting the promise string appears on a plan card and on the studio home
      in-progress state; a `copy` test that no page states a different turnaround number.

### Task 3: Account tab in the shell
- [ ] Add `{ id: 'account', label: 'Account', href: '/studio/account' }` to `STUDIO_TABS` (and the
      `StudioTabId` union), pick an icon in `components/studio/NavIcons.tsx`, keep `activeStudioTab`
      and `isStudioShellPath` correct. Test `lib/studio-shell.ts` updated.

### Task 4: `/studio/account` page
**Files:** `app/studio/account/page.tsx`, `app/studio/account/actions.ts`, `lib/account-data.ts`, tests.
- [ ] Server page (redirect to sign-in if no user). Sections, each a `Panel`, matching the studio look:
  - **You:** name, email, sign-in method (email code / Google, read from the user's identities), a
    quiet "signed in as".
  - **Plan:** plan name, tracks left / used this period, renews-on, credit balance, a link to
    `/studio/billing` (do not duplicate billing controls). Uses `getBillingSummary`.
  - **Turnaround:** the promise line from `lib/turnaround.ts`.
  - **Rights and licence:** the rights warranty version + date accepted and the personal-use licence
    version + date (from `profiles.licence_terms_version`, `song_jobs.rights_warranted_at`), plain
    language, with the point lists available behind a details/summary.
  - **Email preferences:** two toggles (product emails, rating reminders) saved by a server action to
    `profiles.product_emails` / `rating_reminders` (defensive if 004 unmerged). Transactional emails
    are always on; say so.
  - **Your data:** "Download my data" (a JSON of the user's jobs, feedback, credits, deliveries via
    `lib/account-data.ts`, streamed as a file download from a route or server action).
  - **Delete account:** a guarded soft delete (type-to-confirm), calling the soft-delete helper, then
    sign out. Copy states what is kept (ledger) and what is retired (voice models).
- [ ] Tests: render test for each panel's presence and the plan numbers; action tests for the email
      toggle save (writes the right columns, only for the caller), the data export shape (only the
      caller's rows), and the soft delete (retires voice models, keeps ledger, never hard-deletes).

### PR checklist
- [ ] `npm test && npm run build` green. No em dashes. No `select *` on `song_jobs`.
- [ ] PR body: note the dependency on Bot 1's migration 004 columns and any column this bot added
      (with the SQL for Henry). Screenshot the account page if the dev server is run.
