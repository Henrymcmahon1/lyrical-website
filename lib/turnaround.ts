/**
 * The Door-2 self-serve turnaround promise, single source of truth.
 *
 * CONFIRMED 22 Sep (evening, Henry): one line for every plan rather than a live estimate.
 * The busy cap was tightened from a proposed 24 hours to 3 hours. This is the automated
 * studio's promise only: the manual funnel's 48-hour, accept-based commitment in
 * `lib/language-pairs.ts` is a separate system for a different door and is untouched by this
 * file.
 *
 * Every place that states how fast the studio is reads these two constants, or the combined
 * `turnaroundLine()`, so the figure can never drift between a plan card, a notice, an
 * in-progress job card, the submit form and the emails Bot 1 sends.
 */
export const TURNAROUND_PROMISE = 'usually within 1 hour'
export const TURNAROUND_BUSY = 'up to 3 hours at busy times'

/** The combined sentence used wherever copy states the promise in full. */
export function turnaroundLine(): string {
  return `${TURNAROUND_PROMISE}, ${TURNAROUND_BUSY}`
}
