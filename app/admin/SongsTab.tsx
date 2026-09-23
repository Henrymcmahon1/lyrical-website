import {
  ALLOWED_MOVES,
  MOVE_LABELS,
  OPEN_STATUSES,
  clockNow,
  timeLeft,
} from '@/lib/job-transitions'
import { isGuaranteed, TURNAROUND_HOURS } from '@/lib/language-pairs'
import { lyricStats } from '@/lib/lyrics'
import { languageByCode, type LanguageCode } from '@/lib/languages'
import type { JobStatus } from '@/lib/song-job-schema'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { moveJob, requeueJob, saveNote } from './actions'

/**
 * The Work tab: every song job, staff-only fields included.
 *
 * This is the half of the console that did not exist before `/queue`, and its absence was the
 * hole: a customer could submit a master and nothing could move it past "Received", so the
 * status rail they were shown was a rail with no driver. It has since grown to cover the
 * automated Door-2 pipeline too: `pipeline_state`/`pipeline_error` (staff-only, service-role
 * only) for what the render worker is doing and why it stopped, and re-roll families
 * (`parent_job_id`/`reroll_index`) nested under their original.
 *
 * Everything here reads with `supabaseAdmin()`, the service role client, which bypasses RLS.
 * That is correct for a staff path and is the opposite of `app/studio/`, which uses the
 * customer's own session so the policies decide what comes back. Mixing them up in either
 * direction is the serious mistake available in this file.
 *
 * Column list is explicit, never `select('*')`: `pipeline_error` is a staff-only column by
 * column-level grant, and naming every column here is what keeps a future new column from
 * showing up in this staff view (or not) by accident rather than by a decision made here.
 */

const JOB_COLUMNS = [
  'id',
  'created_at',
  'user_id',
  'title',
  'primary_artist',
  'source_language',
  'target_language',
  'notes',
  'status',
  'approved_at',
  'delivered_at',
  'internal_notes',
  'lyrics',
  'voice_id',
  'voice_preference',
  'pipeline_state',
  'pipeline_error',
  'parent_job_id',
  'reroll_index',
  'delivery_profile',
].join(', ')

type Job = {
  id: string
  created_at: string
  user_id: string
  title: string
  primary_artist: string
  source_language: string
  target_language: string
  notes: string | null
  status: string
  approved_at: string | null
  delivered_at: string | null
  internal_notes: string | null
  lyrics: string | null
  voice_id: string | null
  voice_preference: string | null
  pipeline_state: string | null
  pipeline_error: string | null
  parent_job_id: string | null
  reroll_index: number
  /** `door1` for a staff-made Door 1 job (managed at /admin/door1); `door2` otherwise. */
  delivery_profile?: string | null
}

const VOICE_PREFERENCE_LABEL: Record<string, string> = {
  male: 'a male voice',
  female: 'a female voice',
  let_us_decide: 'let us decide',
}

type Asset = {
  id: string
  job_id: string
  kind: string
  artist_name: string | null
  part: string | null
  filename: string
  bytes: number
  purged_at: string | null
}

type Delivery = {
  id: string
  job_id: string
  kind: string
  watermark_id: number | null
  filename: string
  bytes: number
}

const KIND_LABEL: Record<string, string> = {
  instrumental: 'Instrumental',
  vocal: 'Vocal',
  full_mix: 'Full mix',
}

/** What staff see. Deliberately blunter than the customer wording in `JobStatus.tsx`. */
const STATE: Record<string, { label: string; className: string }> = {
  submitted: { label: 'Waiting on you', className: 'text-ember' },
  approved: { label: 'Accepted', className: 'text-indigo' },
  in_progress: { label: 'Being made', className: 'text-indigo' },
  delivered: { label: 'Delivered', className: 'text-graphite/45' },
  rejected: { label: 'Rejected', className: 'text-graphite/45' },
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 ** 3).toFixed(1)}GB`
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / 1024 ** 2)}MB`
  return `${Math.max(1, Math.round(bytes / 1024))}KB`
}

const languageName = (code: string) => languageByCode(code)?.english ?? code

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type RowData = {
  job: Job
  assets: Asset[]
  deliveries: Delivery[]
  email: string | undefined
  voice: { artist_name: string; status: string } | undefined
}

/** One job's row: the shared shape for a root job and for a re-roll nested under it. */
function JobRow({
  data,
  showAll,
  confirming,
  nowMs,
  isChild,
}: {
  data: RowData
  showAll: boolean
  confirming?: string
  nowMs: number
  isChild: boolean
}) {
  const { job, assets, deliveries, email, voice } = data
  const state = STATE[job.status] ?? { label: job.status, className: 'text-graphite/45' }
  const moves = ALLOWED_MOVES[job.status as JobStatus] ?? []
  const clock =
    job.approved_at && job.status !== 'delivered' ? timeLeft(job.approved_at, nowMs) : null
  const guaranteed = isGuaranteed(
    job.source_language as LanguageCode,
    job.target_language as LanguageCode,
  )
  // Only a job the customer has been told failed, and only through the button, guarded again
  // server-side in requeueJob. A job still mid-pipeline (pipeline_state failed but status not
  // yet flipped) is not offered the button: the poller or a human moves it to rejected first.
  const canRequeue = job.status === 'rejected'
  // Door 1 rows are listed here for the full picture but managed at /admin/door1: no move
  // buttons (a move here could email info@ as if it were a customer), lyrics and files optional.
  const door1 = job.delivery_profile === 'door1'
  // No turnaround promise runs on a Door 1 job (it has a due date instead, on its own page).
  const shownClock = door1 ? null : clock

  return (
    <li className={`border-b border-graphite/12 py-7 ${isChild ? 'pl-6' : ''}`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="font-brand text-2xl tracking-tight">
          {isChild ? `Take ${job.reroll_index + 1}: ` : ''}
          {job.title}
        </h3>
        <span className="text-graphite/60">{job.primary_artist}</span>
        {door1 && (
          <a
            href={`/admin/door1/${job.id}`}
            className="rounded-card border border-indigo/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-indigo"
          >
            Door 1
          </a>
        )}
        <span className={`font-mono text-[10px] uppercase tracking-[0.16em] ${state.className}`}>
          {state.label}
        </span>
        {job.pipeline_state && (
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-graphite/40">
            pipeline: {job.pipeline_state}
          </span>
        )}
        <time
          dateTime={job.created_at}
          className="ml-auto font-mono text-[11px] tabular-nums text-graphite/45"
        >
          {when(job.created_at)}
        </time>
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/50">
        <div>
          <dt className="sr-only">Language</dt>
          <dd>
            {languageName(job.source_language)} to {languageName(job.target_language)}
          </dd>
        </div>
        {job.voice_id && voice ? (
          <div>
            <dt className="sr-only">Voice</dt>
            <dd>
              voice: {voice.artist_name} ({voice.status})
            </dd>
          </div>
        ) : job.voice_preference ? (
          <div>
            <dt className="sr-only">Voice</dt>
            <dd>voice: {VOICE_PREFERENCE_LABEL[job.voice_preference] ?? job.voice_preference}</dd>
          </div>
        ) : null}
        <div>
          <dt className="sr-only">Sender</dt>
          <dd>
            {email ? (
              <a href={`mailto:${email}`} className="text-indigo hover:underline">
                {email}
              </a>
            ) : (
              'unknown sender'
            )}
          </dd>
        </div>
        {shownClock && (
          <div>
            <dt className="sr-only">Time left</dt>
            <dd className={shownClock.late ? 'text-ember' : 'text-graphite/50'}>{shownClock.text}</dd>
          </div>
        )}
      </dl>

      {job.pipeline_error && (
        <p className="mt-4 max-w-2xl rounded-card border border-ember/40 p-3 text-sm text-ember">
          Pipeline error: {job.pipeline_error}
        </p>
      )}

      {job.notes && (
        <p className="mt-4 max-w-2xl whitespace-pre-line leading-relaxed text-graphite/80">
          {job.notes}
        </p>
      )}

      {/*
        The lyric sheet, folded away.

        A native <details> rather than a JavaScript disclosure, so it works with the
        rest of this console if scripting is off, and so forty lines of someone else's
        unreleased words are not the first thing on screen when the queue loads.
      */}
      {job.lyrics ? (
        <details className="mt-4 max-w-2xl">
          <summary className="nudge inline-flex min-h-11 cursor-pointer list-none items-center font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/50 hover:text-indigo [&::-webkit-details-marker]:hidden">
            Lyrics, {lyricStats(job.lyrics).lines} lines
          </summary>
          <pre
            dir="auto"
            className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-card border border-graphite/15 p-4 font-mono text-sm leading-relaxed text-graphite/80"
          >
            {job.lyrics}
          </pre>
        </details>
      ) : !isChild && !door1 ? (
        /*
          Said plainly rather than left blank, on a root job only: a re-roll never carries its
          own lyrics (it reuses the parent's), so a bare child would otherwise show a false
          warning.
        */
        <p className="mt-4 text-sm text-ember">
          No lyrics. Ask for them before accepting: the translation is built from them.
        </p>
      ) : null}

      {/*
        The files, as links that sign on click.

        Each one points at /admin/audio with an ASSET ID. No signed URL is rendered
        into this page, so nothing here keeps working once the tab is closed, and a
        screenshot of this screen hands over nothing. See that route for the argument.
      */}
      <ul className="mt-4 flex flex-col gap-1.5">
        {assets.map((a) => (
          <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 text-sm">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/45">
              {KIND_LABEL[a.kind] ?? a.kind}
            </span>
            {a.purged_at ? (
              <span className="text-graphite/40">{a.filename} (purged)</span>
            ) : (
              <a
                href={`/admin/audio?asset=${a.id}`}
                target="_blank"
                rel="noreferrer"
                className="text-indigo underline underline-offset-4"
              >
                {a.filename}
              </a>
            )}
            <span className="text-graphite/45 tabular-nums">{formatBytes(a.bytes)}</span>
            {a.artist_name && <span className="text-graphite/55">{a.artist_name}</span>}
            {a.part && (
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/45">
                {a.part}
              </span>
            )}
          </li>
        ))}
        {!assets.length && !isChild && !door1 && (
          <li className="text-sm text-ember">No files attached. Do not accept this one.</li>
        )}
      </ul>

      {deliveries.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1.5">
          {deliveries.map((d) => (
            <li key={d.id} className="flex flex-wrap items-baseline gap-x-3 text-sm text-graphite/70">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/45">
                delivered: {d.kind}
              </span>
              <span>{d.filename}</span>
              <span className="tabular-nums text-graphite/45">{formatBytes(d.bytes)}</span>
              {d.watermark_id != null && (
                <span className="font-mono text-[11px] text-graphite/45">
                  watermark {d.watermark_id}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Staff note. Saved on submit, so it works without JavaScript. */}
      <form action={saveNote} className="mt-5 flex flex-wrap items-start gap-3">
        <input type="hidden" name="id" value={job.id} />
        <textarea
          name="note"
          rows={2}
          defaultValue={job.internal_notes ?? ''}
          placeholder="Internal note"
          className="min-h-11 w-full max-w-md rounded-card border border-graphite/20 bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-indigo"
        />
        <button
          type="submit"
          className="min-h-11 rounded-card border border-graphite/25 px-3 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/60 transition-colors hover:border-indigo hover:text-indigo"
        >
          Save note
        </button>
      </form>

      {door1 ? (
        <p className="mt-4">
          <a
            href={`/admin/door1/${job.id}`}
            className="inline-flex min-h-11 items-center font-mono text-[11px] uppercase tracking-[0.14em] text-indigo underline underline-offset-4"
          >
            Manage in Door 1
          </a>
        </p>
      ) : confirming === job.id ? (
        <div className="mt-4 rounded-card border border-ember/40 p-4">
          {canRequeue ? (
            <>
              <p className="text-sm text-graphite">
                Send {job.title} back through the pipeline? The poller will pick it up on its
                next pass.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <form action={requeueJob}>
                  <input type="hidden" name="id" value={job.id} />
                  <input type="hidden" name="from" value={job.status} />
                  <button
                    type="submit"
                    className="min-h-11 rounded-card bg-indigo px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-cream"
                  >
                    Yes, re-queue it
                  </button>
                </form>
                <a
                  href={`/admin?tab=work${showAll ? '&show=all' : ''}`}
                  className="min-h-11 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/55 underline underline-offset-4 hover:text-indigo"
                >
                  Cancel
                </a>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-graphite">
                Reject {job.title}? This is final, and it sends no email at all, so somebody
                has to tell {email ?? 'them'} by hand.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <form action={moveJob}>
                  <input type="hidden" name="id" value={job.id} />
                  <input type="hidden" name="from" value={job.status} />
                  <input type="hidden" name="to" value="rejected" />
                  <button
                    type="submit"
                    className="min-h-11 rounded-card bg-ember px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-cream"
                  >
                    Yes, reject it
                  </button>
                </form>
                <a
                  href={`/admin?tab=work${showAll ? '&show=all' : ''}`}
                  className="min-h-11 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/55 underline underline-offset-4 hover:text-indigo"
                >
                  Cancel
                </a>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {moves.map((to) =>
            to === 'rejected' ? (
              <a
                key={to}
                href={`/admin?tab=work${showAll ? '&show=all' : ''}&confirm=${job.id}`}
                className="inline-flex min-h-11 items-center font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/40 underline underline-offset-4 hover:text-ember"
              >
                {MOVE_LABELS[to].label}
              </a>
            ) : (
              <form key={to} action={moveJob}>
                <input type="hidden" name="id" value={job.id} />
                <input type="hidden" name="from" value={job.status} />
                <input type="hidden" name="to" value={to} />
                <button
                  type="submit"
                  className={
                    MOVE_LABELS[to].tone === 'primary'
                      ? 'min-h-11 rounded-card bg-indigo px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-cream'
                      : 'min-h-11 rounded-card border border-graphite/25 px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/60 transition-colors hover:border-indigo hover:text-indigo'
                  }
                >
                  {MOVE_LABELS[to].label}
                </button>
              </form>
            ),
          )}

          {/*
            The promise, next to the button that makes it.

            Accepting stamps `approved_at` and emails the customer a figure. Since
            2026-08-11 every offered pair carries that figure, including pairs nobody
            has proven in production, so the person clicking is the last check that it
            is deliverable. Saying so here is cheaper than saying sorry later.
          */}
          {job.status === 'submitted' && (
            <span className="text-[11px] leading-relaxed text-graphite/55">
              {guaranteed
                ? `Accepting starts the ${TURNAROUND_HOURS} hour clock and emails them that figure.`
                : 'Accepting emails them that you will confirm timing.'}
            </span>
          )}

          {/*
            The re-queue button. Only offered on a job the customer has already been told
            failed, guarded server-side in requeueJob the same way every other move here is.
          */}
          {canRequeue && (
            <a
              href={`/admin?tab=work${showAll ? '&show=all' : ''}&confirm=${job.id}`}
              className="inline-flex min-h-11 items-center rounded-card border border-graphite/25 px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/60 transition-colors hover:border-indigo hover:text-indigo"
            >
              Re-queue
            </a>
          )}
        </div>
      )}
    </li>
  )
}

export async function SongsTab({
  showAll,
  confirming,
}: {
  showAll: boolean
  confirming?: string
}) {
  const db = supabaseAdmin()

  let query = db
    .from('song_jobs')
    .select(JOB_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(200)
  if (!showAll) query = query.in('status', OPEN_STATUSES as unknown as string[])

  const { data, error, count } = await query
  if (error) {
    return (
      <p className="mt-12 max-w-xl text-graphite/70">
        The songs table cannot be read yet. Apply{' '}
        <code className="font-mono text-sm">supabase/migrations</code> to the
        database and reload.
        <span className="mt-3 block font-mono text-xs text-graphite/50">{error.message}</span>
      </p>
    )
  }

  const jobs = (data ?? []) as unknown as Job[]
  const total = count ?? jobs.length

  /**
   * Files, deliveries and submitter addresses, fetched once for the whole page rather than per
   * job. The email lives in `auth.users`, which PostgREST does not expose, so it comes from the
   * admin auth API.
   *
   * ⚠️ `perPage` caps this. Past a thousand accounts the tail stops resolving and those rows
   * render "unknown sender" rather than the wrong sender, which is the right failure, but at
   * that point this wants paging or a denormalised column.
   */
  const jobIds = jobs.map((j) => j.id)
  const voiceIds = [...new Set(jobs.map((j) => j.voice_id).filter((v): v is string => Boolean(v)))]
  const [assetResult, deliveryResult, userResult, voiceResult] = await Promise.all([
    jobIds.length
      ? db
          .from('song_job_assets')
          .select('id, job_id, kind, artist_name, part, filename, bytes, purged_at')
          .in('job_id', jobIds)
      : Promise.resolve({ data: [] as Asset[] }),
    jobIds.length
      ? db
          .from('song_job_deliveries')
          .select('id, job_id, kind, watermark_id, filename, bytes')
          .in('job_id', jobIds)
      : Promise.resolve({ data: [] as Delivery[] }),
    db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    voiceIds.length
      ? db.from('voice_models').select('id, artist_name, status').in('id', voiceIds)
      : Promise.resolve({ data: [] as { id: string; artist_name: string; status: string }[] }),
  ])

  const voiceById = new Map<string, { artist_name: string; status: string }>()
  for (const v of (voiceResult.data ?? []) as { id: string; artist_name: string; status: string }[]) {
    voiceById.set(v.id, { artist_name: v.artist_name, status: v.status })
  }

  const assetsByJob = new Map<string, Asset[]>()
  for (const a of (assetResult.data ?? []) as Asset[]) {
    const list = assetsByJob.get(a.job_id) ?? []
    list.push(a)
    assetsByJob.set(a.job_id, list)
  }

  const deliveriesByJob = new Map<string, Delivery[]>()
  for (const d of (deliveryResult.data ?? []) as Delivery[]) {
    const list = deliveriesByJob.get(d.job_id) ?? []
    list.push(d)
    deliveriesByJob.set(d.job_id, list)
  }

  const emailById = new Map<string, string>()
  for (const u of userResult.data?.users ?? []) {
    if (u.email) emailById.set(u.id, u.email)
  }

  const nowMs = clockNow()

  if (!jobs.length) {
    return (
      <p className="mt-12 text-graphite/60">
        {showAll ? 'No songs have been sent yet.' : 'Nothing waiting. Every song has been dealt with.'}
      </p>
    )
  }

  const rowFor = (job: Job): RowData => ({
    job,
    assets: assetsByJob.get(job.id) ?? [],
    deliveries: deliveriesByJob.get(job.id) ?? [],
    email: emailById.get(job.user_id),
    voice: job.voice_id ? voiceById.get(job.voice_id) : undefined,
  })

  /**
   * Re-roll families: a child (`parent_job_id` set) nests under its original, never under
   * another child, per the spec ("parent_job_id always points at the original"). A child whose
   * parent fell outside this page's filter (e.g. the original was delivered and is hidden under
   * "To handle") is shown at the top level instead of silently dropped.
   */
  const jobById = new Map(jobs.map((j) => [j.id, j]))
  const childrenByParent = new Map<string, Job[]>()
  for (const j of jobs) {
    if (j.parent_job_id && jobById.has(j.parent_job_id)) {
      const list = childrenByParent.get(j.parent_job_id) ?? []
      list.push(j)
      childrenByParent.set(j.parent_job_id, list)
    }
  }
  const roots = jobs.filter((j) => !j.parent_job_id || !jobById.has(j.parent_job_id))

  return (
    <>
      <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-graphite/45">
        {total} {total === 1 ? 'song' : 'songs'}
      </p>

      <ol className="mt-2">
        {roots.map((job) => {
          const children = childrenByParent.get(job.id) ?? []
          return (
            <li key={job.id} className="list-none">
              <ol>
                <JobRow data={rowFor(job)} showAll={showAll} confirming={confirming} nowMs={nowMs} isChild={false} />
                {children.map((child) => (
                  <JobRow
                    key={child.id}
                    data={rowFor(child)}
                    showAll={showAll}
                    confirming={confirming}
                    nowMs={nowMs}
                    isChild
                  />
                ))}
              </ol>
            </li>
          )
        })}
      </ol>
    </>
  )
}
