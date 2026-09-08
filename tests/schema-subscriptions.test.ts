import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const sql = readFileSync('supabase/schema.sql', 'utf8')

describe('subscriptions schema', () => {
  it('creates the subscriptions table', () => {
    expect(sql).toMatch(/create table if not exists public\.subscriptions/)
  })

  it('enables RLS and an own-read policy on subscriptions', () => {
    expect(sql).toMatch(/alter table public\.subscriptions enable row level security/)
    expect(sql).toMatch(/subscriptions_own_select on public\.subscriptions/)
  })

  it('adds quota_consumed_at to song_jobs but NOT to the customer grant', () => {
    expect(sql).toMatch(/add column if not exists quota_consumed_at/)
    // quota_consumed_at is staff/service only, like pipeline_* and internal_notes:
    // it must never appear inside a `grant select (...) ... to anon, authenticated`.
    const grantBlocks =
      sql.match(/grant select \(([^)]*)\) on public\.song_jobs to anon, authenticated/g) ?? []
    for (const block of grantBlocks) expect(block).not.toContain('quota_consumed_at')
  })

  it('adds the Door 1 route marker, staff-only and defaulting to auto', () => {
    expect(sql).toMatch(/add column if not exists route text not null default 'auto'/)
    const grantBlocks =
      sql.match(/grant select \(([^)]*)\) on public\.song_jobs to anon, authenticated/g) ?? []
    for (const block of grantBlocks) expect(block).not.toContain('route')
  })

  it('uses no em dashes', () => {
    expect(sql).not.toContain('—')
  })
})
