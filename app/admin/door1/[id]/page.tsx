import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin-session'
import {
  DOOR1,
  DOOR1_DELIVERY_KINDS,
  DOOR1_FORMAT_LABEL,
  DOOR1_KIND_LABEL,
  type Door1DeliveryKind,
} from '@/lib/door1-schema'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requeueJob } from '../../actions'
import { Door1Head, SHELL, day, formatBytes, languageName, refusedView, stateLabel, when } from '../shared'

/**
 * One Door 1 job: its details, its source, and the three delivered stems.
 *
 * Each stem links to `/admin/door1/download?delivery=<id>`, which mints a 60 second signed URL
 * after `requireAdmin()`. No signed URL and no storage path is ever written into this page.
 * A stem whose `purged_at` is set (7 days after delivery) reads "Purged": the masters remain on
 * the OptiPlex.
 */
export const metadata: Metadata = {
  title: 'Door 1 job',
  robots: { index: false, follow: false, nocache: true },
}
export const dynamic = 'force-dynamic'

const JOB_COLUMNS = [
  'id',
  'created_at',
  'title',
  'primary_artist',
  'source_language',
  'target_language',
  'lyrics',
  'notes',
  'status',
  'approved_at',
  'delivered_at',
  'pipeline_state',
  'pipeline_error',
  'pipeline_voice_model',
  'delivery_profile',
  'door1_enquiry_id',
  'door1_source_url',
  'door1_settings',
  'door1_due_on',
].join(', ')

type Job = {
  id: string
  created_at: string
  title: string
  primary_artist: string
  source_language: string
  target_language: string
  lyrics: string | null
  notes: string | null
  status: string
  approved_at: string | null
  delivered_at: string | null
  pipeline_state: string | null
  pipeline_error: string | null
  pipeline_voice_model: string | null
  delivery_profile: string
  door1_enquiry_id: string | null
  door1_source_url: string | null
  door1_settings: { vocal_denoise?: boolean; restore_mode?: string } | null
  door1_due_on: string | null
}

type Delivery = { id: string; kind: string; filename: string; bytes: number; created_at: string; purged_at: string | null }
type Asset = { id: string; filename: string; bytes: number; purged_at: string | null }
type Enquiry = { id: string; name: string; company: string | null; rel_status: string | null }

export default async function Door1Job({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ created?: string }>
}) {
  const [admin, { id }, query] = await Promise.all([requireAdmin(), params, searchParams])
  const refused = refusedView(admin)
  if (refused) return refused

  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const db = supabaseAdmin()
  const { data: jobData } = await db.from('song_jobs').select(JOB_COLUMNS).eq('id', id).maybeSingle()
  const job = jobData as unknown as Job | null
  // Door 1 only: a Door 2 job id shows nothing here.
  if (!job || job.delivery_profile !== DOOR1) notFound()

  const [deliveryResult, assetResult, enquiryResult] = await Promise.all([
    db
      .from('song_job_deliveries')
      .select('id, kind, filename, bytes, created_at, purged_at')
      .eq('job_id', job.id),
    db.from('song_job_assets').select('id, filename, bytes, purged_at').eq('job_id', job.id),
    job.door1_enquiry_id
      ? db.from('enquiries').select('id, name, company, rel_status').eq('id', job.door1_enquiry_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const deliveries = (deliveryResult.data ?? []) as Delivery[]
  const assets = (assetResult.data ?? []) as Asset[]
  const enquiry = enquiryResult.data as Enquiry | null

  const byKind = new Map<string, Delivery>()
  for (const d of deliveries) byKind.set(d.kind, d)

  const state = stateLabel(job.status, job.pipeline_state)
  const settings = job.door1_settings ?? {}

  return (
    <section className={`${SHELL} py-16`}>
      <Door1Head title={job.title} lead={job.primary_artist} />

      {query.created === '1' && (
        <p role="status" className="mt-6 text-sm text-graphite/70">
          Created and queued. The render PC picks it up on its next poll.
        </p>
      )}

      <p className="mt-6 flex flex-wrap items-baseline gap-x-3">
        <span className={`font-mono text-[11px] uppercase tracking-[0.16em] ${state.className}`}>{state.label}</span>
        {job.pipeline_state && (
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-graphite/40">
            pipeline: {job.pipeline_state}
          </span>
        )}
      </p>

      {job.pipeline_error && (
        <p className="mt-4 max-w-2xl rounded-card border border-ember/40 p-3 text-sm text-ember">
          Pipeline error: {job.pipeline_error}
        </p>
      )}

      {job.status === 'rejected' && (
        <form action={requeueJob} className="mt-4">
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

      <h2 className="mt-12 font-brand text-2xl tracking-tight">Stems</h2>
      <p className="mt-2 text-sm text-graphite/60">
        {DOOR1_FORMAT_LABEL}. Each link lives 60 seconds. Files are purged 7 days after delivery; the 24-bit WAV
        masters stay on the render PC.
      </p>
      <ul className="mt-4 flex flex-col gap-2">
        {DOOR1_DELIVERY_KINDS.map((kind: Door1DeliveryKind) => {
          const d = byKind.get(kind)
          return (
            <li key={kind} className="flex flex-wrap items-baseline gap-x-3 text-sm">
              <span className="w-28 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/45">
                {DOOR1_KIND_LABEL[kind]}
              </span>
              {!d ? (
                <span className="text-graphite/40">Not delivered yet</span>
              ) : d.purged_at ? (
                <span className="text-graphite/50">Purged {when(d.purged_at)} (masters remain on the OptiPlex)</span>
              ) : (
                <>
                  <a
                    href={`/admin/door1/download?delivery=${d.id}`}
                    className="text-indigo underline underline-offset-4"
                  >
                    Download {DOOR1_KIND_LABEL[kind].toLowerCase()}
                  </a>
                  <span className="font-mono text-[11px] text-graphite/45">
                    {DOOR1_FORMAT_LABEL}, {formatBytes(d.bytes)}
                  </span>
                </>
              )}
            </li>
          )
        })}
      </ul>

      <h2 className="mt-12 font-brand text-2xl tracking-tight">Details</h2>
      <dl className="mt-4 grid max-w-2xl grid-cols-[10rem_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-graphite/50">Artist</dt>
        <dd>
          {job.primary_artist}
          {enquiry && (
            <>
              {' '}
              <a
                href={`/admin?tab=relationships&show=all#enquiry-${enquiry.id}`}
                className="text-indigo underline underline-offset-4"
              >
                CRM: {enquiry.name}
                {enquiry.company ? `, ${enquiry.company}` : ''}
                {enquiry.rel_status ? ` (${enquiry.rel_status})` : ''}
              </a>
            </>
          )}
        </dd>
        <dt className="text-graphite/50">Languages</dt>
        <dd>
          {languageName(job.source_language)} to {languageName(job.target_language)}
        </dd>
        <dt className="text-graphite/50">Voice model</dt>
        <dd>{job.pipeline_voice_model ?? 'None (zero-shot)'}</dd>
        <dt className="text-graphite/50">Restore mode</dt>
        <dd>{settings.restore_mode ?? 'default'}</dd>
        <dt className="text-graphite/50">Vocal denoise</dt>
        <dd>{settings.vocal_denoise === false ? 'Off' : 'On'}</dd>
        <dt className="text-graphite/50">Source</dt>
        <dd>
          {job.door1_source_url ? (
            <a href={job.door1_source_url} target="_blank" rel="noreferrer" className="text-indigo underline underline-offset-4">
              Qobuz link
            </a>
          ) : assets.length ? (
            assets.map((a) =>
              a.purged_at ? (
                <span key={a.id} className="text-graphite/50">
                  {a.filename} (removed after delivery)
                </span>
              ) : (
                <a
                  key={a.id}
                  href={`/admin/audio?asset=${a.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo underline underline-offset-4"
                >
                  {a.filename} ({formatBytes(a.bytes)})
                </a>
              ),
            )
          ) : (
            <span className="text-graphite/50">Uploaded full mix (removed after delivery)</span>
          )}
        </dd>
        <dt className="text-graphite/50">Due</dt>
        <dd>{job.door1_due_on ? day(job.door1_due_on) : 'Not set'}</dd>
        <dt className="text-graphite/50">Created</dt>
        <dd>{when(job.created_at)}</dd>
        <dt className="text-graphite/50">Delivered</dt>
        <dd>{job.delivered_at ? when(job.delivered_at) : 'Not yet'}</dd>
      </dl>

      {job.notes && (
        <>
          <h2 className="mt-12 font-brand text-2xl tracking-tight">Internal notes</h2>
          <p className="mt-3 max-w-2xl whitespace-pre-line text-graphite/80">{job.notes}</p>
        </>
      )}

      {job.lyrics && (
        <details className="mt-8 max-w-2xl">
          <summary className="inline-flex min-h-11 cursor-pointer items-center font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/50 hover:text-indigo">
            Lyrics (reference only)
          </summary>
          <pre
            dir="auto"
            className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-card border border-graphite/15 p-4 font-mono text-sm leading-relaxed text-graphite/80"
          >
            {job.lyrics}
          </pre>
        </details>
      )}
    </section>
  )
}
