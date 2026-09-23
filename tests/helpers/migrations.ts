import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The schema now lives in `supabase/migrations/` (Supabase CLI), applied in filename order. The
 * hand-kept `supabase/schema.sql` and `001`..`008` moved to `supabase/legacy/` and are history
 * only. Tests that pin schema text read the migrations through these helpers.
 */
export const MIGRATIONS_DIR = 'supabase/migrations'

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
}

/** Every migration, concatenated in the order the CLI applies them. */
export function allMigrations(): string {
  return migrationFiles().map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8')).join('\n')
}

/** The `supabase db pull` baseline taken from production. */
export function baseline(): string {
  const f = migrationFiles().find((name) => name.endsWith('_remote_baseline.sql'))
  if (!f) throw new Error(`no *_remote_baseline.sql in ${MIGRATIONS_DIR}`)
  return readFileSync(join(MIGRATIONS_DIR, f), 'utf8')
}

/** Columns granted to `role` for `priv` on public.song_jobs, from `GRANT ...("col")` lines. */
export function songJobsColumnGrants(sql: string, priv: 'SELECT' | 'INSERT' | 'UPDATE', role: string): string[] {
  const cols = new Set<string>()
  const line = new RegExp(`^GRANT (.+) ON TABLE "public"\\."song_jobs" TO "${role}";$`, 'gm')
  for (const m of sql.matchAll(line)) {
    for (const g of m[1].matchAll(new RegExp(`${priv}\\("([a-z0-9_]+)"\\)`, 'g'))) cols.add(g[1])
  }
  return [...cols].sort()
}
