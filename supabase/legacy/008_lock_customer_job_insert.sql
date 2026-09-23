-- 008: customers may only create a MANUAL submission, never a render job.
--
-- Found in the 24 Sep audit: the insert policy only checked `auth.uid() = user_id` and there was
-- no column-level INSERT grant, so a signed-in customer could POST a song_jobs row straight to
-- PostgREST with pipeline_state='queued', route='auto' or delivery_profile='door1'. The render PC
-- poller claims every queued row, so that skipped the plan, credit and quota checks.
--
-- Fix, two layers:
-- 1. Column grant: customers may write only the fields the manual form sends
--    (app/studio/submit-actions.ts). Every pipeline column (pipeline_state, route,
--    delivery_profile, quota_consumed_at, approved_at, door1_*, parent_job_id, seed ...) falls to
--    its default. Self-serve and Door 1 jobs are inserted by the server with the service role,
--    which is unaffected.
-- 2. Policy: the row must be the caller's own and must be status 'submitted'.
--
-- Idempotent. Applied in the Supabase SQL editor, then verified with the queries at the bottom.

revoke insert on public.song_jobs from anon, authenticated;
-- Row security never applies to TRUNCATE, so no browser role should hold it.
revoke truncate on public.song_jobs from anon, authenticated;
grant insert (
  id, user_id, title, primary_artist, source_language, target_language, notes, lyrics,
  voice_id, voice_preference, rights_terms_version, status
) on public.song_jobs to authenticated;

drop policy if exists song_jobs_own_insert on public.song_jobs;
create policy song_jobs_own_insert on public.song_jobs
  for insert to authenticated
  with check (auth.uid() = user_id and status = 'submitted');

-- Verify (expect: false, false, false, true):
-- select has_column_privilege('authenticated','public.song_jobs','pipeline_state','INSERT'),
--        has_column_privilege('authenticated','public.song_jobs','route','INSERT'),
--        has_column_privilege('authenticated','public.song_jobs','delivery_profile','INSERT'),
--        has_column_privilege('authenticated','public.song_jobs','title','INSERT');
