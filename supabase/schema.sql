-- Lyrical — enquiries table.
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to run more than once: every statement is idempotent.

create extension if not exists pgcrypto;

create table if not exists public.enquiries (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  name             text not null,
  email            text not null,
  role             text not null,
  company          text,
  catalogue_size   text,
  target_languages text[],
  message          text,
  source           text,
  unlocked_audio   boolean not null default false,
  user_agent       text,
  referrer         text
);

-- Newest enquiries first is the only query we actually run.
create index if not exists enquiries_created_at_idx
  on public.enquiries (created_at desc);

-- ── Triage, for the /leads page ────────────────────────────────────────────────
-- Added as separate statements with `if not exists` so this file stays runnable against a
-- table created before the leads page existed.
alter table public.enquiries add column if not exists handled boolean not null default false;
alter table public.enquiries add column if not exists handled_at timestamptz;

-- The leads page's default view is "not yet handled, newest first".
create index if not exists enquiries_handled_idx
  on public.enquiries (handled, created_at desc);

-- RLS on, with NO anon policy at all.
-- Every read and write goes through the Next.js server using the service role key, which
-- bypasses RLS. Anonymous clients can therefore neither read nor write this table
-- directly, even though the Supabase URL is discoverable. That is also what stops the
-- /leads data being reachable without going through the password.
alter table public.enquiries enable row level security;

-- Deliberately NOT unique on email: the same person may legitimately enquire twice.

-- ── Private audio for /listen ─────────────────────────────────────────────────
-- Recordings shared privately for evaluation. They were briefly in `public/`, which was
-- wrong twice: they vanished from production the first time a deploy ran from anywhere
-- other than the machine holding them, and while they were there anyone could fetch
-- /audio/listen/original.mp3 without the password. The page was gated; the files were not.
--
-- `public => false`, and NO storage policy is created, so nothing can read this bucket
-- except the server using the service role key. The /listen page mints a short-lived signed
-- URL per object, and only after the password check has passed.
insert into storage.buckets (id, name, public)
values ('listen', 'listen', false)
on conflict (id) do update set public = false;

-- ══ The song portal ═══════════════════════════════════════════════════════════
-- Everything below is for signed-in customers submitting their own recordings, and it works
-- on the OPPOSITE security model to the enquiries table above.
--
-- `enquiries` has RLS on with no policy at all: nothing reaches it except the server holding
-- the service role key. That is right for a table only staff ever read.
--
-- These tables are read and written by the customer who owns the row, from the browser, using
-- their own session. So they need real policies, and every one of them is scoped to
-- `auth.uid()`. A missing policy here is not a locked door, it is a customer reading another
-- label's unreleased masters. Add policies deliberately; never add one with `using (true)`.

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  name        text,
  company     text,
  role        text
);

alter table public.profiles enable row level security;

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
  for select using (auth.uid() = id);

drop policy if exists profiles_self_upsert on public.profiles;
create policy profiles_self_upsert on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- One submitted song.
--
-- `status` starts at 'submitted' and NOTHING processes until a human moves it on. That single
-- gate does two jobs at once: it stops us spending compute on submissions from people who may
-- not hold the rights, and it stops an open, free portal being an open, free bill.
--
-- `approved_at` is also when the delivery clock starts, on Henry's instruction, because a
-- submission at 6pm on a Friday would otherwise burn a promise while nobody is looking.
create table if not exists public.song_jobs (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  title             text not null,
  primary_artist    text not null,
  source_language   text not null,
  target_language   text not null,
  notes             text,
  status            text not null default 'submitted',
  -- The timestamp, not a boolean. "They agreed" is worth less than "they agreed at 14:02 on
  -- this date", and this is the field an agreement is eventually argued from.
  rights_warranted_at timestamptz not null default now(),
  approved_at       timestamptz,
  delivered_at      timestamptz,
  -- Staff only. See the column grant further down, which is what actually enforces that.
  internal_notes    text
);

create index if not exists song_jobs_user_idx on public.song_jobs (user_id, created_at desc);
create index if not exists song_jobs_status_idx on public.song_jobs (status, created_at desc);

alter table public.song_jobs enable row level security;

drop policy if exists song_jobs_own_select on public.song_jobs;
create policy song_jobs_own_select on public.song_jobs
  for select using (auth.uid() = user_id);

drop policy if exists song_jobs_own_insert on public.song_jobs;
create policy song_jobs_own_insert on public.song_jobs
  for insert with check (auth.uid() = user_id);

-- Deliberately NO customer update or delete policy. A submitted job is a record of what
-- somebody asserted and when. Staff move it through using the service role key, which
-- bypasses RLS entirely, exactly as /queue already does.

-- ── internal_notes is staff only, and RLS is NOT what makes it so ─────────────
--
-- Corrected 2026-08-11. This file used to claim the select policy above "lists columns rather
-- than granting the whole row". It does not, and no Postgres RLS policy can: a policy decides
-- WHICH ROWS are visible, never which columns. `song_jobs_own_select` hands the owner the
-- entire row, so a signed in customer could read our internal notes about their own job
-- straight off the REST API with `?select=internal_notes`. Nothing in the app did that, which
-- is exactly why it went unnoticed.
--
-- Column-level privileges are the real control, and they are checked independently of RLS.
-- Applied to both roles: `anon` because the anon key is public and discoverable, and
-- `authenticated` because that is the role a customer's own session runs as.
--
-- ⚠️ THE OBVIOUS VERSION OF THIS DOES NOTHING, SILENTLY. Writing
--
--     revoke select (internal_notes) on public.song_jobs from anon, authenticated;
--
-- runs without error and changes nothing at all, because Postgres cannot subtract a single
-- column from a TABLE-level grant: the table grant keeps covering every column, including the
-- one just named. It was run against production first and `information_schema.column_privileges`
-- still showed SELECT for both roles, which is the only reason it was caught.
--
-- The shape that works is to drop the table-level SELECT and re-grant the columns we do want.
-- Verified on production 2026-08-11: anon and authenticated hold 12 selectable columns and
-- internal_notes is not among them, while service_role still holds all 13.
--
-- ⚠️ A consequence worth keeping in mind: no customer-facing query may `select *` on song_jobs,
-- because PostgREST returns a permission error rather than quietly dropping the column.
-- `app/studio/page.tsx` names its columns for that reason. Keep it that way. And a new column
-- added to this table will NOT be readable by customers until it is added to the grant below,
-- which is the safe direction for that mistake to fail in.
revoke select on public.song_jobs from anon, authenticated;

grant select (
  id, created_at, user_id, title, primary_artist,
  source_language, target_language, notes, status,
  rights_warranted_at, approved_at, delivered_at
) on public.song_jobs to anon, authenticated;

create table if not exists public.song_job_assets (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  job_id       uuid not null references public.song_jobs (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  kind         text not null,
  artist_name  text,
  path         text not null,
  filename     text not null,
  bytes        bigint not null
);

-- Which part of the song this voice sings: "Verse 2", "Chorus", "Ad-libs". Added 2026-08-26.
-- A track with several singers needs more than a name to reassemble, and this is the label the
-- person mixing reads to know whose voice goes where. Nullable, and safe to add: song_job_assets
-- has a plain table-level SELECT grant, not the column-level grant song_jobs carries, so a new
-- column is visible without rewriting anything.
alter table public.song_job_assets add column if not exists part text;

create index if not exists song_job_assets_job_idx on public.song_job_assets (job_id);

alter table public.song_job_assets enable row level security;

drop policy if exists song_job_assets_own_select on public.song_job_assets;
create policy song_job_assets_own_select on public.song_job_assets
  for select using (auth.uid() = user_id);

drop policy if exists song_job_assets_own_insert on public.song_job_assets;
create policy song_job_assets_own_insert on public.song_job_assets
  for insert with check (auth.uid() = user_id);

-- ── Submission storage ────────────────────────────────────────────────────────
-- Private. A WAV is 40 to 70MB and Vercel caps a request body at 4.5MB, so uploads go from
-- the BROWSER STRAIGHT TO STORAGE and never pass through the Next.js server. That is not a
-- preference, it is the only shape that works, and it is why this bucket needs real policies
-- where the `listen` bucket needs none.
--
-- Every object lives under the uploader's own user id: `{user_id}/{job_id}/{file}`. The
-- policies below enforce that by comparing the first path segment to auth.uid(), so a signed
-- in customer cannot write into, or read out of, anybody else's folder.
insert into storage.buckets (id, name, public)
values ('submissions', 'submissions', false)
on conflict (id) do update set public = false;

drop policy if exists submissions_own_insert on storage.objects;
create policy submissions_own_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'submissions'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists submissions_own_select on storage.objects;
create policy submissions_own_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'submissions'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ══ Voice models ══════════════════════════════════════════════════════════════
-- Added 2026-08-12.
--
-- Clean vocals an artist supplies so we can train their voice model. This is deliberately NOT
-- hung off `song_jobs`, because a voice model belongs to an ARTIST and is reused by every song
-- that artist ever sends. Attaching it to a song means the second song either re-uploads the
-- same half gigabyte or inherits it by a rule nobody can see.
--
-- ⚠️ THE FREE PLAN CEILING SHAPES THIS TABLE. Supabase free has a fixed 50MB per-file upload
-- limit and 1GB of total storage. Henry chose to stay on it on 2026-08-12 with those numbers in
-- front of him. Consequences that are baked in here rather than hoped for:
--
--   A training set is MANY rows, not one. Thirty minutes cannot be one object under 50MB.
--   `seconds` is stored per sample so the total can be summed without opening any audio.
--   Mono and FLAC are pushed hard in the UI, because 1GB is about seven artists at mono FLAC
--   and about three at stereo WAV.

create table if not exists public.voice_models (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  artist_name   text not null,
  status        text not null default 'collecting',
  notes         text,
  -- The timestamp, not a boolean, and SEPARATE from the per-song rights warranty.
  --
  -- Handing over thirty minutes of an artist's isolated vocal so a model can be built from it
  -- is a materially bigger permission than sending one song to be re-sung, and the site already
  -- promises "voice models are built only from catalogs we have permission to use". This column
  -- is the record that backs that sentence, and it is the field an agreement is argued from.
  consent_warranted_at timestamptz not null default now(),
  approved_at   timestamptz,
  -- Staff only. See the column grant below, which is what actually enforces that.
  internal_notes text
);

create index if not exists voice_models_user_idx on public.voice_models (user_id, created_at desc);
create index if not exists voice_models_status_idx on public.voice_models (status, created_at desc);

alter table public.voice_models enable row level security;

drop policy if exists voice_models_own_select on public.voice_models;
create policy voice_models_own_select on public.voice_models
  for select using (auth.uid() = user_id);

drop policy if exists voice_models_own_insert on public.voice_models;
create policy voice_models_own_insert on public.voice_models
  for insert with check (auth.uid() = user_id);

-- No customer update or delete, exactly as with song_jobs: this row records what somebody
-- asserted about an artist's permission and when. Staff move it with the service role key.

-- Same correction as song_jobs.internal_notes: a policy decides which ROWS are visible, never
-- which columns, so the column grant is the real control. Drop the table-level SELECT and
-- re-grant everything except internal_notes.
revoke select on public.voice_models from anon, authenticated;

grant select (
  id, created_at, user_id, artist_name, status, notes,
  consent_warranted_at, approved_at
) on public.voice_models to anon, authenticated;

create table if not exists public.voice_samples (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  voice_id    uuid not null references public.voice_models (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  path        text not null,
  filename    text not null,
  bytes       bigint not null,
  -- Read from the file's own header in the BROWSER before upload, so the running total on the
  -- page and the total in the queue agree without anything server-side opening audio.
  seconds     numeric
);

create index if not exists voice_samples_voice_idx on public.voice_samples (voice_id);

alter table public.voice_samples enable row level security;

drop policy if exists voice_samples_own_select on public.voice_samples;
create policy voice_samples_own_select on public.voice_samples
  for select using (auth.uid() = user_id);

drop policy if exists voice_samples_own_insert on public.voice_samples;
create policy voice_samples_own_insert on public.voice_samples
  for insert with check (auth.uid() = user_id);

-- ── Training storage ──────────────────────────────────────────────────────────
-- Private, and separate from `submissions` so that a retention decision about training data
-- never has to be untangled from a decision about masters. They are different promises.
--
-- Same path shape, `{user_id}/{voice_id}/{file}`, because the policies below compare the first
-- segment to auth.uid(). That is what stops one customer reading another's vocals.
insert into storage.buckets (id, name, public)
values ('voice-training', 'voice-training', false)
on conflict (id) do update set public = false;

drop policy if exists voice_training_own_insert on storage.objects;
create policy voice_training_own_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'voice-training'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists voice_training_own_select on storage.objects;
create policy voice_training_own_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'voice-training'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ══ Lyrics ════════════════════════════════════════════════════════════════════
-- Added 2026-08-12.
--
-- The lyric sheet lives in a COLUMN, not in the storage bucket. A full sheet is two to five
-- kilobytes, so a thousand songs is about five megabytes, against a 500MB database and a 1GB
-- file allowance that is already the binding constraint for audio. Text in a column also comes
-- back with the row and stays searchable and editable.
alter table public.song_jobs add column if not exists lyrics text;

-- ⚠️ THE SELECT GRANT HAS TO BE REWRITTEN, NOT EXTENDED.
--
-- `song_jobs` has column-level SELECT privileges rather than a table-level grant, so that
-- internal_notes stays staff-only. The consequence, written down further up this file when that
-- was set up: **a new column is NOT readable by customers until it is added to the grant.** Add
-- a column and forget this, and the studio silently shows nothing for it, or PostgREST refuses
-- the whole query. This block is that grant, restated with `lyrics` in it.
revoke select on public.song_jobs from anon, authenticated;

grant select (
  id, created_at, user_id, title, primary_artist,
  source_language, target_language, notes, status,
  rights_warranted_at, approved_at, delivered_at,
  lyrics
) on public.song_jobs to anon, authenticated;

-- ── Letting a customer fix their own lyrics, and NOTHING else ────────────────
--
-- Henry's decision, 2026-08-12: lyrics are editable until we accept the job. A typo in a lyric
-- sheet goes straight into the output, and until now a submitted job was frozen with no update
-- policy at all, so a wrong paste could only be fixed by us.
--
-- ⚠️ THIS NEEDS BOTH HALVES, AND THE POLICY ALONE IS THE DANGEROUS MISTAKE.
--
-- An RLS policy decides WHICH ROWS may be updated. It cannot decide which columns, exactly as
-- it could not for internal_notes. A `for update` policy on its own would therefore let a
-- signed in customer rewrite their own `status` to 'delivered', or move `approved_at`, or edit
-- `rights_warranted_at`, which is the field an agreement is argued from.
--
-- So the column grant is the real control and the policy is the row filter. Both, or neither.
revoke update on public.song_jobs from anon, authenticated;

grant update (lyrics) on public.song_jobs to authenticated;

drop policy if exists song_jobs_own_lyrics_update on public.song_jobs;
create policy song_jobs_own_lyrics_update on public.song_jobs
  for update to authenticated
  -- Their own row, and only while it is still waiting on us. Once accepted, the sheet is what
  -- the work was started from and it stops moving.
  using (auth.uid() = user_id and status = 'submitted')
  with check (auth.uid() = user_id and status = 'submitted');

-- ══ Song ↔ voice model ═════════════════════════════════════════════════════════
-- Added 2026-08-30.
--
-- A song can name which trained voice sings it. The voice belongs to an ARTIST and is reused by
-- every song for them, so this is a reference, not a copy: `voice_id` points at a row in
-- `voice_models`, nullable because a song can be sent before its voice is built.
alter table public.song_jobs
  add column if not exists voice_id uuid references public.voice_models (id);

-- ⚠️ THE SELECT GRANT HAS TO BE REWRITTEN, NOT EXTENDED. Same rule as `lyrics` above: a new
-- column is NOT readable by customers until it is added to the column grant, because song_jobs
-- holds column-level SELECT privileges so that internal_notes stays staff-only. This is that
-- grant, restated with `voice_id` in it.
revoke select on public.song_jobs from anon, authenticated;

grant select (
  id, created_at, user_id, title, primary_artist,
  source_language, target_language, notes, status,
  rights_warranted_at, approved_at, delivered_at,
  lyrics, voice_id
) on public.song_jobs to anon, authenticated;

-- ── A voice preference, when there is no trained voice ─────────────────────────
-- Added 2026-08-31.
--
-- A song must always name who sings it, but not everyone has a trained voice or a specific one
-- in mind, and lacking that data must never block a submission. So alongside `voice_id` (a
-- specific trained voice) a song can instead carry a preference: a general voice type, or
-- deferring the choice to us. One or the other, never both; null only on rows from before this.
--   'male' | 'female' | 'let_us_decide'
alter table public.song_jobs add column if not exists voice_preference text;

-- Same rule as every other song_jobs column: readable by customers only once it is in the grant.
revoke select on public.song_jobs from anon, authenticated;

grant select (
  id, created_at, user_id, title, primary_artist,
  source_language, target_language, notes, status,
  rights_warranted_at, approved_at, delivered_at,
  lyrics, voice_id, voice_preference
) on public.song_jobs to anon, authenticated;

-- ── The version of the terms each person agreed to ────────────────────────────
-- Added 2026-08-31.
--
-- The warranty and voice-consent wording (lib/terms.ts) is versioned, and the version in force
-- at the moment of agreement is stamped here. When counsel changes the wording, the constant is
-- bumped; old rows keep the version they actually agreed to, so what any given customer accepted
-- stays provable. Staff-only by construction: not added to the customer SELECT grant, so it is
-- readable through the service role and never through a customer's own session, which is the
-- right direction for a record they should not be able to alter or need to read.
alter table public.song_jobs add column if not exists rights_terms_version text;
alter table public.voice_models add column if not exists consent_terms_version text;

-- ── v2 two doors (2026-09-22) ────────────────────────────────────────────────
-- Applied to the live project on 2026-09-22 via the SQL editor, as three files in
-- supabase/migrations/. Repeated here so this file still builds a project from scratch.
-- Two tables this file never had (they were created in the dashboard) are declared first,
-- in the shape the live database has today.

create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  user_id                uuid not null references auth.users (id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text,
  tier                   text not null,
  status                 text not null,
  current_period_start   timestamptz,
  current_period_end     timestamptz
);
alter table public.subscriptions enable row level security;
drop policy if exists subscriptions_self_select on public.subscriptions;
create policy subscriptions_self_select on public.subscriptions for select using (auth.uid() = user_id);

create table if not exists public.song_job_deliveries (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  job_id     uuid not null references public.song_jobs (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null,
  path       text not null,
  filename   text not null,
  bytes      bigint not null
);
alter table public.song_job_deliveries enable row level security;
drop policy if exists song_job_deliveries_self_select on public.song_job_deliveries;
create policy song_job_deliveries_self_select on public.song_job_deliveries for select using (auth.uid() = user_id);

-- 001: plans and credits (v2 two doors). Apply via the Supabase SQL editor.
-- Spec: docs/superpowers/specs/2026-09-22-two-doors-v2-design.md section 3.

-- Plans: subscriptions carry 'fan' | 'superfan'. 'single' is not a subscription, it is a credit.
-- The old values stay tolerated by the check until the two test rows are migrated just below.
alter table public.subscriptions drop constraint if exists subscriptions_tier_check;
alter table public.subscriptions add constraint subscriptions_tier_check
  check (tier in ('fan','superfan','starter','creator','pro'));
update public.subscriptions set tier = 'superfan' where tier in ('pro','creator');
update public.subscriptions set tier = 'fan' where tier = 'starter';

-- One user, one subscription row: the Stripe webhook upserts on user_id.
create unique index if not exists subscriptions_user_id_key on public.subscriptions (user_id);

alter table public.profiles add column if not exists stripe_customer_id text unique;
alter table public.profiles add column if not exists licence_terms_version text;

-- Credits ledger. +1 for a Single purchase, -1 when a track consumes it, +1 refund or grant.
-- Only the service role writes here; customers may read their own rows.
create table if not exists public.song_credits (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  delta           integer not null,
  reason          text not null check (reason in ('purchase_single','consume','refund','grant')),
  job_id          uuid references public.song_jobs (id) on delete set null,
  stripe_event_id text unique
);
create index if not exists song_credits_user_idx on public.song_credits (user_id, created_at desc);
alter table public.song_credits enable row level security;
drop policy if exists song_credits_self_select on public.song_credits;
create policy song_credits_self_select on public.song_credits for select using (auth.uid() = user_id);

-- Every Stripe event id we have seen, so a redelivered webhook is a no-op.
create table if not exists public.stripe_events (
  id           text primary key,
  type         text not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz
);
alter table public.stripe_events enable row level security;

-- 002: feedback, re-rolls, licence version, delivery profile, purge stamp, watermark id.
-- Spec: docs/superpowers/specs/2026-09-22-two-doors-v2-design.md section 3.

-- One rating per job per customer. A thumbs-down must explain itself: 20 characters is the
-- floor the database enforces, the UI asks for much more.
create table if not exists public.job_feedback (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  job_id     uuid not null references public.song_jobs (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  rating     text not null check (rating in ('up','down')),
  note       text,
  tags       text[] not null default '{}',
  constraint job_feedback_down_needs_note
    check (rating <> 'down' or length(btrim(coalesce(note,''))) >= 20),
  unique (job_id, user_id)
);
create index if not exists job_feedback_created_idx on public.job_feedback (created_at desc);
alter table public.job_feedback enable row level security;
drop policy if exists job_feedback_self_select on public.job_feedback;
create policy job_feedback_self_select on public.job_feedback for select using (auth.uid() = user_id);
drop policy if exists job_feedback_self_insert on public.job_feedback;
create policy job_feedback_self_insert on public.job_feedback for insert with check (auth.uid() = user_id);
drop policy if exists job_feedback_self_update on public.job_feedback;
create policy job_feedback_self_update on public.job_feedback for update using (auth.uid() = user_id);

-- Re-rolls are child jobs of the original (parent_job_id always points at the original).
alter table public.song_jobs add column if not exists parent_job_id uuid references public.song_jobs (id) on delete set null;
alter table public.song_jobs add column if not exists reroll_index smallint not null default 0;
alter table public.song_jobs add column if not exists seed integer;
alter table public.song_jobs add column if not exists licence_terms_version text;
alter table public.song_jobs add column if not exists delivery_profile text not null default 'door2';
alter table public.song_jobs drop constraint if exists song_jobs_delivery_profile_check;
alter table public.song_jobs add constraint song_jobs_delivery_profile_check
  check (delivery_profile in ('door2','door1'));
create index if not exists song_jobs_parent_idx on public.song_jobs (parent_job_id);

-- song_jobs carries a COLUMN grant (see schema.sql). New customer-readable columns must be
-- added to it explicitly; seed and pipeline_error stay service-role only.
grant select (parent_job_id, reroll_index, licence_terms_version, delivery_profile)
  on public.song_jobs to anon, authenticated;

-- Set when the source stems are deleted from Storage after delivery (the render PC keeps a copy).
alter table public.song_job_assets add column if not exists purged_at timestamptz;
-- The 16-bit AudioSeal message embedded in a Door-2 delivery.
alter table public.song_job_deliveries add column if not exists watermark_id integer;

-- 003: render-worker heartbeat, upserted by the OptiPlex poller every loop.
-- The studio reads it to say whether renders are running. Anyone may read; only the
-- service role writes.
create table if not exists public.worker_heartbeat (
  worker   text primary key,
  seen_at  timestamptz not null default now(),
  version  text
);
alter table public.worker_heartbeat enable row level security;
drop policy if exists worker_heartbeat_read on public.worker_heartbeat;
create policy worker_heartbeat_read on public.worker_heartbeat for select using (true);

-- 006: Door-2 copyright check on submission.
--
-- Henry's stance (handover section H, 22 Sep): a fan cannot make a version of a commercial
-- recording they do not own. Before a Door-2 job is queued, the vocal and/or instrumental is
-- fingerprinted against a commercial-recognition provider (ACRCloud primary, AudD fallback; see
-- `docs/bots/v3/copyright-research.md` for the provider decision). The result is stored here so
-- every submission's check is auditable, whichever way it came out.
--
-- Staff only, on purpose: a customer does not need to see the raw provider payload (title,
-- artists, confidence) for a job that passed, and for a job that was refused the submission
-- never became a row at all, so the ONLY jobs this column exists on are ones that passed. It is
-- kept staff-side so `/admin` (Bot 4) can show the check that let a job through, without ever
-- exposing provider internals to the customer who submitted it.
--
-- Shape: { provider, match: bool, title, artists, isrc, confidence, checked_at,
--          part: 'vocal' | 'instrumental' | 'both' }
-- `match` is always false here, because a true match is refused before the insert this column
-- lives on (see `lib/copyright.ts` `isCommercialMatch` and the submit-time check in
-- `app/studio/self-serve-actions.ts`). It is still stored, not just a boolean, so a later change
-- of mind about the threshold can be checked against what was actually seen at submit time.
alter table public.song_jobs add column if not exists copyright_check jsonb;

-- Same rule as every other song_jobs column (see the note above `grant select` earlier in this
-- file): this is a column-level grant, so a new column is NOT readable by anon/authenticated
-- until it is explicitly added to that grant. Deliberately not added here. No revoke/re-grant
-- dance is needed because there is nothing to revoke: the column did not exist under the old
-- grant, so it was never selectable in the first place.

-- 004b: the soft-delete marker for /studio/account (v3, Bot 2). See the migration file for why
-- this is 004b and not 004: Bot 1 owns 004 (profiles.product_emails, rating_reminders,
-- welcomed_at) in the same v3 session, on disjoint columns of the same table.
alter table public.profiles add column if not exists retired_at timestamptz;

-- 004: email preferences on profiles, and a log of every email sent (see
-- supabase/migrations/004_email_prefs_and_log.sql for the standalone file).
alter table public.profiles add column if not exists welcomed_at timestamptz;
alter table public.profiles add column if not exists product_emails boolean not null default true;
alter table public.profiles add column if not exists rating_reminders boolean not null default true;

create table if not exists public.email_log (
  id         uuid primary key default gen_random_uuid(),
  sent_at    timestamptz not null default now(),
  user_id    uuid references auth.users (id) on delete set null,
  to_email   text not null,
  slug       text not null,          -- welcome | track-delivered | reroll-delivered | track-not-made | rating-reminder | eoi-received | enquiry-received | plan-confirmed
  job_id     uuid references public.song_jobs (id) on delete set null,
  provider_id text
);
create index if not exists email_log_user_idx on public.email_log (user_id, sent_at desc);
create index if not exists email_log_slug_idx on public.email_log (slug, sent_at desc);
alter table public.email_log enable row level security;   -- service role only, no policies

-- 005: crm tables (2026-09-22)

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

-- 007: Door 1, the staff-made artist line (see supabase/migrations/007_door1.sql).
--
-- THE CONTRACT with the render PC poller: docs/bots/door1/README.md. Written by the website
-- (Bot B), read by lyrical-studio (Bot C). Neither side changes it alone.
--
-- Defensive and idempotent: safe to run more than once. Applied BY HAND in the Supabase SQL
-- editor, on Henry's say-so, then verified with `npx tsx scripts/verify-schema.ts`.
--
-- Staff only, on purpose: NONE of these columns is added to the customer `song_jobs` column
-- grant (see schema.sql). A customer session that asks for one gets a permission error, which
-- is the safe direction for that mistake to fail in.

-- The signed artist (CRM enquiry) this job is for.
alter table public.song_jobs add column if not exists door1_enquiry_id uuid
  references public.enquiries (id) on delete set null;
-- The Qobuz link, when the source is not an uploaded full mix. Exactly one of the two.
alter table public.song_jobs add column if not exists door1_source_url text;
-- Render knobs: {"vocal_denoise": bool, "restore_mode": "cascade" or "zeroshot"}.
alter table public.song_jobs add column if not exists door1_settings jsonb not null default '{}'::jsonb;
-- When the artist expects it. A date, not a promise clock.
alter table public.song_jobs add column if not exists door1_due_on date;
-- Stamped by the poller's daily purge, 7 days after a Door 1 delivery. The 24-bit WAV masters
-- stay on the OptiPlex.
alter table public.song_job_deliveries add column if not exists purged_at timestamptz;

-- Private bucket, no public read, service role only. No storage policy is created, so nothing
-- but the server (a 60 second signed URL minted after requireAdmin) can read it.
insert into storage.buckets (id, name, public) values ('door1', 'door1', false)
  on conflict (id) do nothing;
