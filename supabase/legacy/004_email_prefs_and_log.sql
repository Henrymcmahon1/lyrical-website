-- 004: email preferences on profiles, and a log of every email sent.
-- Applied by Henry in the Supabase SQL editor. Not run by the bot, not run in CI.

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
