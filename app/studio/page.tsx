import { redirect } from 'next/navigation'
import { JobStatus } from '@/components/JobStatus'
import { LyricsEditor } from '@/components/LyricsEditor'
import { Scorecard } from '@/components/Scorecard'
import { CoverPlayer } from '@/components/CoverPlayer'
import { FeedbackBar, type ExistingFeedback } from '@/components/FeedbackBar'
import { StudioAutoRefresh } from '@/components/StudioAutoRefresh'
import { rerollsLeft } from '@/lib/entitlement'
import { getEntitlementFor } from '@/lib/entitlement-db'
import { planById } from '@/lib/plans'
import { currentUser, supabaseServer } from '@/lib/supabase-server'
import { signOut } from './actions'

/**
 * The Door-2 studio: plan card, then the songs, re-rolls nested under their original.
 * Every read is the USER's client: RLS decides the rows, the column grant decides the columns,
 * so the select lists are explicit and never `*`. A child's `pipeline_error` is service-role
 * only; the closed-window copy keys off `status='rejected'` on a child instead.
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
const OUT_OF_TRACKS = 'You are out of tracks for this period. Upgrade, buy a Single, or wait for it to renew.'
const EMPTY = 'Nothing here yet. Pick a plan and make your first track.'
const HEARTBEAT_STALE_MS = 10 * 60 * 1000
const cta = 'nudge inline-flex items-center gap-1.5 rounded-card bg-ember px-6 py-3 text-cream'
const link = 'text-sm text-indigo underline underline-offset-4'

export default async function Studio({ searchParams }: { searchParams: Promise<{ submitted?: string; paid?: string }> }) {
  const [user, params] = await Promise.all([currentUser(), searchParams])
  if (!user) redirect('/studio/sign-in?next=/studio')

  const supabase = await supabaseServer()
  const [{ data: jobRows }, { data: feedbackRows }, { data: beat }, entitlement] = await Promise.all([
    supabase.from('song_jobs')
      .select('id, title, primary_artist, source_language, target_language, status, created_at, lyrics, parent_job_id, reroll_index, licence_terms_version')
      .order('created_at', { ascending: false }),
    supabase.from('job_feedback').select('job_id, rating, note, tags'),
    supabase.from('worker_heartbeat').select('worker, seen_at').order('seen_at', { ascending: false }).limit(1),
    getEntitlementFor(user.id),
  ])
  const jobs = (jobRows ?? []) as Job[]
  const feedback = new Map(((feedbackRows ?? []) as Feedback[]).map((f) => [f.job_id, f]))
  const originals = jobs.filter((j) => j.reroll_index === 0)
  const childrenOf = (id: string) => jobs.filter((j) => j.parent_job_id === id).sort((a, b) => a.reroll_index - b.reroll_index)
  const seen = beat?.[0]?.seen_at ? Date.parse(beat[0].seen_at as string) : 0
  const rendering = seen > 0 && Date.now() - seen < HEARTBEAT_STALE_MS
  const existing = (id: string): ExistingFeedback => {
    const f = feedback.get(id)
    return f ? { rating: f.rating, note: f.note, tags: f.tags ?? [] } : null
  }
  const plan = entitlement.ok ? planById(entitlement.plan) : null

  const take = (j: Job, left: number, n?: number) => (
    <div key={j.id} className={n ? 'mt-4 rounded-card border border-graphite/12 bg-cream/60 p-5' : ''}>
      {n ? <span className="font-mono text-xs tracking-[0.18em] text-graphite/45">Take {n}</span> : null}
      <div className="mt-2"><JobStatus status={j.status} /></div>
      {j.status === 'delivered' && (
        <>
          <CoverPlayer jobId={j.id} />
          <p className="mt-3 text-xs leading-relaxed text-graphite/55">{LICENCE_LINE}</p>
          <FeedbackBar jobId={j.id} existing={existing(j.id)} rerollsLeft={left} canReroll />
        </>
      )}
      {n && j.status === 'rejected' ? <p className="mt-3 text-sm text-graphite/70">{REROLL_CLOSED}</p> : null}
    </div>
  )

  return (
    <section className="mx-auto max-w-3xl px-6 py-24 sm:py-28">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <span className="font-mono text-xs tracking-[0.18em] text-graphite/45">The studio</span>
          <h1 className="mt-5 font-brand text-4xl leading-[1.1] tracking-tight text-balance">Your songs.</h1>
        </div>
        <form action={signOut}>
          <button type="submit" className="nudge inline-flex min-h-11 items-center text-sm text-graphite/60 underline underline-offset-4">Sign out</button>
        </form>
      </div>
      <p className="mt-4 text-sm text-graphite/55">Signed in as {user.email}</p>

      {/* The plan card. Billing lives at /studio/billing (Bot A); this is the only link to it. */}
      <div className="mt-8 rounded-card border border-graphite/15 p-6">
        {entitlement.ok ? (
          <>
            <span className="font-brand text-xl tracking-tight">{plan?.name ?? 'Single'}</span>
            <p className="mt-1 text-sm text-graphite/70">
              {entitlement.tracksLeft} {entitlement.tracksLeft === 1 ? 'track' : 'tracks'} left
              {entitlement.renewsAt ? ` · renews ${new Date(entitlement.renewsAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}` : ''}
            </p>
            <a href="/studio/billing" className={`mt-3 inline-block ${link}`}>Manage plan</a>
          </>
        ) : (
          <>
            <span className="font-brand text-xl tracking-tight">No plan yet</span>
            <p className="mt-1 text-sm text-graphite/70">{entitlement.reason === 'period_exhausted' ? OUT_OF_TRACKS : EMPTY}</p>
            <a href="/pricing" className={`mt-4 ${cta}`}>See plans<span className="shift-arrow">&rarr;</span></a>
          </>
        )}
        <p className="mt-4 text-xs text-graphite/50">
          {rendering ? 'Renders are running.' : 'Renders are paused, your song will start when they resume.'}
        </p>
      </div>

      {(params.submitted || params.paid) && (
        <p role="status" className="mt-8 rounded-card border-l-[3px] border-indigo bg-indigo/5 px-5 py-4 leading-relaxed">
          {params.paid ? 'Paid. Your plan is live.' : 'That is with us and we are making it now. It will appear below the moment it is ready.'}
        </p>
      )}
      {entitlement.ok && (
        <a href="/studio/new" className={`mt-8 flex w-fit px-7 py-4 ${cta}`}>
          {originals.length ? 'Make another track' : 'Make your first track'}<span className="shift-arrow">&rarr;</span>
        </a>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
        <a href="/studio/voices/new" className="nudge inline-flex min-h-11 items-center rounded-card border border-graphite/25 px-5 text-sm hover:border-indigo hover:text-indigo">Build a voice model</a>
        <a href="/studio/voices" className={`nudge inline-flex min-h-11 items-center ${link}`}>Voice models</a>
      </div>

      {originals.length > 0 && (
        <ul className="mt-12 flex flex-col gap-5">
          <StudioAutoRefresh active={jobs.some((j) => j.status !== 'delivered' && j.status !== 'rejected')} />
          {originals.map((j) => {
            const kids = childrenOf(j.id)
            const left = rerollsLeft(kids.length)
            return (
              <li key={j.id} className="rounded-card border border-graphite/15 p-6">
                <span className="font-brand text-xl tracking-tight">{j.title}</span>
                <p className="mt-1 text-sm text-graphite/60">{j.primary_artist} &middot; {j.source_language} to {j.target_language}</p>
                <div className="mt-4">{take(j, left)}</div>
                {kids.map((k) => take(k, left, k.reroll_index + 1))}
                <LyricsEditor jobId={j.id} initial={j.lyrics ?? ''} locked={j.status !== 'submitted'} />
              </li>
            )
          })}
        </ul>
      )}
      <Scorecard />
    </section>
  )
}
