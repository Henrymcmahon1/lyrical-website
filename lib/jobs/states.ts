import { Constants, type Enums } from '../db/database.types'
import { TURNAROUND_HOURS } from '../language-pairs'

/**
 * The ONE place for job-state logic on the website.
 *
 * Every vocabulary here comes from the generated contract (`lib/db/database.types.ts`, see
 * `docs/CONTRACT.md`), never a hand-kept list: a state added to the database is a type error
 * here until somebody decides what it means. Two things live in this file and stay apart:
 *
 * - the status move graph (`ALLOWED_MOVES`, `canMove`, `stampsFor`): the control;
 * - the words staff and customers read (`MOVE_LABELS`, `PIPELINE_STATE_LABELS`, `stateLabel`).
 *
 * The pipeline_state transition rules are NOT here: the database enforces them for every role
 * (trigger `song_jobs_pipeline_state_transition`). The website only ever writes `queued`.
 */

/** `song_jobs.status`: the customer-facing lifecycle. Text + CHECK in the database. */
export const JOB_STATUSES = Constants.public.Enums.song_job_status
export type JobStatus = Enums<'song_job_status'>

/** `song_jobs.pipeline_state`: the render worker's state. Null means never handed to it. */
export const PIPELINE_STATES = Constants.public.Enums.song_job_pipeline_state
export type PipelineState = Enums<'song_job_pipeline_state'>

/** `song_jobs.route`: who owns the job. */
export type JobRoute = Enums<'song_job_route'>

/** `song_jobs.delivery_profile`: how the job is delivered. */
export type DeliveryProfile = Enums<'song_job_delivery_profile'>

/**
 * Which moves a song job is allowed to make, and what each one stamps.
 *
 * Pure and free of Supabase on purpose, so the rules can be tested directly. The buttons in
 * `/queue` are generated from this table, and the server action checks against the SAME table
 * before writing. Those are two different jobs: the first is convenience, the second is the
 * control. A server action is a POST endpoint like any other, and reaching it does not require
 * having rendered the page that drew the button.
 *
 * ## Why the graph is this shape
 *
 * `submitted` is the only place a job can be refused, because refusing something already
 * accepted means retracting a delivery promise that has been emailed to a customer. If that
 * ever needs to happen it is a conversation, not a button.
 *
 * `approved` can go straight to `delivered` without passing through `in_progress`. A short job
 * that is finished in one sitting should not require clicking a step whose only purpose is to
 * describe a state it was never in.
 *
 * `delivered` and `rejected` are terminal. Reopening a job would mean the customer's status
 * rail could move backwards after they have been told it is finished, which reads as a mistake
 * whether or not it is one.
 */
export const ALLOWED_MOVES: Record<JobStatus, readonly JobStatus[]> = {
  submitted: ['approved', 'rejected'],
  approved: ['in_progress', 'delivered'],
  in_progress: ['delivered'],
  delivered: [],
  rejected: [],
}

/**
 * `song_jobs.status` is text in the database (a CHECK, not an enum), so the generated row types
 * carry it as `string`. This narrows it to the contract's vocabulary without a cast.
 */
export function isJobStatus(value: string): value is JobStatus {
  return JOB_STATUSES.some((s) => s === value)
}

export function canMove(from: string, to: string): boolean {
  if (!isJobStatus(from) || !isJobStatus(to)) return false
  return ALLOWED_MOVES[from].includes(to)
}

/**
 * The timestamps a move writes, alongside the status itself.
 *
 * `approved_at` is the one that matters commercially: it is when the delivery clock starts, on
 * Henry's instruction, so that a submission arriving at 6pm on a Friday does not burn a promise
 * while nobody is looking at it. It is written here and nowhere else.
 *
 * Both are set only on the move that earns them, and neither is ever cleared, because the
 * graph above has no path back.
 */
export function stampsFor(to: JobStatus, nowIso: string): Record<string, string> {
  if (to === 'approved') return { approved_at: nowIso }
  if (to === 'delivered') return { delivered_at: nowIso }
  return {}
}

/** What each move is called on its button, and what the button is claimed to do. */
export const MOVE_LABELS: Record<JobStatus, { label: string; tone: 'primary' | 'quiet' }> = {
  approved: { label: 'Accept', tone: 'primary' },
  in_progress: { label: 'Start work', tone: 'quiet' },
  delivered: { label: 'Mark delivered', tone: 'primary' },
  rejected: { label: 'Reject', tone: 'quiet' },
  submitted: { label: 'Reopen', tone: 'quiet' },
}

/** Which moves send the customer an email. Reject is deliberately silent: Henry's call. */
export const MOVES_THAT_EMAIL: readonly JobStatus[] = ['approved', 'delivered']

/**
 * Statuses that still need somebody to do something, which is the queue's default view.
 *
 * `rejected` and `delivered` are finished, so they only appear under "Everything". Without
 * this split the console fills with completed work and the thing waiting on a human stops
 * being visible, which is the failure mode a queue exists to prevent.
 */
export const OPEN_STATUSES: readonly JobStatus[] = ['submitted', 'approved', 'in_progress']

/**
 * How long is left on a promise that is already running.
 *
 * The single most useful number in the console: a queue exists to stop a commitment expiring
 * quietly, and this is the thing that makes it loud. Only meaningful once a job is accepted,
 * because before that there is no clock.
 *
 * `late` is true past the deadline AND in the last six hours, so the warning arrives while
 * there is still time to act on it rather than as an obituary.
 */
export function timeLeft(
  approvedAtIso: string,
  nowMs: number,
): { text: string; late: boolean } {
  const dueMs = new Date(approvedAtIso).getTime() + TURNAROUND_HOURS * 3600 * 1000
  const leftMs = dueMs - nowMs
  const hours = Math.round(Math.abs(leftMs) / 3600000)
  if (leftMs <= 0) return { text: `${hours}h over`, late: true }
  return { text: `${hours}h left`, late: hours <= 6 }
}

/**
 * The wall clock, read outside a component body.
 *
 * `/queue` is `force-dynamic` and rendered once per request, so reading the time while building
 * it is exactly right. React's purity lint rule cannot know that and flags `Date.now()` in a
 * component regardless, which is fair: in a component that CAN re-render, an unstable read
 * produces output that changes for no reason the code explains.
 *
 * This is the same move `lib/admin-session.ts` already makes for the session expiry check, and
 * it is here for the same reason: the impure read belongs in a named function that says out
 * loud that it is impure, not buried in the middle of some markup.
 */
export function clockNow(): number {
  return Date.now()
}

/**
 * Staff wording for each pipeline state, on its own. Words only: the graph above and the
 * database trigger decide what may happen, this decides what it is called.
 */
export const PIPELINE_STATE_LABELS: Record<PipelineState, string> = {
  queued: 'Queued',
  claimed: 'Rendering',
  rendered_local: 'Uploading',
  delivered: 'Delivered',
  failed: 'Failed',
  blocked: 'Blocked',
}

/**
 * Staff wording for where a Door 1 job is. `pipeline_state` wins once the poller has it.
 * Moved here from `app/admin/door1/shared.tsx`; the output is unchanged, including that a
 * `blocked` job (and any status with no pipeline state) reads its raw value.
 */
export function stateLabel(
  status: string,
  pipelineState: PipelineState | null,
): { label: string; className: string } {
  if (pipelineState === 'failed' || status === 'rejected') return { label: PIPELINE_STATE_LABELS.failed, className: 'text-ember' }
  if (status === 'delivered' || pipelineState === 'delivered') return { label: PIPELINE_STATE_LABELS.delivered, className: 'text-indigo' }
  if (pipelineState === 'queued') return { label: PIPELINE_STATE_LABELS.queued, className: 'text-graphite/60' }
  if (pipelineState === 'claimed' || status === 'in_progress') return { label: PIPELINE_STATE_LABELS.claimed, className: 'text-indigo' }
  if (pipelineState === 'rendered_local') return { label: PIPELINE_STATE_LABELS.rendered_local, className: 'text-indigo' }
  return { label: pipelineState ?? status, className: 'text-graphite/60' }
}
