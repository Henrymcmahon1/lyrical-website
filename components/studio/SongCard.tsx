'use client'

import { JobStatus } from '@/components/JobStatus'
import { LyricsEditor } from '@/components/LyricsEditor'
import { CoverPlayer } from '@/components/CoverPlayer'
import { FeedbackBar, type ExistingFeedback } from '@/components/FeedbackBar'
import { StatChip, eyebrow } from '@/components/studio/ui'
import { TURNAROUND_BUSY, TURNAROUND_PROMISE } from '@/lib/turnaround'
import type { Tables } from '@/lib/db/database.types'

/**
 * One song, collapsed by default: a real <details>/<summary> so it opens and closes without any
 * JavaScript and is keyboard-accessible the way a native disclosure widget always is, rather
 * than a div-and-onClick reimplementation of one. The player, licence line, feedback bar and
 * nested takes were previously drawn straight into app/studio/page.tsx (see git history); they
 * moved here so the list of songs on the studio home stops reading as one long wall of takes.
 */
export type SongJob = Pick<
  Tables<'song_jobs'>,
  | 'id'
  | 'title'
  | 'primary_artist'
  | 'source_language'
  | 'target_language'
  | 'status'
  | 'created_at'
  | 'lyrics'
  | 'parent_job_id'
  | 'reroll_index'
  | 'licence_terms_version'
>

const LICENCE_LINE = 'Personal use only. Not for release or sale. lyrical may carry an inaudible provenance mark.'
const REROLL_CLOSED = 'The re-roll window for this song has closed. Make it again to start fresh.'
const NOT_MADE = 'We could not make this one. It has not counted against your tracks. Make it again to start fresh.'
/** Statuses that are still moving, the ones JobStatus pulses. Everything else has an ending. */
const LIVE_STATUSES = new Set(['submitted', 'approved', 'in_progress'])

/** A self-serve original that failed at our end: not a child, and it carries the licence version. */
function notMade(j: SongJob): boolean {
  return j.status === 'rejected' && !j.parent_job_id && j.reroll_index === 0 && !!j.licence_terms_version
}

function statusLabel(j: SongJob): string {
  if (j.status === 'rejected') return notMade(j) ? 'Not made' : 'Not taken on'
  switch (j.status) {
    case 'submitted':
      return 'Received'
    case 'approved':
      return 'Accepted'
    case 'in_progress':
      return 'Being made'
    case 'delivered':
      return 'Delivered'
    default:
      return j.status
  }
}

function Take({
  job: j,
  left,
  n,
  existing,
}: {
  job: SongJob
  left: number
  n?: number
  existing: Record<string, ExistingFeedback>
}) {
  return (
    <div key={j.id} className={n ? 'mt-4 rounded-card border border-dark-ink/10 bg-dark-ink/3 p-4' : ''}>
      {n ? <span className={eyebrow}>Take {n}</span> : null}
      <div className={n ? 'mt-3' : ''}><JobStatus status={j.status} rejectedAs={notMade(j) ? 'not-made' : 'declined'} /></div>
      {LIVE_STATUSES.has(j.status) && (
        <p className="mt-2 font-product text-xs text-dark-ink/55">
          {TURNAROUND_PROMISE}, {TURNAROUND_BUSY}.
        </p>
      )}
      {j.status === 'delivered' && (
        <>
          <CoverPlayer jobId={j.id} />
          <p className="mt-3 font-product text-xs leading-relaxed text-dark-ink/55">{LICENCE_LINE}</p>
          <FeedbackBar jobId={j.id} existing={existing[j.id] ?? null} rerollsLeft={left} canReroll />
        </>
      )}
      {n && j.status === 'rejected' ? <p className="mt-3 font-product text-sm text-dark-ink/70">{REROLL_CLOSED}</p> : null}
      {notMade(j) ? <p className="mt-3 font-product text-sm text-dark-ink/70">{NOT_MADE}</p> : null}
    </div>
  )
}

export function SongCard({
  original,
  kids,
  left,
  existing,
  defaultOpen,
}: {
  original: SongJob
  /** Re-rolls of `original`, sorted ascending by reroll_index (oldest take first). */
  kids: SongJob[]
  left: number
  /** Serializable map of job id -> saved feedback. Must be plain data, not a function: this is a
   *  Client Component and a function prop from the server 500s the page. */
  existing: Record<string, ExistingFeedback>
  defaultOpen: boolean
}) {
  const latest = kids.length ? kids[kids.length - 1] : original
  const dateStr = new Date(original.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })

  return (
    <details open={defaultOpen} className="group rounded-card border border-dark-ink/10 bg-dark-ink/4 p-5">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <h2 className="font-brand text-lg font-semibold leading-tight text-dark-ink">{original.title}</h2>
          <p className="mt-1 font-product text-xs text-dark-ink/55">
            {original.primary_artist} &middot; {original.source_language} to {original.target_language} &middot; {dateStr}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatChip label="Status" value={statusLabel(latest)} tone={latest.status === 'rejected' ? 'action' : 'neutral'} />
          <span aria-hidden="true" className="font-product text-xs text-dark-ink/40 transition-transform duration-150 group-open:rotate-180">&#9662;</span>
        </div>
      </summary>
      <div className="mt-4">
        <Take job={original} left={left} existing={existing} />
        {kids.map((k) => (
          <Take key={k.id} job={k} left={left} n={k.reroll_index + 1} existing={existing} />
        ))}
        <LyricsEditor jobId={original.id} initial={original.lyrics ?? ''} locked={original.status !== 'submitted'} />
      </div>
    </details>
  )
}
