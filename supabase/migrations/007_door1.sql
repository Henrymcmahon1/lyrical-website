-- 007: Door 1, the staff-made artist line (admin console at /admin/door1).
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
