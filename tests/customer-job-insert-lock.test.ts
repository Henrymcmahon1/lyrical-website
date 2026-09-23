import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Migration 008 closes the hole where a signed-in customer could insert a render job straight
 * through PostgREST. Customers get a column-level INSERT grant covering exactly what the manual
 * form writes, and never a pipeline column.
 */
const MIGRATION = readFileSync('supabase/migrations/008_lock_customer_job_insert.sql', 'utf8')
const SUBMIT = readFileSync('app/studio/submit-actions.ts', 'utf8')

function grantedColumns(sql: string): string[] {
  const m = sql.match(/grant insert \(([\s\S]*?)\) on public\.song_jobs to authenticated;/)
  if (!m) throw new Error('no column insert grant on song_jobs found')
  return m[1].split(',').map((c) => c.trim()).filter(Boolean)
}

function formColumns(src: string): string[] {
  const m = src.match(/from\('song_jobs'\)\.insert\(\{([\s\S]*?)\n {2}\}\)/)
  if (!m) throw new Error('customer song_jobs insert not found in submit-actions.ts')
  return [...m[1].matchAll(/^\s{4}([a-z_]+):/gm)].map((x) => x[1])
}

const PIPELINE_COLUMNS = [
  'pipeline_state', 'pipeline_error', 'route', 'delivery_profile', 'quota_consumed_at',
  'approved_at', 'delivered_at', 'parent_job_id', 'reroll_index', 'seed', 'internal_notes',
  'pipeline_voice_model', 'door1_enquiry_id', 'door1_source_url', 'door1_settings', 'door1_due_on',
]

describe('migration 008: customer song_jobs insert lock', () => {
  it('revokes the table-wide insert from anon and authenticated first', () => {
    expect(MIGRATION).toMatch(/revoke insert on public\.song_jobs from anon, authenticated;/)
  })

  it('grants exactly the columns the manual submit form writes', () => {
    expect(grantedColumns(MIGRATION).sort()).toEqual(formColumns(SUBMIT).sort())
  })

  it('never grants a pipeline column to customers', () => {
    const granted = grantedColumns(MIGRATION)
    for (const c of PIPELINE_COLUMNS) expect(granted).not.toContain(c)
  })

  it('only lets a customer insert their own row as submitted', () => {
    expect(MIGRATION).toMatch(/with check \(auth\.uid\(\) = user_id and status = 'submitted'\)/)
  })

  it('is appended to schema.sql', () => {
    const schema = readFileSync('supabase/schema.sql', 'utf8')
    expect(grantedColumns(schema.slice(schema.lastIndexOf('-- 008:')))).toEqual(grantedColumns(MIGRATION))
  })
})
