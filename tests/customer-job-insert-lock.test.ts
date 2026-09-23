import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { allMigrations, songJobsColumnGrants } from './helpers/migrations'

/**
 * Legacy migration 008 closed the hole where a signed-in customer could insert a render job
 * straight through PostgREST. It is now part of the production baseline in
 * `supabase/migrations/`. Customers get a column-level INSERT grant covering exactly what the
 * manual form writes, and never a pipeline column. The as-applied proof is pgTAP
 * (`supabase/tests/job_contract.test.sql` section 7 and `song_jobs_grants.test.sql`).
 */
const MIGRATIONS = allMigrations()
const SUBMIT = readFileSync('app/studio/submit-actions.ts', 'utf8')

function formColumns(src: string): string[] {
  const m = src.match(/from\('song_jobs'\)\.insert\(\{([\s\S]*?)\n {2}\}\)/)
  if (!m) throw new Error('customer song_jobs insert not found in submit-actions.ts')
  return [...m[1].matchAll(/^\s{4}([a-z_]+):/gm)].map((x) => x[1])
}

const PIPELINE_COLUMNS = [
  'pipeline_state', 'pipeline_error', 'route', 'delivery_profile', 'quota_consumed_at',
  'approved_at', 'delivered_at', 'parent_job_id', 'reroll_index', 'seed', 'internal_notes',
  'pipeline_voice_model', 'door1_enquiry_id', 'door1_source_url', 'door1_settings', 'door1_due_on',
  'contract_version', 'claimed_by', 'claimed_at',
]

describe('customer song_jobs insert lock (legacy 008, now in the baseline)', () => {
  it('revokes the table-wide insert from anon and authenticated', () => {
    expect(MIGRATIONS).toMatch(/revoke insert on table "public"\."song_jobs" from "anon";/)
    expect(MIGRATIONS).toMatch(/revoke insert on table "public"\."song_jobs" from "authenticated";/)
  })

  it('revokes before it grants (a later table REVOKE would wipe the column grants)', () => {
    const revoke = MIGRATIONS.indexOf('revoke insert on table "public"."song_jobs" from "authenticated";')
    const grant = MIGRATIONS.search(/^GRANT .*INSERT\("[a-z_]+"\).* ON TABLE "public"\."song_jobs" TO "authenticated";$/m)
    expect(revoke).toBeGreaterThan(-1)
    expect(grant).toBeGreaterThan(revoke)
  })

  it('grants exactly the columns the manual submit form writes', () => {
    expect(songJobsColumnGrants(MIGRATIONS, 'INSERT', 'authenticated')).toEqual(formColumns(SUBMIT).sort())
  })

  it('never grants a pipeline column to customers', () => {
    const granted = songJobsColumnGrants(MIGRATIONS, 'INSERT', 'authenticated')
    for (const c of PIPELINE_COLUMNS) expect(granted).not.toContain(c)
  })

  it('grants anon no insert at all', () => {
    expect(songJobsColumnGrants(MIGRATIONS, 'INSERT', 'anon')).toEqual([])
  })

  it('only lets a customer insert their own row as submitted', () => {
    expect(MIGRATIONS).toMatch(
      /CREATE POLICY "song_jobs_own_insert" ON "public"\."song_jobs" FOR INSERT TO "authenticated" WITH CHECK \(\(\("auth"\."uid"\(\) = "user_id"\) AND \("status" = 'submitted'::"text"\)\)\);/,
    )
  })
})
