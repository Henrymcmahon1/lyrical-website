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
import { moveJob, saveNote } from './actions'

/**
 * Songs waiting on a human.
 *
 * This is the half of the console that did not exist, and its absence was the hole: a customer
 * could submit a master and nothing could move it past "Received", so the status rail they
 * were shown was a rail with no driver.
 *
 * Everything here reads with `supabaseAdmin()`, the service role client, which bypasses RLS.
 * That is correct for a staff path and is the opposite of `app/studio/`, which uses the
 * customer's own session so the policies decide what comes back. Mixing them up in either
 * direction is the serious mistake available in this file.
 */

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
}

type Asset = {
  id: string
  job_id: string
  kind: string
  artist_name: string | null
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
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(200)
  if (!showAll) query = query.in('status', OPEN_STATUSES as unknown as string[])

  const { data, error, count } = await query
  if (error) {
    return (
      <p className="mt-12 max-w-xl text-graphite/70">
        The songs table cannot be read yet. Run{' '}
        <code className="font-mono text-sm">supabase/schema.sql</code> in the Supabase SQL
        editor and reload.
        <span className="mt-3 block font-mono text-xs text-graphite/50">{error.message}</span>
      </p>
    )
  }

  const jobs = (data ?? []) as Job[]
  const total = count ?? jobs.length

  /**
   * Files and submitter addresses, fetched once for the whole page rather than per job.
   *
   * The email lives in `auth.users`, which PostgREST does not expose, so it comes from the
   * admin auth API. One `listUsers` call and a map beats one `getUserById` per row, which at
   * fifty jobs is fifty sequential round trips.
   *
   * ⚠️ `perPage` caps this. Past a thousand accounts the tail stops resolving and those rows
   * render "unknown sender" rather than the wrong sender, which is the right failure, but at
   * that point this wants paging or a denormalised column.
   */
  const jobIds = jobs.map((j) => j.id)
  const [assetResult, userResult] = await Promise.all([
    jobIds.length
      ? db
          .from('song_job_assets')
          .select('id, job_id, kind, artist_name, filename, bytes')
          .in('job_id', jobIds)
      : Promise.resolve({ data: [] as Asset[] }),
    db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ])

  const assetsByJob = new Map<string, Asset[]>()
  for (const a of (assetResult.data ?? []) as Asset[]) {
    const list = assetsByJob.get(a.job_id) ?? []
    list.push(a)
    assetsByJob.set(a.job_id, list)
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

  return (
    <>
      <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-graphite/45">
        {total} {total === 1 ? 'song' : 'songs'}
      </p>

      <ol className="mt-2">
        {jobs.map((job) => {
          const assets = assetsByJob.get(job.id) ?? []
          const email = emailById.get(job.user_id)
          const state = STATE[job.status] ?? { label: job.status, className: 'text-graphite/45' }
          const moves = ALLOWED_MOVES[job.status as JobStatus] ?? []
          const clock = job.approved_at && job.status !== 'delivered'
            ? timeLeft(job.approved_at, nowMs)
            : null
          const guaranteed = isGuaranteed(
            job.source_language as LanguageCode,
            job.target_language as LanguageCode,
          )

          return (
            <li key={job.id} className="border-b border-graphite/12 py-7">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="font-brand text-2xl tracking-tight">{job.title}</h3>
                <span className="text-graphite/60">{job.primary_artist}</span>
                <span
                  className={`font-mono text-[10px] uppercase tracking-[0.16em] ${state.className}`}
                >
                  {state.label}
                </span>
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
                {clock && (
                  <div>
                    <dt className="sr-only">Time left</dt>
                    <dd className={clock.late ? 'text-ember' : 'text-graphite/50'}>
                      {clock.text}
                    </dd>
                  </div>
                )}
              </dl>

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

                `dir="auto"` lets the browser pick direction from the first strong character,
                and the monospace face is deliberate: a lyric sheet is read line by line and
                proportional type hides a line that is far longer than its neighbours.
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
              ) : (
                /*
                  Said plainly rather than left blank. Lyrics are optional at submit, so a job
                  arriving without them is normal, and the moment to chase it is BEFORE
                  accepting: after that the clock is running and the pipeline has nothing to
                  translate from.
                */
                <p className="mt-4 text-sm text-ember">
                  No lyrics. Ask for them before accepting: the translation is built from them.
                </p>
              )}

              {/*
                The files, as links that sign on click.

                Each one points at /queue/audio with an ASSET ID. No signed URL is rendered
                into this page, so nothing here keeps working once the tab is closed, and a
                screenshot of this screen hands over nothing. See that route for the argument.
              */}
              <ul className="mt-4 flex flex-col gap-1.5">
                {assets.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 text-sm">
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/45">
                      {KIND_LABEL[a.kind] ?? a.kind}
                    </span>
                    <a
                      href={`/queue/audio?asset=${a.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo underline underline-offset-4"
                    >
                      {a.filename}
                    </a>
                    <span className="text-graphite/45 tabular-nums">{formatBytes(a.bytes)}</span>
                    {a.artist_name && <span className="text-graphite/55">{a.artist_name}</span>}
                  </li>
                ))}
                {!assets.length && (
                  <li className="text-sm text-ember">
                    No files attached. Do not accept this one.
                  </li>
                )}
              </ul>

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

              {confirming === job.id ? (
                <div className="mt-4 rounded-card border border-ember/40 p-4">
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
                      href={`/queue?tab=songs${showAll ? '&show=all' : ''}`}
                      className="min-h-11 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/55 underline underline-offset-4 hover:text-indigo"
                    >
                      Cancel
                    </a>
                  </div>
                </div>
              ) : (
                moves.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {moves.map((to) =>
                      to === 'rejected' ? (
                        <a
                          key={to}
                          href={`/queue?tab=songs${showAll ? '&show=all' : ''}&confirm=${job.id}`}
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
                  </div>
                )
              )}
            </li>
          )
        })}
      </ol>
    </>
  )
}
