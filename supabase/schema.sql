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
