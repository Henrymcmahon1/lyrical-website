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
