-- The job contract between the website and the render worker. Human page: docs/CONTRACT.md.
--
-- Additive plus constraints only: every value the current code writes is still accepted, the
-- columns keep their names, and PostgREST keeps sending and receiving the same strings. Safe to
-- run twice: every step checks before it acts.
--
-- Production values checked before writing this (24 Sep 2026, read-only):
--   status: delivered 6, in_progress 2, submitted 17
--   pipeline_state: delivered 5, failed 2, null 18
--   route: auto 25
--   delivery_profile: door2 25

-- ---------------------------------------------------------------------------------------
-- 1. The vocabulary, as enum types. The generated TypeScript and Python read these.
--    song_job_status is the vocabulary only: the status column stays text with a CHECK,
--    because RLS policies compare it to text literals. A pgTAP test keeps the two in step.
-- ---------------------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'song_job_status') then
    create type public.song_job_status as enum
      ('submitted', 'approved', 'in_progress', 'delivered', 'rejected');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'song_job_pipeline_state') then
    create type public.song_job_pipeline_state as enum
      ('queued', 'claimed', 'rendered_local', 'delivered', 'failed', 'blocked');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'song_job_route') then
    create type public.song_job_route as enum ('auto', 'door1');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'song_job_delivery_profile') then
    create type public.song_job_delivery_profile as enum ('door2', 'door1');
  end if;
end $$;

comment on type public.song_job_status is
  'Customer and staff lifecycle of a song job. Vocabulary for the song_jobs.status CHECK.';
comment on type public.song_job_pipeline_state is
  'Render worker lifecycle. Null on song_jobs means never handed to the worker. Transitions: docs/CONTRACT.md.';
comment on type public.song_job_route is
  'Who owns the job: auto (Door 2 self-serve) or door1 (staff-made).';
comment on type public.song_job_delivery_profile is
  'How a job is delivered: door2 (watermarked MP3) or door1 (24-bit FLAC stems).';

-- ---------------------------------------------------------------------------------------
-- 2. Convert the three worker columns from text to their enums. Any value outside the
--    vocabulary makes the cast fail and the whole migration roll back: loud, never mapped.
-- ---------------------------------------------------------------------------------------
do $$
begin
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'song_jobs' and column_name = 'pipeline_state') = 'text' then
    alter table public.song_jobs
      alter column pipeline_state type public.song_job_pipeline_state
      using pipeline_state::public.song_job_pipeline_state;
  end if;

  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'song_jobs' and column_name = 'route') = 'text' then
    alter table public.song_jobs alter column route drop default;
    alter table public.song_jobs
      alter column route type public.song_job_route using route::public.song_job_route;
    alter table public.song_jobs alter column route set default 'auto';
  end if;

  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'song_jobs' and column_name = 'delivery_profile') = 'text' then
    -- The old text CHECK is replaced by the enum itself (and would not compile against it).
    alter table public.song_jobs drop constraint if exists song_jobs_delivery_profile_check;
    alter table public.song_jobs alter column delivery_profile drop default;
    alter table public.song_jobs
      alter column delivery_profile type public.song_job_delivery_profile
      using delivery_profile::public.song_job_delivery_profile;
    alter table public.song_jobs alter column delivery_profile set default 'door2';
  end if;
end $$;

-- ---------------------------------------------------------------------------------------
-- 3. status: text, constrained to the vocabulary.
-- ---------------------------------------------------------------------------------------
alter table public.song_jobs drop constraint if exists song_jobs_status_check;
alter table public.song_jobs add constraint song_jobs_status_check
  check (status in ('submitted', 'approved', 'in_progress', 'delivered', 'rejected'));

-- ---------------------------------------------------------------------------------------
-- 4. New columns. Staff and worker only: none is added to the customer column grants, so
--    anon and authenticated can neither read nor write them.
-- ---------------------------------------------------------------------------------------
alter table public.song_jobs add column if not exists contract_version int not null default 1;
alter table public.song_jobs add column if not exists claimed_by text;
alter table public.song_jobs add column if not exists claimed_at timestamptz;

comment on column public.song_jobs.contract_version is
  'Version of docs/CONTRACT.md this row was written under. The worker refuses a version it does not know.';
comment on column public.song_jobs.claimed_by is 'Worker that claimed the job (set by claim_song_job).';
comment on column public.song_jobs.claimed_at is 'When the job was claimed (set by claim_song_job).';

-- ---------------------------------------------------------------------------------------
-- 5. The transition guard. Fires for every role, the service role included. Writing the
--    same state again is always allowed. Nothing may move a job back to null.
--
--    To               Allowed from
--    queued           any (staff re-queue is deliberate, including a stuck claimed job)
--    claimed          queued
--    rendered_local   claimed
--    delivered        claimed, rendered_local
--    failed           queued, claimed, rendered_local
--    blocked          queued, claimed
-- ---------------------------------------------------------------------------------------
create or replace function public.song_jobs_guard_pipeline_state()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  ok boolean;
begin
  if new.pipeline_state is not distinct from old.pipeline_state then
    return new;
  end if;

  ok := case new.pipeline_state
    when 'queued' then true
    when 'claimed' then old.pipeline_state = 'queued'
    when 'rendered_local' then old.pipeline_state = 'claimed'
    when 'delivered' then old.pipeline_state in ('claimed', 'rendered_local')
    when 'failed' then old.pipeline_state in ('queued', 'claimed', 'rendered_local')
    when 'blocked' then old.pipeline_state in ('queued', 'claimed')
    else false
  end;

  if ok is not true then
    raise exception 'song_jobs %: pipeline_state % -> % is not an allowed transition',
        old.id, coalesce(old.pipeline_state::text, 'null'), coalesce(new.pipeline_state::text, 'null')
      using errcode = '23514',
            hint = 'The allowed moves are in docs/CONTRACT.md (lyrical-website).';
  end if;
  return new;
end
$$;

revoke all on function public.song_jobs_guard_pipeline_state() from public, anon, authenticated;

drop trigger if exists song_jobs_pipeline_state_transition on public.song_jobs;
create trigger song_jobs_pipeline_state_transition
  before update of pipeline_state on public.song_jobs
  for each row execute function public.song_jobs_guard_pipeline_state();

-- ---------------------------------------------------------------------------------------
-- 6. The claim RPCs. Service role only.
-- ---------------------------------------------------------------------------------------
create or replace function public.claim_song_job(p_job_id uuid, p_worker text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed int;
begin
  if p_worker is null or btrim(p_worker) = '' then
    raise exception 'claim_song_job: p_worker is required' using errcode = '22023';
  end if;

  update public.song_jobs
     set pipeline_state = 'claimed',
         status = 'in_progress',
         claimed_by = p_worker,
         claimed_at = now()
   where id = p_job_id
     and pipeline_state = 'queued';
  get diagnostics changed = row_count;
  return changed > 0;
end
$$;

comment on function public.claim_song_job(uuid, text) is
  'Take a queued job for a worker. True iff this call claimed it; false if it was not queued (lost race, already claimed, or no such job).';

create or replace function public.next_queued_song_job()
returns setof public.song_jobs
language sql
volatile
security definer
set search_path = public
as $$
  select *
    from public.song_jobs
   where pipeline_state = 'queued'
   order by created_at
   limit 1
   for update skip locked;
$$;

comment on function public.next_queued_song_job() is
  'The oldest queued job, skipping rows another transaction has locked. Claim it with claim_song_job.';

revoke all on function public.claim_song_job(uuid, text) from public, anon, authenticated;
revoke all on function public.next_queued_song_job() from public, anon, authenticated;
grant execute on function public.claim_song_job(uuid, text) to service_role;
grant execute on function public.next_queued_song_job() to service_role;

-- PostgREST caches the schema: make it see the new types and functions now.
notify pgrst, 'reload schema';
