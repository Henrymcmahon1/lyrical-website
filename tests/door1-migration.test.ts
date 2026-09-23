import { describe, expect, it } from 'vitest'
import { allMigrations, baseline, songJobsColumnGrants } from './helpers/migrations'

/**
 * The Door 1 schema (legacy migration 007, now part of the production baseline in
 * `supabase/migrations/`) is part of the contract between this site and the render PC poller
 * (`docs/CONTRACT.md`). Pinned so a drift is a failing test rather than a job the poller cannot
 * read. The database-level proof (grants as applied) is `supabase/tests/song_jobs_grants.test.sql`.
 */
const BASELINE = baseline()
const ALL = allMigrations()

const CONTRACT = [
  /"door1_enquiry_id" "uuid",/,
  /ADD CONSTRAINT "song_jobs_door1_enquiry_id_fkey" FOREIGN KEY \("door1_enquiry_id"\) REFERENCES "public"\."enquiries"\("id"\) ON DELETE SET NULL;/,
  /"door1_source_url" "text",/,
  /"door1_settings" "jsonb" DEFAULT '\{\}'::"jsonb" NOT NULL,/,
  /"door1_due_on" "date",/,
  /CREATE TABLE IF NOT EXISTS "public"\."song_job_deliveries" \([^;]*"purged_at" timestamp with time zone/,
  /\('door1', 'door1', false\)/,
]

const DOOR1_COLUMNS = ['door1_enquiry_id', 'door1_source_url', 'door1_settings', 'door1_due_on']

describe('Door 1 schema in the baseline', () => {
  it.each(CONTRACT.map((re) => [re.source.slice(0, 60), re]))('carries %s', (_l, re) => {
    expect(BASELINE).toMatch(re as RegExp)
  })

  it('never grants a door1 column to customers (anon, authenticated)', () => {
    for (const role of ['anon', 'authenticated']) {
      for (const priv of ['SELECT', 'INSERT', 'UPDATE'] as const) {
        const granted = songJobsColumnGrants(ALL, priv, role)
        for (const c of DOOR1_COLUMNS) expect(granted).not.toContain(c)
      }
    }
  })

  it('creates no storage policy on the door1 bucket (service role only)', () => {
    expect(ALL).not.toMatch(/bucket_id\s*=\s*'door1'/)
  })

  it('has no em dash in any migration', () => {
    expect(ALL).not.toContain(String.fromCharCode(0x2014))
  })
})
