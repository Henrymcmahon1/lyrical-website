# Bot 4: /admin CRM over Supabase, folding /queue in

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or
> superpowers:executing-plans. Tests first, task by task. Steps use `- [ ]`.

**Paste this to start the session:**
> Read `docs/HANDOVER-v3-2026-09-22.md`, `docs/superpowers/specs/2026-09-22-two-doors-v2-design.md`,
> then `docs/bots/v3/BOT-4-admin-crm.md` in your worktree of
> `C:\Users\User\CascadeProjects\lyrical-website`. Work on branch `feat/v3-admin-crm` off `develop`.
> Never touch `main`. Tests first. `npm test && npm run build` green before the PR. No em dashes.

**Goal:** One internal console at `/admin`, gated by the existing admin session, built on the data we
already have in Supabase, with light CRM tables for notes, tasks and issues. Fold the current
`/queue` tabs into `/admin` so there is a single console. Reads existing tables; adds `crm_*` tables.

## Current state (verified 22 Sep)
- `app/admin/**` does NOT exist. The console today is `app/queue/**`: `page.tsx` (gate + 4 tabs),
  `actions.ts` (login/logout + job/enquiry transitions), `SongsTab.tsx`, `VoicesTab.tsx`,
  `EnquiriesTab.tsx`, `FeedbackTab.tsx`, `export/route.ts` (CSV), `audio/route.ts` (signed audio).
  `/leads` already redirects to `/queue`.
- Admin gate: `lib/admin-session.ts` `hasAdminSession()`, `lib/admin-auth.ts` (`ADMIN_COOKIE`,
  `ADMIN_MAX_AGE_MS` 12h, `checkAdminPassword` reads `ADMIN_PASSWORD`, signs with `GATE_SECRET`,
  prefix `admin:`). Login/logout are server actions in `app/queue/actions.ts`, rate-limited.
- Tables to read (columns confirmed by the map): `song_jobs` (incl. `internal_notes` staff-only, and
  the live-only `route`/`pipeline_state`/`pipeline_error`/`quota_consumed_at`), `song_job_deliveries`
  (`watermark_id`), `song_job_assets` (`purged_at`), `subscriptions`, `song_credits`, `stripe_events`,
  `job_feedback` (rating, note, tags), `voice_models`, `voice_samples`, `enquiries` (with
  `source='artist_eoi'` for EOIs), `worker_heartbeat`. `profiles` (plan, sign-in method,
  `licence_terms_version`). Auth users via admin.
- Admin reads use the **service-role client** (`lib/supabase-admin.ts`); the gate is the password,
  not RLS. `pipeline_error` is staff-only and readable here.

## Files this bot owns
`app/admin/**` (new), `lib/crm.ts` (typed reads/writes for `crm_*`), `lib/admin-metrics.ts`
(aggregations), `supabase/migrations/005_crm.sql`, its tests. It MOVES the four tab components and the
export/audio routes from `app/queue/` into `app/admin/` (or imports them), and turns `app/queue` into
a redirect to `app/admin` (mirror how `/leads` redirects). Keep `lib/admin-auth.ts` /
`lib/admin-session.ts` as the gate (do not duplicate). Do NOT edit customer studio pages or `Nav.tsx`.

## Migration 005 (Henry applies; write the file and append to schema.sql)
```sql
create table if not exists public.crm_notes (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  author     text,                         -- staff label, free text (no staff auth yet)
  user_id    uuid references auth.users (id) on delete cascade,
  enquiry_id uuid references public.enquiries (id) on delete cascade,
  body       text not null,
  constraint crm_notes_target check (user_id is not null or enquiry_id is not null)
);
create index if not exists crm_notes_user_idx on public.crm_notes (user_id, created_at desc);
create index if not exists crm_notes_enquiry_idx on public.crm_notes (enquiry_id, created_at desc);

create table if not exists public.crm_tasks (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id    uuid references auth.users (id) on delete set null,
  enquiry_id uuid references public.enquiries (id) on delete set null,
  title      text not null,
  due_on     date,
  owner      text,
  done_at    timestamptz
);
create index if not exists crm_tasks_open_idx on public.crm_tasks (done_at, due_on);

create table if not exists public.crm_issues (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  job_id     uuid references public.song_jobs (id) on delete set null,
  user_id    uuid references auth.users (id) on delete set null,
  kind       text not null,                -- failed_job | refund | complaint | other
  status     text not null default 'open' check (status in ('open','ack','resolved')),
  detail     text,
  resolved_at timestamptz
);
create index if not exists crm_issues_status_idx on public.crm_issues (status, created_at desc);

-- Relationship status on enquiries (EOIs and enquiries share this table).
alter table public.enquiries add column if not exists rel_status text
  check (rel_status in ('new','contacted','in_talks','signed','closed'));
alter table public.enquiries add column if not exists rel_owner text;

alter table public.crm_notes  enable row level security;  -- service role only, no policies
alter table public.crm_tasks  enable row level security;
alter table public.crm_issues enable row level security;
```

## Constraints
- Admin-only. Never expose a public surface. All reads/writes behind `hasAdminSession()`.
- No em dashes. `crm_*` writes go through `lib/crm.ts`, validated with zod, service-role only.
- Reuse `components/studio/ui.tsx` primitives or the queue's existing styles so it reads as one tool.
- Do not break the CSV export or signed-audio routes when you move them; keep their URLs working
  (either move and update links, or keep `/queue/export` as a thin re-export).

---

### Task 1: Branch + migration 005
- [ ] Branch `feat/v3-admin-crm` off `develop`. `npm install`. Write `005_crm.sql` and append to
      `supabase/schema.sql`. Henry applies it; the bot does not.

### Task 2: `/admin` skeleton + gate + fold /queue in
**Files:** `app/admin/page.tsx`, `app/admin/layout.tsx` (optional), move the tab components + routes, `app/queue/page.tsx` → redirect.
- [ ] `/admin` uses the same admin gate and login form as `/queue` does today (import from
      `lib/admin-session.ts`; reuse the login action, moving it to `app/admin/actions.ts`). A tab bar:
      People, Money, Work, Voice, Relationships, Issues. Move Songs/Voices/Enquiries/Feedback content
      under the relevant tabs. Turn `/queue` into a redirect to `/admin` (like `/leads`). Keep
      `?tab=` and `?show=all`.
- [ ] Tests: unauthenticated `/admin` shows the login and no data; `/queue` redirects to `/admin`;
      the CSV export and audio routes still resolve.

### Task 3: People tab
- [ ] Every account: auth user + `profiles` (plan from `subscriptions`/credits via `getBillingSummary`
      per user or a batched read, credits, tracks this period, sign-in method from identities, last
      seen, licence/rights acceptances). Inline `crm_notes` and a "next action" (`crm_tasks`) keyed by
      user. Add-note and add-task actions through `lib/crm.ts`.
- [ ] Tests: renders a row per account with plan + tracks; add-note writes a `crm_notes` row for that
      user only; add-task writes `crm_tasks`.

### Task 4: Money, Work, Voice tabs
- [ ] **Money:** subscriptions, `song_credits` ledger, `stripe_events`, refunds. Read-only.
- [ ] **Work:** every job with `status`, `pipeline_state`, stage timing (created/approved/delivered),
      failures with `pipeline_error` (staff-only, shown here), re-roll families
      (`parent_job_id`/`reroll_index`), deliveries + `watermark_id`, `purged_at`. A **re-queue button**
      that writes `pipeline_state='queued'` (service role) and lets the poller do the rest. Guard it
      (confirm), and only for jobs in a failed/rejected state.
- [ ] **Voice:** `job_feedback` rows (note + tags), filterable by tag/rating, CSV (reuse the export
      route).
- [ ] Tests: work tab shows a failed job's `pipeline_error` and nests re-rolls; re-queue sets
      `pipeline_state='queued'` on the right job and nothing else; money tab totals the ledger.

### Task 5: Relationships + Issues tabs
- [ ] **Relationships:** enquiries + artist EOIs (`enquiries` with `source`) with `rel_status`
      (new/contacted/in_talks/signed/closed), `rel_owner`, notes, next action. Status + owner are
      editable (writes `enquiries.rel_status`/`rel_owner`).
- [ ] **Issues:** `crm_issues` (failed jobs not acknowledged, refunds, complaints) with status
      open/ack/resolved; heartbeat age (from `worker_heartbeat`); the Supabase storage figure (a
      manual number or a note, since the API for bucket size is limited: show what we can and label
      it). A "log issue" action and a status change.
- [ ] Tests: relationship status update writes the enquiry; issue create/resolve writes `crm_issues`;
      heartbeat age computed from `seen_at`.

### PR checklist
- [ ] `npm test && npm run build` green. No em dashes. Every read/write behind the admin gate.
- [ ] PR body: the migration 005 SQL for Henry; confirm `/queue` redirect and that CSV/audio still
      work; note that the storage figure is best-effort.
