import { describe, expect, it } from 'vitest'
import { Constants } from '@/lib/db/database.types'
import {
  ALLOWED_MOVES,
  JOB_STATUSES,
  PIPELINE_STATES,
  PIPELINE_STATE_LABELS,
  canMove,
  isJobStatus,
  stateLabel,
} from '@/lib/jobs/states'
import { JOB_STATUSES as SCHEMA_JOB_STATUSES } from '@/lib/song-job-schema'

/**
 * `lib/jobs/states.ts` is the ONE place for job-state logic on the web. Its vocabularies come
 * from the generated contract (`lib/db/database.types.ts`), so a state added to the database
 * shows up here as a failing test, not as a label nobody wrote.
 */

describe('vocabularies come from the generated contract', () => {
  it('job statuses are the song_job_status enum, in order', () => {
    expect([...JOB_STATUSES]).toEqual([...Constants.public.Enums.song_job_status])
    expect([...SCHEMA_JOB_STATUSES]).toEqual([...Constants.public.Enums.song_job_status])
  })

  it('pipeline states are the song_job_pipeline_state enum, in order', () => {
    expect([...PIPELINE_STATES]).toEqual([...Constants.public.Enums.song_job_pipeline_state])
  })
})

describe('the status move graph lives here', () => {
  it('has an entry for every status', () => {
    for (const s of JOB_STATUSES) expect(ALLOWED_MOVES[s]).toBeDefined()
  })

  it('canMove answers from the same table', () => {
    expect(canMove('submitted', 'approved')).toBe(true)
    expect(canMove('delivered', 'submitted')).toBe(false)
    expect(canMove('nonsense', 'approved')).toBe(false)
    expect(canMove('submitted', 'nonsense')).toBe(false)
  })
})

describe('isJobStatus narrows a text column to the enum', () => {
  it('accepts exactly the statuses', () => {
    for (const s of JOB_STATUSES) expect(isJobStatus(s)).toBe(true)
    for (const s of ['', 'queued', 'Submitted', 'toString', '__proto__']) expect(isJobStatus(s)).toBe(false)
  })

  it('canMove refuses a prototype key rather than throwing', () => {
    expect(canMove('toString', 'approved')).toBe(false)
    expect(canMove('submitted', 'constructor')).toBe(false)
  })
})

describe('pipeline state labels (staff wording)', () => {
  it('names every pipeline state', () => {
    for (const s of PIPELINE_STATES) expect(PIPELINE_STATE_LABELS[s]).toBeTruthy()
  })
})

describe('stateLabel: the Door 1 staff wording, unchanged by the move', () => {
  const cases: [string, (typeof PIPELINE_STATES)[number] | null, string, string][] = [
    ['approved', 'failed', 'Failed', 'text-ember'],
    ['rejected', null, 'Failed', 'text-ember'],
    ['rejected', 'delivered', 'Failed', 'text-ember'],
    ['delivered', null, 'Delivered', 'text-indigo'],
    ['in_progress', 'delivered', 'Delivered', 'text-indigo'],
    ['approved', 'queued', 'Queued', 'text-graphite/60'],
    ['in_progress', 'queued', 'Queued', 'text-graphite/60'],
    ['approved', 'claimed', 'Rendering', 'text-indigo'],
    ['in_progress', null, 'Rendering', 'text-indigo'],
    ['approved', 'rendered_local', 'Uploading', 'text-indigo'],
    ['approved', 'blocked', 'blocked', 'text-graphite/60'],
    ['approved', null, 'approved', 'text-graphite/60'],
    ['submitted', null, 'submitted', 'text-graphite/60'],
  ]
  it.each(cases)('status %s + pipeline %s reads %s', (status, pipeline, label, className) => {
    expect(stateLabel(status, pipeline)).toEqual({ label, className })
  })
})
