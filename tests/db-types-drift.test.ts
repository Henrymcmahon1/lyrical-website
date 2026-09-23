import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { generate, localStackUp, PY_PATH, TS_PATH } from '../scripts/db-types'

/**
 * The generated contract (TypeScript for this site, Python for the render worker) must match
 * the migrations. Regenerates from the LOCAL stack and diffs against the committed files.
 *
 * Needs `npx supabase start` (the migrations applied). Without it the drift check is SKIPPED,
 * loudly: CI has no local stack and says so in its log. The static checks below always run.
 */
const stackUp = await localStackUp()
if (!stackUp) {
  console.warn(
    '[db-types-drift] SKIPPED: no local Supabase stack on 127.0.0.1:54322. ' +
      'Run `npx supabase start` then `npm test` to check the generated types against the migrations.',
  )
}

const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

describe('generated contract files', () => {
  it('are committed', () => {
    expect(existsSync(TS_PATH)).toBe(true)
    expect(existsSync(PY_PATH)).toBe(true)
  })

  it('carry the four job vocabularies and the claim RPCs in TypeScript', () => {
    // Whitespace-insensitive: the CLI wraps long unions over several lines.
    const ts = read(TS_PATH).replace(/\s+/g, ' ').replace(/: \| /g, ': ')
    expect(ts).toContain('song_job_status: "submitted" | "approved" | "in_progress" | "delivered" | "rejected"')
    expect(ts).toContain('song_job_pipeline_state: "queued" | "claimed" | "rendered_local" | "delivered" | "failed" | "blocked"')
    expect(ts).toContain('song_job_route: "auto" | "door1"')
    expect(ts).toContain('song_job_delivery_profile: "door2" | "door1"')
    expect(ts).toContain('claim_song_job: { Args: { p_job_id: string; p_worker: string } Returns: boolean }')
    expect(ts).toContain('next_queued_song_job: { Args: never Returns: {')
  })

  it('carry the four job vocabularies and the three job tables in Python', () => {
    const py = read(PY_PATH)
    expect(py).toContain('PublicSongJobStatus: TypeAlias = Literal["submitted", "approved", "in_progress", "delivered", "rejected"]')
    expect(py).toContain('PublicSongJobPipelineState: TypeAlias = Literal["queued", "claimed", "rendered_local", "delivered", "failed", "blocked"]')
    expect(py).toContain('PublicSongJobRoute: TypeAlias = Literal["auto", "door1"]')
    expect(py).toContain('PublicSongJobDeliveryProfile: TypeAlias = Literal["door2", "door1"]')
    for (const cls of ['PublicSongJobs', 'PublicSongJobAssets', 'PublicSongJobDeliveries']) {
      expect(py).toMatch(new RegExp(`^class ${cls}\\(BaseModel\\):`, 'm'))
      expect(py).toMatch(new RegExp(`^class ${cls}Insert\\(TypedDict\\):`, 'm'))
      expect(py).toMatch(new RegExp(`^class ${cls}Update\\(TypedDict\\):`, 'm'))
    }
  })

  it.skipIf(!stackUp)('match a fresh generation from the local stack (no drift)', () => {
    const fresh = generate()
    expect(read(TS_PATH)).toBe(fresh.ts)
    expect(read(PY_PATH)).toBe(fresh.py)
  }, 120_000)
})
