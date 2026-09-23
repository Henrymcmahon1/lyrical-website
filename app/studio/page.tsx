import { redirect } from 'next/navigation'
import { Scorecard } from '@/components/Scorecard'
import { type ExistingFeedback } from '@/components/FeedbackBar'
import { StudioAutoRefresh } from '@/components/StudioAutoRefresh'
import { SongCard, type SongJob } from '@/components/studio/SongCard'
import { Notice, PageHead, button, link } from '@/components/studio/ui'
import { rerollsLeft } from '@/lib/entitlement'
import { isFeedbackRating } from '@/lib/feedback-schema'
import { currentUser, supabaseServer } from '@/lib/supabase-server'
import { TURNAROUND_BUSY, TURNAROUND_PROMISE } from '@/lib/turnaround'

/**
 * The Door-2 studio: the songs, re-rolls nested under their original.
 * Every read is the USER's client: RLS decides the rows, the column grant decides the columns,
 * so the select lists are explicit and never `*`. A child's `pipeline_error` is service-role
 * only; the closed-window copy keys off `status='rejected'` on a child instead.
 *
 * Each song is a collapsible SongCard (components/studio/SongCard.tsx): the summary that stays
 * visible is title, artist, language pair, status and date, so a customer checking on their
 * songs is not confronted with a wall of every take's player and feedback bar at once.
 *
 * The plan card lives on /studio/new (components/studio/PlanCard.tsx) now, not here: that is the
 * moment a customer is about to spend a track, so that is where "how many are left" needs to be
 * unmissable. This page therefore never reads entitlement at all, and the make-a-track CTA is
 * always offered; a customer with no plan is caught by the redirect already on /studio/new.
 * Sign out lives in the shell's rail (app/studio/layout.tsx), so it is not repeated here.
 */
export const metadata = { title: 'The studio', robots: { index: false, follow: false } }


export default async function Studio({ searchParams }: { searchParams: Promise<{ submitted?: string; paid?: string }> }) {
  const [user, params] = await Promise.all([currentUser(), searchParams])
  if (!user) redirect('/studio/sign-in?next=/studio')

  const supabase = await supabaseServer()
  const [{ data: jobRows }, { data: feedbackRows }] = await Promise.all([
    supabase.from('song_jobs')
      .select('id, title, primary_artist, source_language, target_language, status, created_at, lyrics, parent_job_id, reroll_index, licence_terms_version')
      // Door 1 jobs are owned by info@'s uid, so RLS alone would list them here. Never.
      .neq('delivery_profile', 'door1')
      .order('created_at', { ascending: false }),
    supabase.from('job_feedback').select('job_id, rating, note, tags'),
  ])
  const jobs: SongJob[] = jobRows ?? []
  const feedback = new Map((feedbackRows ?? []).map((f) => [f.job_id, f]))
  const originals = jobs.filter((j) => j.reroll_index === 0)
  const childrenOf = (id: string) => jobs.filter((j) => j.parent_job_id === id).sort((a, b) => a.reroll_index - b.reroll_index)
  // "Your song is being made now": ONLY the signed-in user's own rows can say so, because this
  // is read with the user's client under RLS, never the worker_heartbeat table (that told you
  // the WORKER was alive, not whether YOUR song was the thing it was working on).
  const inProgress = jobs.some((j) => j.status === 'in_progress')
  // A plain, serializable map (job id -> feedback) for the client SongCard. A FUNCTION prop cannot
  // cross the server/client component boundary: doing so 500s the whole page ("Functions cannot be
  // passed directly to Client Components"). So the values are resolved here and handed over as data.
  const existingById: Record<string, ExistingFeedback> = {}
  for (const [id, f] of feedback) {
    // The CHECK allows only up/down; a row that somehow is neither is not shown as either.
    if (isFeedbackRating(f.rating)) existingById[id] = { rating: f.rating, note: f.note, tags: f.tags ?? [] }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHead title="Your songs." lead={<>Signed in as {user.email}</>} />

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
        {/* Always offered: a customer with no plan is caught by the redirect already on
            /studio/new (see app/studio/new/page.tsx), so this page does not need to know
            entitlement to decide whether to show the button. */}
        <a href="/studio/new" className={button.primary}>
          {originals.length ? 'Make another track' : 'Make your first track'}<span className="shift-arrow">&rarr;</span>
        </a>
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
                <SongCard original={j} kids={kids} left={left} existing={existingById} defaultOpen={i === 0} />
              </li>
            )
          })}
        </ul>
      )}
      <Scorecard />
    </div>
  )
}
