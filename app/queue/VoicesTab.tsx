import {
  TRAINING_MINIMUM_SECONDS,
  formatDuration,
  formatMegabytes,
  storageSummary,
} from '@/lib/voice-training'
import type { VoiceStatus } from '@/lib/voice-schema'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { moveVoice } from './actions'

/**
 * Voice models waiting on a human.
 *
 * Reads with `supabaseAdmin()`, the service role client, which bypasses RLS. Correct for a
 * staff path and the opposite of `app/studio/voices/`, which uses the customer's own session so
 * the policies decide what comes back.
 *
 * The number that matters on this page is MINUTES, not files. A set of twelve files that adds
 * up to nine minutes will train a poor model, and the only way to see that before spending the
 * compute is to have the total in front of you when you press Approve.
 */

type Voice = {
  id: string
  created_at: string
  user_id: string
  artist_name: string
  status: string
  notes: string | null
  consent_warranted_at: string
  approved_at: string | null
}

type Sample = {
  id: string
  voice_id: string
  filename: string
  bytes: number
  seconds: number | null
}

const STATE: Record<string, { label: string; className: string }> = {
  collecting: { label: 'Waiting on you', className: 'text-ember' },
  approved: { label: 'Approved', className: 'text-indigo' },
  training: { label: 'Training', className: 'text-indigo' },
  ready: { label: 'Ready', className: 'text-graphite/45' },
  rejected: { label: 'Rejected', className: 'text-graphite/45' },
  retired: { label: 'Retired', className: 'text-graphite/45' },
}

/** Which moves each state allows. Same shape as the song lifecycle, kept local because it is small. */
const MOVES: Record<string, { to: VoiceStatus; label: string; primary: boolean }[]> = {
  collecting: [
    { to: 'approved', label: 'Approve', primary: true },
    { to: 'rejected', label: 'Reject', primary: false },
  ],
  approved: [{ to: 'training', label: 'Start training', primary: true }],
  training: [{ to: 'ready', label: 'Mark ready', primary: true }],
  ready: [],
  rejected: [],
}

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export async function VoicesTab({ showAll }: { showAll: boolean }) {
  const db = supabaseAdmin()

  let query = db
    .from('voice_models')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(200)
  if (!showAll) query = query.in('status', ['collecting', 'approved', 'training'])

  const { data, error, count } = await query
  if (error) {
    return (
      <p className="mt-12 max-w-xl text-graphite/70">
        The voice models table cannot be read yet. Run{' '}
        <code className="font-mono text-sm">supabase/schema.sql</code> in the Supabase SQL
        editor and reload.
        <span className="mt-3 block font-mono text-xs text-graphite/50">{error.message}</span>
      </p>
    )
  }

  const voices = (data ?? []) as Voice[]
  const total = count ?? voices.length

  const ids = voices.map((v) => v.id)
  const [sampleResult, userResult, voiceBytesResult, assetBytesResult] = await Promise.all([
    ids.length
      ? db.from('voice_samples').select('id, voice_id, filename, bytes, seconds').in('voice_id', ids)
      : Promise.resolve({ data: [] as Sample[] }),
    db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    // GLOBAL, not scoped to the visible voices: the 1GB is a single shared quota, so the meter has
    // to count every training take and every song asset in the project, retired voices aside.
    db.from('voice_samples').select('bytes'),
    db.from('song_job_assets').select('bytes'),
  ])

  const sumBytes = (rows: { bytes: number | null }[] | null | undefined) =>
    (rows ?? []).reduce((sum, r) => sum + (r.bytes ?? 0), 0)
  const meter = storageSummary(
    sumBytes(voiceBytesResult.data) + sumBytes(assetBytesResult.data),
  )

  const byVoice = new Map<string, Sample[]>()
  for (const s of (sampleResult.data ?? []) as Sample[]) {
    const list = byVoice.get(s.voice_id) ?? []
    list.push(s)
    byVoice.set(s.voice_id, list)
  }

  const emailById = new Map<string, string>()
  for (const u of userResult.data?.users ?? []) if (u.email) emailById.set(u.id, u.email)

  /*
    The shared-tier meter. On cream, so indigo is allowed here (the dark-ground ban does not
    apply), and it turns ember only when the tier is nearly full. Shown whether or not anything
    is waiting, because "nearly out of space" matters most when the queue looks quiet.
  */
  const meterBlock = (
    <div className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-graphite/45">
          Training storage
        </span>
        <span
          className={`font-mono text-[11px] tabular-nums ${
            meter.near ? 'text-ember' : 'text-graphite/45'
          }`}
        >
          {meter.message}
        </span>
      </div>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-graphite/12"
        role="progressbar"
        aria-valuenow={Math.round(meter.fraction * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Training storage used"
      >
        <div
          className={`h-full rounded-full ${meter.near ? 'bg-ember' : 'bg-indigo'}`}
          style={{ width: `${meter.fraction * 100}%` }}
        />
      </div>
    </div>
  )

  if (!voices.length) {
    return (
      <>
        {meterBlock}
        <p className="mt-12 text-graphite/60">
          {showAll ? 'No voice models yet.' : 'Nothing waiting. Every voice has been dealt with.'}
        </p>
      </>
    )
  }

  return (
    <>
      {meterBlock}
      <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.16em] text-graphite/45">
        {total} {total === 1 ? 'voice' : 'voices'}
      </p>

      <ol className="mt-2">
        {voices.map((voice) => {
          const samples = byVoice.get(voice.id) ?? []
          const seconds = samples.reduce((sum, s) => sum + (s.seconds ?? 0), 0)
          const bytes = samples.reduce((sum, s) => sum + s.bytes, 0)
          const short = seconds < TRAINING_MINIMUM_SECONDS
          const state = STATE[voice.status] ?? {
            label: voice.status,
            className: 'text-graphite/45',
          }
          const moves = MOVES[voice.status] ?? []
          const email = emailById.get(voice.user_id)

          return (
            <li key={voice.id} className="border-b border-graphite/12 py-7">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="font-brand text-2xl tracking-tight">{voice.artist_name}</h3>
                <span
                  className={`font-mono text-[10px] uppercase tracking-[0.16em] ${state.className}`}
                >
                  {state.label}
                </span>
                <time
                  dateTime={voice.created_at}
                  className="ml-auto font-mono text-[11px] tabular-nums text-graphite/45"
                >
                  {when(voice.created_at)}
                </time>
              </div>

              <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/50">
                <div>
                  <dt className="sr-only">Training audio</dt>
                  {/*
                    Ember when the set is short. This is the single number that decides whether
                    approving is worth the compute, so it is the one thing on the row that
                    changes colour.
                  */}
                  <dd className={short ? 'text-ember' : 'text-graphite/50'}>
                    {formatDuration(seconds)} across {samples.length} files
                  </dd>
                </div>
                <div>
                  <dt className="sr-only">Storage</dt>
                  <dd>{formatMegabytes(bytes)}</dd>
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
                <div>
                  <dt className="sr-only">Consent given</dt>
                  <dd>consent {when(voice.consent_warranted_at)}</dd>
                </div>
              </dl>

              {voice.notes && (
                <p className="mt-4 max-w-2xl whitespace-pre-line leading-relaxed text-graphite/80">
                  {voice.notes}
                </p>
              )}

              {short && (
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ember">
                  Under the 20 minute minimum. Training on this produces a rough likeness rather
                  than a match. Ask for more takes before approving.
                </p>
              )}

              <ul className="mt-4 flex flex-col gap-1.5">
                {samples.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-baseline gap-x-3 text-sm">
                    <a
                      href={`/queue/audio?voice=${s.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo underline underline-offset-4"
                    >
                      {s.filename}
                    </a>
                    <span className="tabular-nums text-graphite/45">
                      {s.seconds ? formatDuration(s.seconds) : 'unknown'}
                    </span>
                    <span className="tabular-nums text-graphite/40">
                      {formatMegabytes(s.bytes)}
                    </span>
                  </li>
                ))}
                {!samples.length && (
                  <li className="text-sm text-ember">No files attached. Do not approve this one.</li>
                )}
              </ul>

              {moves.length > 0 && (
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  {moves.map((m) => (
                    <form key={m.to} action={moveVoice}>
                      <input type="hidden" name="id" value={voice.id} />
                      <input type="hidden" name="from" value={voice.status} />
                      <input type="hidden" name="to" value={m.to} />
                      <button
                        type="submit"
                        className={
                          m.primary
                            ? 'min-h-11 rounded-card bg-indigo px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-cream'
                            : 'min-h-11 rounded-card border border-graphite/25 px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/60 transition-colors hover:border-ember hover:text-ember'
                        }
                      >
                        {m.label}
                      </button>
                    </form>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </>
  )
}
