-- The job contract (docs/CONTRACT.md), enforced by the database and proven here.
-- Run with `npx supabase test db` against the LOCAL stack. Everything rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(94);

-- Fixture: one customer.
insert into auth.users (id, instance_id, aud, role, email)
values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'contract-test@example.test');

create temp table t_ids (name text primary key, id uuid not null default gen_random_uuid());
insert into t_ids (name) values ('status'), ('oldest'), ('delivered'), ('mine');
grant select on t_ids to anon, authenticated, service_role;

-- A song_jobs row in a given pipeline_state. Dynamic SQL with a literal, so the helper works
-- whatever the column type is.
create function pg_temp.mk_job(p_id uuid, p_state text, p_created timestamptz) returns void
language plpgsql as $$
begin
  execute format(
    'insert into public.song_jobs (id, user_id, title, primary_artist, source_language,
       target_language, pipeline_state, created_at)
     values (%L, %L, %L, %L, %L, %L, %L, %L)',
    p_id, '00000000-0000-0000-0000-00000000a001', 'contract test', 'artist', 'en', 'es',
    p_state, p_created);
end $$;

-- ---------------------------------------------------------------------------------------
-- 1. The vocabulary (8)
-- ---------------------------------------------------------------------------------------
select enum_has_labels('public', 'song_job_status',
  array['submitted', 'approved', 'in_progress', 'delivered', 'rejected'],
  'song_job_status has exactly the five customer states');
select enum_has_labels('public', 'song_job_pipeline_state',
  array['queued', 'claimed', 'rendered_local', 'delivered', 'failed', 'blocked'],
  'song_job_pipeline_state has exactly the six worker states');
select enum_has_labels('public', 'song_job_route', array['auto', 'door1'],
  'song_job_route is auto or door1');
select enum_has_labels('public', 'song_job_delivery_profile', array['door2', 'door1'],
  'song_job_delivery_profile is door2 or door1');
select col_type_is('public', 'song_jobs', 'status', 'text',
  'status stays text (policies compare it to text)');
select col_type_is('public', 'song_jobs', 'pipeline_state', 'public', 'song_job_pipeline_state',
  'pipeline_state is the enum');
select col_type_is('public', 'song_jobs', 'route', 'public', 'song_job_route',
  'route is the enum');
select col_type_is('public', 'song_jobs', 'delivery_profile', 'public', 'song_job_delivery_profile',
  'delivery_profile is the enum');

-- ---------------------------------------------------------------------------------------
-- 2. status CHECK agrees with the song_job_status vocabulary (6)
-- ---------------------------------------------------------------------------------------
select pg_temp.mk_job((select id from t_ids where name = 'status'), null, now());
select lives_ok(
  format('update public.song_jobs set status = %L where id = %L', s, (select id from t_ids where name = 'status')),
  format('status CHECK accepts %s', s))
from unnest(array['submitted', 'approved', 'in_progress', 'delivered', 'rejected']) as s;
select throws_ok(
  format('update public.song_jobs set status = %L where id = %L', 'done', (select id from t_ids where name = 'status')),
  '23514', null, 'status CHECK rejects a value outside the vocabulary');

-- ---------------------------------------------------------------------------------------
-- 3. New columns (4)
-- ---------------------------------------------------------------------------------------
select col_not_null('public', 'song_jobs', 'contract_version', 'contract_version is not null');
select col_default_is('public', 'song_jobs', 'contract_version', '1', 'contract_version defaults to 1');
select col_type_is('public', 'song_jobs', 'claimed_by', 'text', 'claimed_by is text');
select col_type_is('public', 'song_jobs', 'claimed_at', 'timestamp with time zone', 'claimed_at is timestamptz');

-- ---------------------------------------------------------------------------------------
-- 4. The transition matrix: every (from, to) pair, from the README table (49 + 2)
-- ---------------------------------------------------------------------------------------
create temp table t_matrix (
  n serial primary key, from_state text, to_state text, allowed boolean,
  job_id uuid not null default gen_random_uuid());
insert into t_matrix (from_state, to_state)
select f, t
from unnest(array[null, 'queued', 'claimed', 'rendered_local', 'delivered', 'failed', 'blocked']) with ordinality as a(f, i)
cross join unnest(array['queued', 'claimed', 'rendered_local', 'delivered', 'failed', 'blocked', null]) with ordinality as b(t, j)
order by i, j;

grant select on t_matrix to service_role;
-- Allowed = the contract table, plus "the same state written again".
update t_matrix set allowed =
  from_state is not distinct from to_state
  or to_state = 'queued'                                                      -- from any
  or (to_state = 'claimed'        and from_state = 'queued')
  or (to_state = 'rendered_local' and from_state = 'claimed')
  or (to_state = 'delivered'      and from_state in ('claimed', 'rendered_local'))
  or (to_state = 'failed'         and from_state in ('queued', 'claimed', 'rendered_local'))
  or (to_state = 'blocked'        and from_state in ('queued', 'claimed'));
-- The matrix rows sit in 2001 so they never outrank the claim fixtures below.
select pg_temp.mk_job(job_id, from_state, '2001-01-01'::timestamptz + n * interval '1 minute') from t_matrix;

select case when allowed then
  lives_ok(format('update public.song_jobs set pipeline_state = %L where id = %L', to_state, job_id),
           format('%s -> %s is allowed', coalesce(from_state, 'null'), coalesce(to_state, 'null')))
else
  throws_ok(format('update public.song_jobs set pipeline_state = %L where id = %L', to_state, job_id),
            '23514', null,
            format('%s -> %s is rejected', coalesce(from_state, 'null'), coalesce(to_state, 'null')))
end
from t_matrix order by n;

select is(
  (select count(*) from t_matrix m join public.song_jobs j on j.id = m.job_id
    where m.allowed and j.pipeline_state::text is distinct from m.to_state),
  0::bigint, 'every allowed move actually landed');
select is(
  (select count(*) from t_matrix m join public.song_jobs j on j.id = m.job_id
    where not m.allowed and j.pipeline_state::text is distinct from m.from_state),
  0::bigint, 'every rejected move left the row untouched');

-- The service role is bound by it too (1)
set local role service_role;
select throws_ok(
  format('update public.song_jobs set pipeline_state = %L where id = %L', 'claimed',
         (select job_id from t_matrix where from_state = 'delivered' and to_state = 'delivered')),
  '23514', null, 'service_role cannot move delivered -> claimed');
reset role;

-- ---------------------------------------------------------------------------------------
-- 5. Claim (8)
-- ---------------------------------------------------------------------------------------
select pg_temp.mk_job((select id from t_ids where name = 'oldest'), 'queued', '1990-01-01');
select pg_temp.mk_job((select id from t_ids where name = 'delivered'), 'delivered', '1990-01-02');

set local role service_role;
select is((select id from public.next_queued_song_job()), (select id from t_ids where name = 'oldest'),
  'next_queued_song_job returns the oldest queued job');
select is(public.claim_song_job((select id from t_ids where name = 'oldest'), 'test-worker'), true,
  'the first claim wins');
select is(
  (select pipeline_state::text || '/' || status || '/' || claimed_by || '/' || (claimed_at is not null)::text
     from public.song_jobs where id = (select id from t_ids where name = 'oldest')),
  'claimed/in_progress/test-worker/true',
  'a claim stamps pipeline_state, status, claimed_by and claimed_at together');
select is(public.claim_song_job((select id from t_ids where name = 'oldest'), 'other-worker'), false,
  'a second claim of the same job returns false');
select isnt((select id from public.next_queued_song_job()), (select id from t_ids where name = 'oldest'),
  'next_queued_song_job no longer offers the claimed job');
select is(public.claim_song_job((select id from t_ids where name = 'delivered'), 'test-worker'), false,
  'a job that is not queued cannot be claimed');
select is(public.claim_song_job(gen_random_uuid(), 'test-worker'), false,
  'claiming a job that does not exist returns false');
select throws_ok(
  format('select public.claim_song_job(%L, %L)', (select id from t_ids where name = 'delivered'), ' '),
  '22023', null, 'a claim without a worker name fails loud');
reset role;

-- ---------------------------------------------------------------------------------------
-- 6. Who may call the RPCs (10)
-- ---------------------------------------------------------------------------------------
select function_privs_are('public', 'claim_song_job', array['uuid', 'text'], 'anon', array[]::text[],
  'anon cannot execute claim_song_job');
select function_privs_are('public', 'claim_song_job', array['uuid', 'text'], 'authenticated', array[]::text[],
  'authenticated cannot execute claim_song_job');
select function_privs_are('public', 'next_queued_song_job', array[]::text[], 'anon', array[]::text[],
  'anon cannot execute next_queued_song_job');
select function_privs_are('public', 'next_queued_song_job', array[]::text[], 'authenticated', array[]::text[],
  'authenticated cannot execute next_queued_song_job');
select function_privs_are('public', 'claim_song_job', array['uuid', 'text'], 'service_role', array['EXECUTE'],
  'service_role can execute claim_song_job');
select function_privs_are('public', 'next_queued_song_job', array[]::text[], 'service_role', array['EXECUTE'],
  'service_role can execute next_queued_song_job');
select is_definer('public', 'claim_song_job', array['uuid', 'text'], 'claim_song_job is security definer');
select is_definer('public', 'next_queued_song_job', array[]::text[], 'next_queued_song_job is security definer');

set local role authenticated;
select throws_ok(format('select public.claim_song_job(%L, %L)', gen_random_uuid(), 'x'),
  '42501', null, 'a signed-in customer calling claim_song_job is refused');
reset role;
set local role anon;
select throws_ok('select * from public.next_queued_song_job()',
  '42501', null, 'anon calling next_queued_song_job is refused');
reset role;

-- ---------------------------------------------------------------------------------------
-- 7. The customer insert lock from migration 008 still holds (6)
-- ---------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000a001", "role": "authenticated"}';
select lives_ok(
  format($f$insert into public.song_jobs (id, user_id, title, primary_artist, source_language,
    target_language, notes, status, lyrics, voice_preference, rights_terms_version)
    values (%L, %L, 't', 'a', 'en', 'es', null, 'submitted', null, null, 'v1')$f$,
    (select id from t_ids where name = 'mine'), '00000000-0000-0000-0000-00000000a001'),
  'a customer can insert the manual-form columns as submitted');
select throws_ok(
  $f$insert into public.song_jobs (user_id, title, primary_artist, source_language, target_language, pipeline_state)
    values ('00000000-0000-0000-0000-00000000a001', 't', 'a', 'en', 'es', 'queued')$f$,
  '42501', null, 'a customer cannot insert pipeline_state');
select throws_ok(
  $f$insert into public.song_jobs (user_id, title, primary_artist, source_language, target_language, status)
    values ('00000000-0000-0000-0000-00000000a001', 't', 'a', 'en', 'es', 'approved')$f$,
  '42501', null, 'a customer cannot insert a job that is not submitted');
select throws_ok(
  $f$insert into public.song_jobs (user_id, title, primary_artist, source_language, target_language, contract_version)
    values ('00000000-0000-0000-0000-00000000a001', 't', 'a', 'en', 'es', 1)$f$,
  '42501', null, 'a customer cannot insert contract_version');
select throws_ok(
  format('update public.song_jobs set pipeline_state = %L where id = %L', 'queued', (select id from t_ids where name = 'mine')),
  '42501', null, 'a customer cannot update pipeline_state on their own job');
select throws_ok('select claimed_by from public.song_jobs',
  '42501', null, 'a customer cannot read claimed_by');
reset role;

select * from finish();
rollback;
