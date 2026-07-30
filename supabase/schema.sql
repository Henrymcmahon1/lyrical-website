-- Lyrical — enquiries table.
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).

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

-- RLS on, with NO anon policy at all.
-- Every write goes through the Next.js route handler using the service role key, which
-- bypasses RLS. Anonymous clients can therefore neither read nor write this table
-- directly, even though the Supabase URL is discoverable.
alter table public.enquiries enable row level security;

-- Deliberately NOT unique on email: the same person may legitimately enquire twice.
