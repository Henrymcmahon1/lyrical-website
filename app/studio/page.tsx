import { redirect } from 'next/navigation'
import { JobStatus } from '@/components/JobStatus'
import { LyricsEditor } from '@/components/LyricsEditor'
import { Scorecard } from '@/components/Scorecard'
import { CoverPlayer } from '@/components/CoverPlayer'
import { FeedbackBar, type ExistingFeedback } from '@/components/FeedbackBar'
import { StudioAutoRefresh } from '@/components/StudioAutoRefresh'
import { Notice, PageHead, Panel, StatChip, button, eyebrow, link } from '@/components/studio/ui'
import { rerollsLeft } from '@/lib/entitlement'
import { getEntitlementFor } from '@/lib/entitlement-db'
import { planById } from '@/lib/plans'
import { currentUser, supabaseServer } from '@/lib/supabase-server'
import { TURNAROUND_BUSY, TURNAROUND_PROMISE } from '@/lib/turnaround'

/**
 * The Door-2 studio: plan card, then the songs, re-rolls nested under their original.
 * Every read is the USER's client: RLS decides the rows, the column grant decides the columns,
 * so the select lists are explicit and never `*`. A child's `pipeline_error` is service-role
 * only; the closed-window copy keys off `status='rejected'` on a child instead.
 *
 * A rejected ORIGINAL is one of two things. `route` is not customer-readable either, so the
 * page tells them apart by `licence_terms_version`: a self-serve job carries it (the customer
 * agreed the licence at submit), a manual-funnel job does not. Self-serve and rejected means
 * the render failed at our end (the worker sets `rejected`, clears `quota_consumed_at` and
 * refunds a credit), so it reads "Not made" and says it did not count. Manual and rejected
 * keeps the funnel's declined wording from JobStatus.
 *
 * Drawn in the dashboard's panel language (components/studio/ui.tsx): the plan is a row of
 * StatChips, each song a Panel with its takes nested as inner cards. Sign out lives in the
 * shell's rail (app/studio/layout.tsx), so it is not repeated here. Plan names come from
 * lib/plans.ts and are never typed here.
 */
export const metadata = { title: 'The studio', robots: { index: false, follow: false } }

type Job = {
  id: string; title: string; primary_artist: string; source_language: string; target_language: string
  status: string; created_at: string; lyrics: string | null; parent_job_id: string | null
  reroll_index: number; licence_terms_version: string | null
}
type Feedback = { job_id: string; rating: 'up' | 'down'; note: string | null; tags: string[] }

const LICENCE_LINE = 'Personal use only. Not for release or sale. lyrical may carry an inaudible provenance mark.'
const REROLL_CLOSED = 'The re-roll window for this song has closed. Make it again to start fresh.'
const NOT_MADE = 'We could not make this one. It has not counted against your tracks. Make it again to start fresh.'
const OUT_OF_TRACKS = 'You are out of tracks for this period. Upgrade, buy a Single, or wait for it to renew.'
const EMPTY = 'Nothing here yet. Pick a plan and make your first track.'
/** Statuses that are still moving, the ones JobStatus pulses. Everything else has an ending. */
const LIVE_STATUSES = new Set(['submitted', 'approved', 'in_progress'])

export default async function Studio({ searchParams }: { searchParams: Promise<{ submitted?: string; paid?: string }> }) {
  const [user, params] = await Promise.all([currentUser(), searchParams])
  if (!user) redirect('/studio/sign-in?next=/studio')

  const supabase = await supabaseServer()
  const [{ data: jobRows }, { data: feedbackRows }, entitlement] = await Promise.all([
    supabase.from('song_jobs')
      .select('id, title, primary_artist, source_language, target_language, status, created_at, lyrics, parent_job_id, reroll_index, licence_terms_version')
      .order('created_at', { ascending: false }),
    supabase.from('job_feedback').select('job_id, rating, note, tags'),
    getEntitlementFor(user.id),
  ])
  const jobs = (jobRows ?? []) as Job[]
  const feedback = new Map(((feedbackRows ?? []) as Feedback[]).map((f) => [f.job_id, f]))
  const originals = jobs.filter((j) => j.reroll_index === 0)
  const childrenOf = (id: string) => jobs.filter((j) => j.parent_job_id === id).sort((a, b) => a.reroll_index - b.reroll_index)
  // "Your song is being made now": ONLY the signed-in user's own rows can say so, because this
  // is read with the user's client under RLS, never the worker_heartbeat table (that told you
  // the WORKER was alive, not whether YOUR song was the thing it was working on).
  const inProgress = jobs.some((j) => j.status === 'in_progress')
  const existing = (id: string): ExistingFeedback => {
    const f = feedback.get(id)
    return f ? { rating: f.rating, note: f.note, tags: f.tags ?? [] } : null
  }
  const plan = entitlement.ok ? planById(entitlement.plan) : null
  const renews = entitlement.ok && entitlement.renewsAt
    ? new Date(entitlement.renewsAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
    : null

  /** A self-serve original that failed at our end: not a child, and it carries the licence version. */
  const notMade = (j: Job) => j.status === 'rejected' && !j.parent_job_id && j.reroll_index === 0 && !!j.licence_terms_version

  const take = (j: Job, left: number, n?: number) => (
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
          <FeedbackBar jobId={j.id} existing={existing(j.id)} rerollsLeft={left} canReroll />
        </>
      )}
      {n && j.status === 'rejected' ? <p className="mt-3 font-product text-sm text-dark-ink/70">{REROLL_CLOSED}</p> : null}
      {notMade(j) ? <p className="mt-3 font-product text-sm text-dark-ink/70">{NOT_MADE}</p> : null}
    </div>
  )

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHead title="Your songs." lead={<>Signed in as {user.email}</>} />

      {/* The plan card. Billing lives at /studio/billing; this is the only link to it. */}
      <Panel title={entitlement.ok ? 'Your plan' : 'No plan yet'}>
        {entitlement.ok ? (
          <>
            <div className="flex flex-wrap gap-2">
              <StatChip label="Plan" value={plan?.name ?? 'Single'} />
              <StatChip label="Tracks left" value={entitlement.tracksLeft} tone={entitlement.tracksLeft === 0 ? 'action' : 'neutral'} />
              {renews ? <StatChip label="Renews" value={renews} /> : null}
            </div>
            <a href="/studio/billing" className={`mt-4 inline-block ${link}`}>Manage plan</a>
          </>
        ) : (
          <>
            <p className="font-product text-sm leading-relaxed text-dark-ink/70">{entitlement.reason === 'period_exhausted' ? OUT_OF_TRACKS : EMPTY}</p>
            <a href="/pricing" className={`mt-4 ${button.primary}`}>See plans<span className="shift-arrow">&rarr;</span></a>
          </>
        )}
      </Panel>

      {inProgress && (
        <p className="flex items-center gap-2 font-product text-xs text-dark-ink/50">
          <span aria-hidden="true" className="status-dot bg-dark-accent" data-live="true" />
          Your song is being made now.
        </p>
      )}

      {(params.submitted || params.paid) && (
        <Notice>
          {params.paid
            ? 'Paid. Your plan is live.'
            : `That is with us and we are making it now, ${TURNAROUND_PROMISE}, ${TURNAROUND_BUSY}. It will appear below the moment it is ready.`}
        </Notice>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {entitlement.ok && (
          <a href="/studio/new" className={button.primary}>
            {originals.length ? 'Make another track' : 'Make your first track'}<span className="shift-arrow">&rarr;</span>
          </a>
        )}
        <a href="/studio/voices/new" className={button.ghost}>Build a voice model</a>
        <a href="/studio/voices" className={link}>Voice models</a>
      </div>

      {originals.length > 0 && (
        <ul className="flex flex-col gap-4">
          <StudioAutoRefresh active={jobs.some((j) => j.status !== 'delivered' && j.status !== 'rejected')} />
          {originals.map((j) => {
            const kids = childrenOf(j.id)
            const left = rerollsLeft(kids.length)
            return (
              <Panel as="li" key={j.id}>
                <h2 className="font-brand text-lg font-semibold leading-tight text-dark-ink">{j.title}</h2>
                <p className="mt-1 font-product text-xs text-dark-ink/55">{j.primary_artist} &middot; {j.source_language} to {j.target_language}</p>
                <div className="mt-4">{take(j, left)}</div>
                {kids.map((k) => take(k, left, k.reroll_index + 1))}
                <LyricsEditor jobId={j.id} initial={j.lyrics ?? ''} locked={j.status !== 'submitted'} />
              </Panel>
            )
          })}
        </ul>
      )}
      <Scorecard />
    </div>
  )
}
