# Door 1 admin console: bot briefs, 24 Sep 2026

Handover: `docs/HANDOVER-door1-admin-2026-09-24.md`. Plan: `docs/DOOR1-ADMIN-PLAN.md`. Spec and
decision log: `docs/superpowers/specs/2026-09-22-two-doors-v2-design.md` (24 Sep entry).

Each brief stands alone. Every bot works in its OWN git worktree under
`C:\Users\User\CascadeProjects\wt\`, on its OWN branch, and commits there WITHOUT pushing (a lyrical-website branch push builds a preview on
the live `lyrical-website` Vercel project). The orchestrator reviews each branch diff as the PR and
merges locally. No bot deploys, pushes anything, applies a migration, or touches the OptiPlex.

| Order | Bot | File | Repo / base | Branch |
|---|---|---|---|---|
| 1 | A Admin auth | `BOT-A-admin-auth.md` | lyrical-website / `develop` | `feat/door1-admin-auth` |
| 1 | C Poller door1 path | `BOT-C-poller-door1.md` | lyrical-studio / `main` | `feat/door1-poller` |
| 2 | B Door 1 web console | `BOT-B-door1-console.md` | lyrical-website / `develop` after A merges | `feat/door1-console` |

A and C have no shared code, so they run together. B needs A's `requireAdmin()` and starts once A is
merged into `develop`. B and C both code against the contract below; neither changes it alone.

## Henry's calls (24 Sep, locked)
| Topic | Decision |
|---|---|
| Admin sign-in | Supabase identity, existing 6-digit email code, allowlist `henry@lyricalglobal.com` |
| 2FA | NOT this round. Build so TOTP (Supabase MFA, AAL2) switches on later by env flag, no rework |
| `ADMIN_PASSWORD` | Kept as a BREAK-GLASS only, OFF unless `ADMIN_BREAK_GLASS=on` |
| Route | `/admin/door1` inside `/admin` (one admin area, one sign-in), never under `/studio` |
| Job form | Artist (CRM enquiry link), song title, source + target language, voice model, lyrics, internal notes, due date, render knobs (`vocal_denoise`, `restore_mode`) |
| Source audio | Upload a full mix on the form OR paste a Qobuz link (one required) |
| Delivery format | 24-bit FLAC on the web (lossless). 24-bit WAV masters stay on the OptiPlex |
| Storage | Private `door1` bucket, signed-URL download, purge 7 days after delivery |

Why FLAC: Supabase free tier caps each object at 50 MB; a 4-minute 24-bit stereo WAV is ~64 MB.

## THE CONTRACT (B writes the migration, C reads it)

### Migration `supabase/migrations/007_door1.sql` (owned by Bot B; Henry applies it)
Defensive (`if not exists`), and appended to `supabase/schema.sql`.
```sql
alter table public.song_jobs add column if not exists door1_enquiry_id uuid
  references public.enquiries (id) on delete set null;       -- the signed artist (CRM)
alter table public.song_jobs add column if not exists door1_source_url text; -- Qobuz link
alter table public.song_jobs add column if not exists door1_settings jsonb not null default '{}'::jsonb;
alter table public.song_jobs add column if not exists door1_due_on date;
alter table public.song_job_deliveries add column if not exists purged_at timestamptz;
-- private bucket, no public read, service role only
insert into storage.buckets (id, name, public) values ('door1', 'door1', false)
  on conflict (id) do nothing;
```
None of these columns is added to the customer `song_jobs` column grant. They are staff-only.

### A Door 1 row (written by Bot B's server action, service role)
| Column | Value |
|---|---|
| `user_id` | the signed-in admin's auth uid (info@) |
| `delivery_profile` | `'door1'` |
| `route` | `'door1'` (NOT `'auto'`: the auto purge and Door 2 logic must never catch it) |
| `status` / `approved_at` | `'approved'` / now |
| `pipeline_state` | `'queued'` |
| `quota_consumed_at` | `null` (no credits, no plan quota, ever) |
| `title`, `primary_artist`, `source_language`, `target_language` | from the form (language CODES, as Door 2) |
| `lyrics`, `notes` | from the form (lyrics optional for Door 1) |
| `pipeline_voice_model` | the render-PC voice model name, or null for zero-shot |
| `door1_enquiry_id`, `door1_due_on` | from the form |
| `door1_source_url` | the Qobuz link, or null |
| `door1_settings` | `{"vocal_denoise": bool, "restore_mode": "cascade" or "zeroshot"}` |
| rights/licence terms versions | null (Door 1 is under the artist's signed agreement, not the personal-use licence) |

Exactly one source: EITHER `door1_source_url` OR one `song_job_assets` row with `kind='full_mix'`,
`path` in the private `submissions` bucket at `{user_id}/{job_id}/{filename}` (Door 2's upload
pattern, direct browser upload via a signed upload URL, 50 MB cap, fail loud above it).

### What the poller does with it (Bot C)
- Claims `route='door1'` rows too (today it claims only `route='auto'`).
- Maps to `SongRequest(input_mode='known', qobuz_url=... or source_path=<downloaded full mix>,
  voice_model=pipeline_voice_model or '', restore_mode=door1_settings.restore_mode or
  ('cascade' if voice else 'zeroshot'), advanced.vocal_denoise=door1_settings.vocal_denoise,
  lyrics_text=lyrics or '', run_mode='auto')`.
- On completion: `export_door1_stems` (24-bit WAV, kept locally), then encode each to 24-bit FLAC,
  NO watermark, NO ID3 licence tag, upload to bucket `door1` at `{job_id}/{kind}.flac`, insert
  `song_job_deliveries` rows `kind in ('vocal','instrumental','mix')`, `watermark_id=null`, then
  `mark_delivered`.
- Failure: `pipeline_state='failed'`, `pipeline_error`, `status='rejected'`. NO credit refund path
  (none was consumed); must not crash on a door1 row.
- Purge: daily, delete `door1` objects for deliveries older than 7 days, stamp `purged_at`. Also
  delete the uploaded source asset from `submissions` on delivery.

### Side effects that must NOT fire for a door1 row (Bot B checks these)
- The `song-job` webhook emails (`/api/hooks/song-job`): no customer email on door1 delivered/rejected.
- The customer `/studio` library for info@: door1 rows never listed (`delivery_profile <> 'door1'`).
- Rating reminders, credits, entitlement, watermark, `/listen`.

## Migrations (Henry-gated)
007 is applied by the orchestrator driving the Supabase SQL editor in Henry's signed-in Chrome, on
his say-so, then verified over PostgREST. Bots only write the file.

## Rules every bot carries
- Never `main` of lyrical-website or lyricalglobal.com. Never deploy anything. Never the
  `lyrical-website` Vercel project.
- No em dashes anywhere (code, comments, copy, commits). Use a colon, comma or new sentence.
- No secrets in files. Henry sets env in Vercel. Never `select *` on a customer path.
- Never pass a FUNCTION prop from a server component to a client component (it 500s).
- Fail loud, no silent fallbacks.
- TDD. Website: `npm test && npm run build` green before the PR (build needs a gitignored
  `.env.local` with placeholder `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`; copy
  it from the main checkout, never commit it). Pipeline: `.venv\Scripts\python -m pytest tests` green.
- Final report (the PR description): what changed, tests run with counts, anything Henry must do. End with the attribution line.
