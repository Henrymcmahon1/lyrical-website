# The job contract

How the website (this repo) and the render worker (the poller on the render PC, repo
`lyrical-studio`) hand song jobs to each other. The database defines and enforces all of it.
This page explains it; it does not define it.

| What | Where |
|---|---|
| Schema, source of truth | `supabase/migrations/` (Supabase CLI), applied in filename order |
| The contract itself | `supabase/migrations/20260924090000_job_contract.sql` |
| Proof | `supabase/tests/*.sql` (pgTAP): `npx supabase test db` |
| TypeScript types | `lib/db/database.types.ts` (generated) |
| Python types | `supabase/generated/contract.py` (generated, copied into the worker repo) |
| Regenerate | `npx supabase start`, then `npm run db:types` |
| Drift check | `npm test` (with the local stack up) or `npm run db:types:check` |
| History only | `supabase/legacy/` (the old hand-kept `schema.sql` and `001`..`008`) |

Never edit a generated file. Change a migration, `npx supabase db reset`, `npm run db:types`.

## 1. The four job columns on `song_jobs`

| Column | Type | Audience | Values |
|---|---|---|---|
| `status` | text + CHECK `song_jobs_status_check` | customer + staff | `submitted`, `approved`, `in_progress`, `delivered`, `rejected` |
| `pipeline_state` | enum `song_job_pipeline_state`, nullable | worker + staff | `queued`, `claimed`, `rendered_local`, `delivered`, `failed`, `blocked`; null = never handed to the worker |
| `route` | enum `song_job_route`, not null, default `auto` | who owns the job | `auto` (Door 2 self-serve, and every manual-funnel job so far), `door1` (staff-made) |
| `delivery_profile` | enum `song_job_delivery_profile`, not null, default `door2` | how it is delivered | `door2` (watermarked MP3), `door1` (24-bit FLAC stems) |

`status` stays text because RLS policies compare it to text literals. Its vocabulary is still a
Postgres enum, `song_job_status`, so both generated files carry it as a union / `Literal`; a pgTAP
test proves the CHECK accepts exactly the enum's labels. The generated row types show `status`
as a plain string: validate it against `song_job_status` / `PublicSongJobStatus`.

A value outside these sets is refused by the database (`22P02` for an enum, `23514` for the
CHECK). Nothing is mapped silently.

`route` is `NOT NULL` in production (every row is `auto` today, manual-funnel jobs included).
The Phase 1 brief described null as "manual funnel"; the database never allowed it, and this
migration does not change that.

## 2. Pipeline state transitions

A trigger (`song_jobs_pipeline_state_transition`, BEFORE UPDATE OF `pipeline_state`) enforces
this for every role, the service role included. Writing the same state again is always allowed.
Nothing may set it back to null. Inserts are not checked (a new job starts `queued` or null).

| To | Allowed from |
|---|---|
| `queued` | any, including null (staff re-queue is deliberate, even a stuck `claimed` job) |
| `claimed` | `queued` only |
| `rendered_local` | `claimed` |
| `delivered` | `claimed`, `rendered_local` |
| `failed` | `queued`, `claimed`, `rendered_local` |
| `blocked` | `queued`, `claimed` |

A refused move raises `23514` with the message
`song_jobs <id>: pipeline_state <from> -> <to> is not an allowed transition`. Through PostgREST
that is an HTTP 400: the writer must fail loud, never retry blindly.

Consequence worth knowing: `delivered` and `blocked` are final unless staff re-queue. A late
`fail_job` on a job that already reached `delivered` is refused, so a delivered job can never be
flipped to failed and refunded by accident.

## 3. Who writes what

### `pipeline_state` writers (checked against both repos, 24 Sep 2026)

| Writer | Where | Move |
|---|---|---|
| Self-serve submit | website `app/studio/self-serve-actions.ts` | INSERT `queued`, `route='auto'` |
| Re-roll | website `app/studio/reroll-actions.ts` | INSERT child `queued` |
| Door 1 create | website `app/admin/door1/actions.ts` via `lib/door1-schema.ts` | INSERT `queued`, `route='door1'`, `delivery_profile='door1'` |
| Manual submit (customer) | website `app/studio/submit-actions.ts` | INSERT, `pipeline_state` null (column not granted) |
| Admin re-queue | website `app/admin/actions.ts` `requeueJob` | any (job is `status='rejected'`) -> `queued` |
| Claim | worker `client.claim` (Bot C moves it to `claim_song_job`) | `queued` -> `claimed` |
| Copyright block | worker `client.block_copyright` | `claimed` -> `blocked` |
| Fail | worker `client.fail_job` / `fail_and_reject` | `claimed` or `rendered_local` -> `failed` (a retry writes `failed` again: allowed) |
| Non-terminal step | worker `client.set_pipeline_state` (no caller today) | `claimed` -> `rendered_local` |
| Deliver | worker `client.mark_delivered` | `claimed` or `rendered_local` -> `delivered` |
| Staff script | worker `scripts/requeue_job.py` | any -> `queued` |

### Other columns

| Column | Written by |
|---|---|
| `status` | customer insert (`submitted` only, RLS); staff moves (`lib/job-transitions.ts`); worker claim (`in_progress`), fail and block (`rejected`), deliver (`delivered`) |
| `route`, `delivery_profile` | website at insert only |
| `pipeline_error` | worker (`fail_job`, `block_copyright`, `set_pipeline_state`); cleared by `requeue_job.py` |
| `quota_consumed_at` | website at submit; cleared by the worker on fail/block and by `requeue_job.py` |
| `delivered_at` | worker `mark_delivered`; staff move to `delivered` |
| `contract_version` | database default (1). The worker refuses a version it does not know, loudly |
| `claimed_by`, `claimed_at` | `claim_song_job` only |

Customers (`anon`, `authenticated`) can read only the customer columns and can insert only the
manual-form columns; none of `pipeline_state`, `pipeline_error`, `route`, `contract_version`,
`claimed_by`, `claimed_at` is readable or writable by them (pgTAP `song_jobs_grants.test.sql`).

## 4. The claim functions (service role only)

```sql
public.next_queued_song_job() returns setof song_jobs
  -- the oldest queued job (by created_at), FOR UPDATE SKIP LOCKED, LIMIT 1
public.claim_song_job(p_job_id uuid, p_worker text) returns boolean
  -- one UPDATE: pipeline_state='claimed', status='in_progress', claimed_by, claimed_at=now()
  -- WHERE id = p_job_id AND pipeline_state = 'queued'; true iff a row changed
```

Both are `security definer` with `search_path = public`; `EXECUTE` is revoked from `public`,
`anon` and `authenticated` and granted to `service_role`. A second claim of the same job returns
false (a lost race, not an error). An empty `p_worker` raises `22023`.
Through PostgREST: `POST /rest/v1/rpc/claim_song_job` with `{"p_job_id": ..., "p_worker": ...}`.

## 5. Storage buckets

All private (`public = false`), no size or type limit at the bucket level.

| Bucket | Object path | Written by | Customer access |
|---|---|---|---|
| `submissions` | `{user_id}/{job_id}/{kind}-{n}.{ext}` | website (customer upload, Door 1 staff upload) | insert + select own folder |
| `deliveries` | `{user_id}/{job_id}/{file}` (Door 2 MP3) | worker | select own folder |
| `door1` | `{job_id}/{kind}.flac` (vocal, instrumental, mix) | worker | none (service role only) |
| `voice-training` | `{user_id}/{voice_id}/sample-{n}.{ext}` | website (customer upload) | insert + select own folder |
| `listen` | private listening audio (see `lib/listen-audio.ts`) | uploaded by hand | none (signed URLs from the server) |

"Own folder" means the first path segment equals `auth.uid()`; that is what the storage policies
compare, so the path shape is load bearing.

## 6. Outside the migrations

The `song-job-emails` Database Webhook (AFTER UPDATE on `song_jobs`, POST to the studio's
`/api/hooks/song-job` with an `x-hook-secret` header) exists in production but not in
`supabase/migrations`, because its definition carries the secret and this repo is public. It is
managed in the Supabase dashboard. The local stack therefore sends no job emails.
