import { redirect } from 'next/navigation'
import { currentUser, supabaseServer } from '@/lib/supabase-server'
import { TRAINING_MINIMUM_SECONDS, formatDuration } from '@/lib/voice-training'
import type { VoiceStatus } from '@/lib/voice-schema'
import { renameVoice, retireVoice } from './actions'

/**
 * The customer's voice models.
 *
 * Read with the USER's client, not the admin one, so RLS decides what comes back. If the
 * policies in `supabase/schema.sql` were wrong this query would return nothing rather than
 * somebody else's artists, which is the failure direction we want.
 *
 * ⚠️ Columns are named rather than `select('*')`. `internal_notes` is revoked from the
 * `authenticated` role at the column level, and PostgREST answers a `*` on a table with a
 * revoked column with a permission error rather than quietly dropping it.
 */
export const metadata = {
  title: 'Voices',
  robots: { index: false, follow: false },
}

type Voice = {
  id: string
  artist_name: string
  status: string
  created_at: string
  notes: string | null
}

/** What the customer is told each state means. Blunter wording lives in `/queue`. */
const STATE: Record<VoiceStatus, string> = {
  collecting: 'With us. Waiting on us to check it over.',
  approved: 'Accepted. This voice is ready to be built.',
  training: 'Being learned.',
  ready: 'Ready. Songs by this artist can use it.',
  rejected: 'Not taken on. Write to us if you would like to know why.',
  retired: 'Retired. Training audio removed, consent record kept.',
}

export default async function Voices({
  searchParams,
}: {
  searchParams: Promise<{ added?: string }>
}) {
  const [user, params] = await Promise.all([currentUser(), searchParams])
  if (!user) redirect('/studio/sign-in?next=/studio/voices')

  const supabase = await supabaseServer()

  const [{ data: voices }, { data: samples }] = await Promise.all([
    supabase
      .from('voice_models')
      .select('id, artist_name, status, created_at, notes')
      .order('created_at', { ascending: false }),
    supabase.from('voice_samples').select('voice_id, seconds'),
  ])

  // Totalled here rather than in SQL: the set is small, and a sum in the query would need a
  // view or an RPC to get past PostgREST, which is more moving parts than this earns.
  const secondsByVoice = new Map<string, number>()
  for (const s of (samples ?? []) as { voice_id: string; seconds: number | null }[]) {
    secondsByVoice.set(s.voice_id, (secondsByVoice.get(s.voice_id) ?? 0) + (s.seconds ?? 0))
  }

  const list = (voices ?? []) as Voice[]

  return (
    <section className="mx-auto max-w-3xl px-6 py-20 sm:py-28">
      <span className="font-mono text-xs tracking-[0.18em] text-graphite/45">The studio</span>

      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-brand text-4xl leading-[1.08] tracking-tight">Voices.</h1>
        <a
          href="/studio"
          className="nudge inline-flex min-h-11 items-center text-sm text-graphite/60 underline decoration-graphite/25 underline-offset-4 transition-colors hover:text-graphite"
        >
          Your songs
        </a>
      </div>

      <p className="mt-4 max-w-xl leading-relaxed text-graphite/75">
        An artist&rsquo;s voice is learned once from their clean vocal, then reused by every
        song you send us for them.
      </p>

      {params.added && (
        <p
          role="status"
          className="mt-8 rounded-card border-l-[3px] border-indigo bg-indigo/5 px-5 py-4 leading-relaxed"
        >
          That is with us. We will check the recordings over, and nothing is trained until we do.
        </p>
      )}

      <a
        href="/studio/voices/new"
        className="nudge mt-8 inline-flex items-center gap-1.5 rounded-card bg-ember px-7 py-4 text-cream"
      >
        {list.length ? 'Add another voice' : 'Build a voice model'}
        <span className="shift-arrow">&rarr;</span>
      </a>

      {!list.length ? (
        <p className="mt-12 leading-relaxed text-graphite/75">
          No voices yet.
        </p>
      ) : (
        <ul className="mt-12 flex flex-col gap-5">
          {list.map((v) => {
            const seconds = secondsByVoice.get(v.id) ?? 0
            const retired = v.status === 'retired'
            const short = !retired && seconds < TRAINING_MINIMUM_SECONDS
            return (
              <li
                key={v.id}
                className={`rounded-card border border-graphite/15 p-6 ${retired ? 'opacity-60' : ''}`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <span className="font-brand text-xl tracking-tight">{v.artist_name}</span>
                  {!retired && (
                    <span className="font-mono text-[11px] tabular-nums text-graphite/45">
                      {formatDuration(seconds)}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-graphite/70">
                  {STATE[v.status as VoiceStatus] ?? v.status}
                </p>
                {short && (
                  /*
                   * Said on the list as well as on the form, because this is where somebody
                   * comes back to weeks later. A set that is under the minimum will not train
                   * well, and finding that out from us rather than from a poor result is the
                   * whole point of showing the number.
                   */
                  <p className="mt-3 text-sm leading-relaxed text-ember">
                    Under 20 minutes. Add more takes when you can, or this voice will be a rough
                    likeness rather than a match.
                  </p>
                )}

                {/*
                  Managing a voice. A retired one is terminal, so it shows nothing to act on. For
                  everything else: add takes only while it is still collecting, and rename or retire
                  at any point. All native <details>/<form>, so the manager works with JS off.
                */}
                {!retired && (
                  <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
                    {v.status === 'collecting' && (
                      <a
                        href={`/studio/voices/new?voice=${v.id}`}
                        className="nudge inline-flex min-h-11 items-center text-sm text-indigo underline decoration-indigo/30 underline-offset-4 transition-colors hover:decoration-indigo"
                      >
                        Add more takes
                      </a>
                    )}

                    <details className="w-full sm:w-auto">
                      <summary className="nudge inline-flex min-h-11 cursor-pointer list-none items-center text-sm text-graphite/60 underline decoration-graphite/25 underline-offset-4 hover:text-graphite [&::-webkit-details-marker]:hidden">
                        Rename
                      </summary>
                      <form action={renameVoice} className="mt-3 flex max-w-md flex-col gap-3">
                        <input type="hidden" name="id" value={v.id} />
                        <input
                          name="artist_name"
                          defaultValue={v.artist_name}
                          required
                          maxLength={200}
                          className="rounded-card border border-graphite/20 bg-cream px-3 py-2 text-sm outline-none transition-colors focus:border-indigo"
                        />
                        <textarea
                          name="notes"
                          defaultValue={v.notes ?? ''}
                          rows={2}
                          maxLength={2000}
                          placeholder="Note (optional)"
                          className="rounded-card border border-graphite/20 bg-cream px-3 py-2 text-sm outline-none transition-colors focus:border-indigo"
                        />
                        <button
                          type="submit"
                          className="nudge inline-flex min-h-11 w-fit items-center rounded-card border border-graphite/25 px-4 text-sm transition-colors hover:border-indigo hover:text-indigo"
                        >
                          Save
                        </button>
                      </form>
                    </details>

                    <details className="w-full sm:w-auto">
                      <summary className="nudge inline-flex min-h-11 cursor-pointer list-none items-center text-sm text-graphite/45 underline decoration-graphite/20 underline-offset-4 hover:text-ember [&::-webkit-details-marker]:hidden">
                        Retire
                      </summary>
                      <div className="mt-3 max-w-md rounded-card border border-ember/40 p-4">
                        <p className="text-sm leading-relaxed text-graphite/80">
                          Retire {v.artist_name}? This removes the training audio to free space and
                          stops the voice being offered on new songs. The record that you had
                          permission is kept, and this cannot be undone.
                        </p>
                        <form action={retireVoice} className="mt-4">
                          <input type="hidden" name="id" value={v.id} />
                          <button
                            type="submit"
                            className="nudge inline-flex min-h-11 items-center rounded-card bg-ember px-4 text-sm text-cream"
                          >
                            Yes, retire it
                          </button>
                        </form>
                      </div>
                    </details>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
