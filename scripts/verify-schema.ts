// Verifies the schema landed on the live project, using only the public anon key.
// Run: npx tsx scripts/verify-schema.ts
//
// The schema is defined by supabase/migrations (Supabase CLI) and proven on the local stack by
// pgTAP (supabase/tests). This script is the remaining check against PRODUCTION after the
// orchestrator applies a migration there; it is read-only.
//
// Method: PostgREST answers `select=<column>&limit=0` with 200 when the column exists (rows
// are filtered by RLS, so nothing leaks), 400 when the column does not exist, and 401 when
// the column exists but the role has no grant on it. That last case is what keeps `seed`
// and `pipeline_error` staff-only on song_jobs, and this script asserts it.
import { readFileSync } from 'node:fs'

function env(name: string): string {
  const line = readFileSync('.env.local', 'utf8')
    .split('\n')
    .find((l) => l.startsWith(name + '='))
  const v = line?.slice(name.length + 1).trim().replace(/^"|"$/g, '')
  if (!v) throw new Error(`${name} missing from .env.local`)
  return v
}

const EXISTS: Record<string, string[]> = {
  song_credits: ['delta', 'reason', 'stripe_event_id'],
  stripe_events: ['id', 'processed_at'],
  job_feedback: ['rating', 'note', 'tags'],
  worker_heartbeat: ['worker', 'seen_at'],
  song_jobs: ['parent_job_id', 'reroll_index', 'licence_terms_version', 'delivery_profile'],
  song_job_assets: ['purged_at'],
  song_job_deliveries: ['watermark_id', 'purged_at'],
  profiles: ['stripe_customer_id', 'licence_terms_version'],
}
// Exist, but must NOT be readable by customers (column grant on song_jobs).
// The Door 1 columns (migration 007) are staff-only too, so they are asserted HIDDEN, which
// also proves they exist (a missing column answers 400, not 401).
const HIDDEN: Record<string, string[]> = {
  song_jobs: [
    'seed',
    'pipeline_error',
    'door1_enquiry_id',
    'door1_source_url',
    'door1_settings',
    'door1_due_on',
    // The job contract (docs/CONTRACT.md): worker-only.
    'contract_version',
    'claimed_by',
    'claimed_at',
  ],
}

async function main() {
  const url = env('NEXT_PUBLIC_SUPABASE_URL')
  const key = env('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  const probe = async (table: string, col: string) =>
    (await fetch(`${url}/rest/v1/${table}?select=${col}&limit=0`, { headers: { apikey: key } })).status

  let failed = false
  const report = (ok: boolean, line: string) => {
    if (!ok) failed = true
    console.log(`${ok ? 'ok     ' : 'FAILED '} ${line}`)
  }
  for (const [table, cols] of Object.entries(EXISTS)) {
    for (const c of cols) {
      const s = await probe(table, c)
      report(s !== 400 && s !== 404, `${table}.${c} exists (${s})`)
    }
  }
  for (const [table, cols] of Object.entries(HIDDEN)) {
    for (const c of cols) {
      const s = await probe(table, c)
      report(s === 401 || s === 403, `${table}.${c} hidden from customers (${s})`)
    }
  }
  if (failed) process.exit(1)
  console.log('schema verified')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
