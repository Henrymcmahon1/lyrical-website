import { redirect } from 'next/navigation'
import { Scorecard } from '@/components/Scorecard'
import { type ExistingFeedback } from '@/components/FeedbackBar'
import { StudioAutoRefresh } from '@/components/StudioAutoRefresh'
import { SongCard, type SongJob } from '@/components/studio/SongCard'
import { Notice, PageHead, Panel, StatChip, button, link } from '@/components/studio/ui'
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
 * Each song is a collapsible SongCard (components/studio/SongCard.tsx): the summary that stays
 * visible is title, artist, language pair, status and date, so a customer checking on their
 * songs is not confronted with a wall of every take's player and feedback bar at once.
 *
 * Drawn in the dashboard's panel language (components/studio/ui.tsx): the plan is a row of
 * StatChips, each song a SongCard. Sign out lives in the shell's rail (app/studio/layout.tsx),
 * so it is not repeated here. Plan names come from lib/plans.ts and are never typed here.
 */
export const metadata = { title: 'The studio', robots: { index: false, follow: false } }

type Job = SongJob
type Feedback = { job_id: string; rating: 'up' | 'down'; note: string | null; tags: string[] }

const OUT_OF_TRACKS = 'You are out of tracks for this period. Upgrade, buy a Single, or wait for it to renew.'
const EMPTY = 'Nothing here yet. Pick a plan and make your first track.'

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
          {/* originals is sorted newest first (the query orders by created_at descending), so
              index 0 is the most recent song: the one convenient to leave open. */}
          {originals.map((j, i) => {
            const kids = childrenOf(j.id)
            const left = rerollsLeft(kids.length)
            return (
              <li key={j.id}>
                <SongCard original={j} kids={kids} left={left} existing={existing} defaultOpen={i === 0} />
              </li>
            )
          })}
        </ul>
      )}
      <Scorecard />
    </div>
  )
}
