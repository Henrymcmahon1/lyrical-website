-- Customer column grants on song_jobs, as they are in production (checked 24 Sep 2026).
-- A table-level REVOKE after the column GRANTs silently wipes them; this catches that.
-- Replaces the HIDDEN half of scripts/verify-schema.ts for the local stack.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(6);

create function pg_temp.cols(p_role text, p_priv text) returns text[]
language sql as $$
  select coalesce(array_agg(column_name::text order by column_name::text), array[]::text[])
    from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'song_jobs'
     and grantee = p_role and privilege_type = p_priv
$$;

select is(pg_temp.cols('authenticated', 'SELECT'),
  array['approved_at', 'created_at', 'delivered_at', 'delivery_profile', 'id', 'licence_terms_version',
        'lyrics', 'notes', 'parent_job_id', 'primary_artist', 'reroll_index', 'rights_warranted_at',
        'source_language', 'status', 'target_language', 'title', 'user_id', 'voice_id', 'voice_preference'],
  'authenticated reads exactly the customer columns (no pipeline, staff or claim column)');
select is(pg_temp.cols('anon', 'SELECT'), pg_temp.cols('authenticated', 'SELECT'),
  'anon has the same column SELECT list (RLS still returns no rows)');
select is(pg_temp.cols('authenticated', 'INSERT'),
  array['id', 'lyrics', 'notes', 'primary_artist', 'rights_terms_version', 'source_language', 'status',
        'target_language', 'title', 'user_id', 'voice_id', 'voice_preference'],
  'authenticated inserts exactly the manual-form columns (migration 008)');
select is(pg_temp.cols('authenticated', 'UPDATE'), array['lyrics'],
  'authenticated updates lyrics only');
select is(pg_temp.cols('anon', 'INSERT') || pg_temp.cols('anon', 'UPDATE'), array[]::text[],
  'anon cannot insert or update any column');
select ok(
  not has_table_privilege('authenticated', 'public.song_jobs', 'SELECT')
  and not has_table_privilege('authenticated', 'public.song_jobs', 'INSERT')
  and not has_table_privilege('authenticated', 'public.song_jobs', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.song_jobs', 'TRUNCATE')
  and not has_table_privilege('anon', 'public.song_jobs', 'SELECT')
  and not has_table_privilege('anon', 'public.song_jobs', 'INSERT'),
  'no table-wide SELECT, INSERT, UPDATE or TRUNCATE for anon or authenticated');

select * from finish();
rollback;
