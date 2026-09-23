import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Migration 007 is THE CONTRACT between this site and the render PC poller
 * (`docs/bots/door1/README.md`). Pinned statement by statement so a drift on either side is a
 * failing test rather than a job the poller cannot read.
 */
const MIGRATION = readFileSync('supabase/migrations/007_door1.sql', 'utf8')
const SCHEMA = readFileSync('supabase/schema.sql', 'utf8')

const CONTRACT = [
  /alter table public\.song_jobs add column if not exists door1_enquiry_id uuid\s+references public\.enquiries \(id\) on delete set null;/,
  /alter table public\.song_jobs add column if not exists door1_source_url text;/,
  /alter table public\.song_jobs add column if not exists door1_settings jsonb not null default '\{\}'::jsonb;/,
  /alter table public\.song_jobs add column if not exists door1_due_on date;/,
  /alter table public\.song_job_deliveries add column if not exists purged_at timestamptz;/,
  /insert into storage\.buckets \(id, name, public\) values \('door1', 'door1', false\)\s+on conflict \(id\) do nothing;/,
]

const DOOR1_COLUMNS = ['door1_enquiry_id', 'door1_source_url', 'door1_settings', 'door1_due_on']

describe('migration 007_door1.sql', () => {
  it.each(CONTRACT.map((re) => [re.source.slice(0, 60), re]))('carries %s', (_l, re) => {
    expect(MIGRATION).toMatch(re as RegExp)
  })

  it('is appended to schema.sql, statement for statement', () => {
    for (const re of CONTRACT) expect(SCHEMA).toMatch(re)
  })

  it('never grants a door1 column to customers (anon, authenticated)', () => {
    for (const text of [MIGRATION, SCHEMA]) {
      const grants = text.match(/grant select[\s\S]*?;/gi) ?? []
      for (const g of grants) for (const c of DOOR1_COLUMNS) expect(g).not.toContain(c)
    }
  })

  it('creates no storage policy on the door1 bucket (service role only)', () => {
    expect(MIGRATION).not.toMatch(/create policy/i)
    expect(SCHEMA).not.toMatch(/bucket_id\s*=\s*'door1'/)
  })

  it('has no em dash', () => {
    expect(MIGRATION).not.toMatch(/—/)
  })
})
