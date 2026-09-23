# Phase 1: the job contract, 24 Sep 2026

Plan page: https://claude.ai/artifact/7i6SZVZUWR5E82fEtq8cXW (Phase 1). Audits and research that
shaped it are summarised there. This folder holds the three bot briefs.

**Goal:** one source of truth for how the website and the render PC hand jobs to each other. Today
the contract is copied by hand in both repos, three columns the site depends on are defined nowhere
in this repo, and the job states live only in prose. After Phase 1 the database defines and enforces
the contract, and both sides use types generated from it.

| Order | Bot | File | Repo / base | Branch |
|---|---|---|---|---|
| 1 | A Contract (DB) | `BOT-A-contract.md` | lyrical-website / `develop` | `feat/p1-contract` |
| 2 | B Website adopts | `BOT-B-web-adopts.md` | lyrical-website / `develop` after A | `feat/p1-web-types` |
| 2 | C Poller adopts | `BOT-C-poller-adopts.md` | lyrical-pipeline / `main` after A | `feat/p1-poller-contract` |

Every bot: its own worktree under `C:\Users\User\CascadeProjects\wt\`, commits on its branch, does
NOT push (a lyrical-website branch push builds a preview on the live lyricalglobal Vercel project).
The orchestrator reviews the branch diff and merges. No bot touches production Supabase, deploys, or
touches the OptiPlex. They work against the LOCAL Supabase stack (Docker) only. There is no hosted
test project (decided 24 Sep: the free tier allows 2 projects, both in use; revisit when there is
a team).

## The contract (decided; bots implement it, do not redesign it)

### Job states
Two columns, two audiences, both enforced by the database:

| Column | Audience | Values |
|---|---|---|
| `status` | customer + staff | `submitted`, `approved`, `in_progress`, `delivered`, `rejected` |
| `pipeline_state` | render worker + staff | `queued`, `claimed`, `rendered_local`, `delivered`, `failed`, `blocked`, or null (never handed to the worker) |
| `route` | who owns the job | `auto` (Door 2 self-serve), `door1`, or null (manual funnel) |
| `delivery_profile` | how it is delivered | `door2` (watermarked MP3), `door1` (24-bit FLAC stems) |

- `pipeline_state`, `route`, `delivery_profile` become Postgres ENUM types so the generated TS and
  Python types are real unions. `status` stays text with a CHECK constraint (policies reference it).
- Before converting, query production for the distinct values actually present. Any value not in the
  table above stops the migration: report it, do not map it silently.

### Pipeline state transitions (trigger, BEFORE UPDATE OF pipeline_state)
Enforced for every role, service role included. Derived from every writer in both repos
(website: self-serve, re-roll, Door 1 create, admin re-queue; poller: claim, block_copyright,
fail_job, set_pipeline_state, mark_delivered; `scripts/requeue_job.py`):

| To | Allowed from |
|---|---|
| `queued` | any (staff re-queue is deliberate, including a stuck `claimed` job) |
| `claimed` | `queued` only |
| `rendered_local` | `claimed` |
| `delivered` | `claimed`, `rendered_local` |
| `failed` | `queued`, `claimed`, `rendered_local` |
| `blocked` | `queued`, `claimed` |

Bot A must grep both repos again and confirm no writer is missed; a missed writer means a live job
the trigger rejects. Unchanged values (same state written again) are always allowed.

### New columns
- `contract_version int not null default 1`: the worker refuses a version it does not know (loud).
- `claimed_by text`, `claimed_at timestamptz`: set by the claim function.

### Claim function (RPC, service role only)
`public.claim_song_job(p_job_id uuid, p_worker text) returns boolean`: in one statement, sets
`pipeline_state='claimed'`, `status='in_progress'`, `claimed_by`, `claimed_at` where
`id = p_job_id and pipeline_state = 'queued'`; true iff a row changed. Also
`public.next_queued_song_job() returns setof song_jobs` ordered by `created_at` with
`FOR UPDATE SKIP LOCKED LIMIT 1`. `security definer`, `set search_path = public`, execute revoked from
`public, anon, authenticated`, granted to `service_role`.

### Source of truth and generated code
- Supabase CLI owns the schema: `supabase/config.toml`, `supabase/migrations/<timestamp>_*.sql`.
- Baseline: `supabase db pull` from production into `<ts>_remote_baseline.sql`. The old `001`..`008`
  files and `schema.sql` move to `supabase/legacy/` with a README saying they are history only.
- Generated, committed, never edited by hand:
  - `lib/db/database.types.ts` (`supabase gen types typescript --local`)
  - `supabase/generated/contract.py`: Python enums for the four job columns + TypedDicts for
    `song_jobs`, `song_job_assets`, `song_job_deliveries`. Use the CLI's Python generator if it
    exists in the installed version; otherwise a small script in `scripts/` that reads the
    generated TS and emits the Python. Bot C copies this file into the pipeline repo (Phase 2 makes
    it one file in one repo).
- `npm run db:types` regenerates both. A test fails if the committed files drift from the
  migrations (run against the local stack).
- `docs/CONTRACT.md`: the human page. States, transitions, who writes which column, buckets and
  their object paths, the claim function. It replaces every scattered description.

### Rollout (orchestrator, after review)
1. Apply A's migrations to a fresh local stack, run both test suites against it.
2. Apply the contract migration to production (additive + constraints only, current code keeps
   working: same string values, same flows). Verify.
3. Merge and deploy B (website) and C (poller to the OptiPlex), then a proof run.

## Rules every bot carries
Never `main` of lyrical-website or lyricalglobal.com, never deploy, never production Supabase. No em
dashes anywhere. No secrets in files. Fail loud. TDD. Website: `npm test && npm run build` green
(copy `.env.local` placeholders from the main checkout, never commit it). Pipeline:
`.venv\Scripts\python -m pytest tests` green with `PYTHONUTF8=1`. Final report = PR description with
exact test counts and anything the orchestrator must do.
