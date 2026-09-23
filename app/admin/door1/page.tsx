import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/admin-session'
import { DOOR1 } from '@/lib/door1-schema'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requeueJob } from '../actions'
import { Door1Head, SHELL, day, languageName, refusedView, stateLabel, when } from './shared'

/**
 * `/admin/door1`: every Door 1 job, newest first. Door 1 rows only (`delivery_profile='door1'`).
 *
 * Staff only, service-role reads, explicit columns (never `*`). `pipeline_error` is shown on
 * purpose: staff need to see why the render PC stopped. A failed job offers the existing admin
 * re-queue action, posted with `back=door1` so it returns here.
 */
export const metadata: Metadata = {
  title: 'Door 1',
  robots: { index: false, follow: false, nocache: true },
}
export const dynamic = 'force-dynamic'

const DOOR1_LIST_COLUMNS = [
  'id',
  'created_at',
  'title',
  'primary_artist',
  'source_language',
  'target_language',
  'pipeline_voice_model',
  'door1_due_on',
  'status',
  'pipeline_state',
  'pipeline_error',
  'delivered_at',
].join(', ')

type Row = {
  id: string
  created_at: string
  title: string
  primary_artist: string
  source_language: string
  target_language: string
  pipeline_voice_model: string | null
  door1_due_on: string | null
  status: string
  pipeline_state: string | null
  pipeline_error: string | null
  delivered_at: string | null
}

export default async function Door1Jobs({
  searchParams,
}: {
  searchParams: Promise<{ moved?: string; error?: string }>
}) {
  const [admin, params] = await Promise.all([requireAdmin(), searchParams])
  const refused = refusedView(admin)
  if (refused) return refused

  const { data, error } = await supabaseAdmin()
    .from('song_jobs')
    .select(DOOR1_LIST_COLUMNS)
    .eq('delivery_profile', DOOR1)
    .order('created_at', { ascending: false })
    .limit(200)

  const jobs = (data ?? []) as unknown as Row[]

  return (
    <section className={`${SHELL} py-16`}>
      <Door1Head
        title="Door 1"
        lead="Artist jobs made in-house: full quality, no watermark, delivered as 24-bit FLAC stems."
      />

      <p className="mt-6">
        <a
          href="/admin/door1/new"
          className="nudge inline-flex min-h-11 items-center rounded-card bg-indigo px-6 text-cream"
        >
          New Door 1 job
        </a>
      </p>

      {params.moved === 'requeued' && (
        <p role="status" className="mt-6 text-sm text-graphite/70">
          Sent back through the pipeline. The poller will pick it up.
        </p>
      )}
      {params.error === 'stale' && (
        <p role="status" className="mt-6 text-sm text-ember">
          That job had already moved, so nothing was changed.
        </p>
      )}
      {params.error === 'move' && (
        <p role="status" className="mt-6 text-sm text-ember">
          Only a failed job can be re-queued.
        </p>
      )}

      {error ? (
        <p className="mt-12 max-w-xl text-graphite/70">
          Door 1 jobs cannot be read yet. Apply{' '}
          <code className="font-mono text-sm">supabase/migrations/007_door1.sql</code> and reload.
          <span className="mt-3 block font-mono text-xs text-graphite/50">{error.message}</span>
        </p>
      ) : jobs.length === 0 ? (
        <p className="mt-12 text-graphite/60">No Door 1 jobs yet.</p>
      ) : (
        <ol className="mt-8">
          {jobs.map((job) => {
            const state = stateLabel(job.status, job.pipeline_state)
            return (
              <li key={job.id} className="border-b border-graphite/12 py-6">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="font-brand text-2xl tracking-tight">
                    <a href={`/admin/door1/${job.id}`} className="hover:text-indigo">
                      {job.title}
                    </a>
                  </h2>
                  <span className="text-graphite/60">{job.primary_artist}</span>
                  <span className={`font-mono text-[10px] uppercase tracking-[0.16em] ${state.className}`}>
                    {state.label}
                  </span>
                  {job.pipeline_state && (
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-graphite/40">
                      pipeline: {job.pipeline_state}
                    </span>
                  )}
                </div>

                <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/50">
                  <div>
                    <dt className="sr-only">Languages</dt>
                    <dd>
                      {languageName(job.source_language)} to {languageName(job.target_language)}
                    </dd>
                  </div>
                  <div>
                    <dt className="sr-only">Voice</dt>
                    <dd>voice: {job.pipeline_voice_model ?? 'zero-shot'}</dd>
                  </div>
                  {job.door1_due_on && (
                    <div>
                      <dt className="sr-only">Due</dt>
                      <dd>due {day(job.door1_due_on)}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="sr-only">Created</dt>
                    <dd>created {when(job.created_at)}</dd>
                  </div>
                  {job.delivered_at && (
                    <div>
                      <dt className="sr-only">Delivered</dt>
                      <dd>delivered {when(job.delivered_at)}</dd>
                    </div>
                  )}
                </dl>

                {job.pipeline_error && (
                  <p className="mt-4 max-w-2xl rounded-card border border-ember/40 p-3 text-sm text-ember">
                    Pipeline error: {job.pipeline_error}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <a
                    href={`/admin/door1/${job.id}`}
                    className="inline-flex min-h-11 items-center text-sm text-indigo underline underline-offset-4"
                  >
                    {job.status === 'delivered' ? 'Stems and details' : 'Details'}
                  </a>
                  {job.status === 'rejected' && (
                    <form action={requeueJob}>
                      <input type="hidden" name="id" value={job.id} />
                      <input type="hidden" name="from" value="rejected" />
                      <input type="hidden" name="back" value="door1" />
                      <button
                        type="submit"
                        className="inline-flex min-h-11 items-center rounded-card border border-graphite/25 px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/60 transition-colors hover:border-indigo hover:text-indigo"
                      >
                        Re-queue
                      </button>
                    </form>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
