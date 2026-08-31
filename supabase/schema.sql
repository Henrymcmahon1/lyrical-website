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
