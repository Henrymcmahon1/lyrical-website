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
