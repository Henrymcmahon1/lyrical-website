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
