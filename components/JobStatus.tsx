import type { JobStatus as Status } from '@/lib/song-job-schema'

/**
 * Where a job has got to.
 *
 * The problem this solves is specific. A job sits at "received" for hours while a human
 * decides whether to take it, and a single static line of text there reads as a page that has
 * stopped rather than a process that is running. The customer has just handed over an
 * unreleased master and has nothing to look at.
 *
 * So: a rail showing the whole journey, the reached portion filled, and a pulse on the step
 * the job is actually sitting at.
 *
 * The state is carried by TEXT and COLOUR. The pulse is decoration on top, and it stops
 * entirely under `prefers-reduced-motion`, where nothing is lost. Anything that only animation
 * communicates is invisible to a reader who has turned animation off.
 */

const STEPS: { key: Status; label: string; blurb: string }[] = [
  { key: 'submitted', label: 'Received', blurb: 'With us. Waiting on us to accept it.' },
  { key: 'approved', label: 'Accepted', blurb: 'Taken on. The clock starts here.' },
  { key: 'in_progress', label: 'Being made', blurb: 'In the studio.' },
  { key: 'delivered', label: 'Delivered', blurb: 'Finished. The files are on their way to you.' },
]

/** Steps that are still moving. `delivered` and `rejected` are endings, so they do not pulse. */
const LIVE: ReadonlySet<Status> = new Set<Status>(['submitted', 'approved', 'in_progress'])

export function JobStatus({ status }: { status: string }) {
  if (status === 'rejected') {
    return (
      <div className="flex items-center gap-2.5">
        <span className="status-dot bg-graphite/35" data-live="false" aria-hidden="true" />
        {/*
          Corrected 2026-08-11. This used to read "We will have been in touch about why", and
          nobody will have been: rejection sends no email at all, on Henry's instruction. A
          status line that claims contact the system never makes is worse than a blunt one,
          because the customer waits for a message that is not coming.
        */}
        <span className="text-sm text-graphite/70">
          Not taken on this time. Write to us if you would like to know why.
        </span>
      </div>
    )
  }

  const index = Math.max(
    0,
    STEPS.findIndex((s) => s.key === status),
  )
  const current = STEPS[index]
  const live = LIVE.has(current.key)
  // Fills to the middle of the current step, so the rail reads as "in this stage" rather than
  // "finished this stage".
  const fill = (index + 0.5) / STEPS.length

  return (
    <div>
      <div className="flex items-center gap-2.5">
        <span
          className={`status-dot ${live ? 'bg-ember' : 'bg-indigo'}`}
          data-live={live ? 'true' : 'false'}
          aria-hidden="true"
        />
        {/* The whole state in words, for a screen reader and for anyone with motion off. */}
        <span className="text-sm text-graphite">
          {current.label}
          <span className="text-graphite/60"> &middot; {current.blurb}</span>
        </span>
      </div>

      <div className="status-rail mt-4 overflow-hidden rounded-full" aria-hidden="true">
        <div
          className="status-rail-fill bg-indigo"
          style={{ transform: `scaleX(${fill})` }}
        />
      </div>

      <ol className="mt-2 flex justify-between text-[11px] tracking-wide" aria-hidden="true">
        {STEPS.map((s, i) => (
          <li key={s.key} className={i <= index ? 'text-graphite/70' : 'text-graphite/35'}>
            {s.label}
          </li>
        ))}
      </ol>
    </div>
  )
}
