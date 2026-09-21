import { redirect } from 'next/navigation'
import { currentUser, supabaseServer } from '@/lib/supabase-server'
import { TRAINING_MINIMUM_SECONDS, formatDuration } from '@/lib/voice-training'
import type { VoiceStatus } from '@/lib/voice-schema'
import { Notice, PageHead, Panel, button, control, link } from '@/components/studio/ui'
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

/** The status word, in the dashboard's uppercase tracked style, lit while something is moving. */
const STATE_TONE: Record<VoiceStatus, string> = {
  collecting: 'text-dark-ink/50',
  approved: 'text-dark-accent',
  training: 'text-dark-accent',
  ready: 'text-dark-ink',
  rejected: 'text-dark-ink/50',
  retired: 'text-dark-ink/40',
}

const summary =
  'nudge inline-flex min-h-11 cursor-pointer list-none items-center [&::-webkit-details-marker]:hidden'

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
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHead
        eyebrow="Voices"
        title="Voices."
        lead={
          <>
            An artist&rsquo;s voice is learned once from their clean vocal, then reused by every
            song you send us for them.
          </>
        }
        aside={
          <a href="/studio" className={`inline-flex min-h-11 items-center ${link}`}>
            Your songs
          </a>
        }
      />

      {params.added && (
        <Notice>
          That is with us. We will check the recordings over, and nothing is trained until we do.
        </Notice>
      )}

      <div>
        <a href="/studio/voices/new" className={button.primary}>
          {list.length ? 'Add another voice' : 'Build a voice model'}
          <span className="shift-arrow">&rarr;</span>
        </a>
      </div>

      {!list.length ? (
        <Panel>
          <p className="py-4 text-center font-product text-sm text-dark-ink/60">No voices yet.</p>
        </Panel>
      ) : (
        <ul className="flex flex-col gap-4">
          {list.map((v) => {
            const seconds = secondsByVoice.get(v.id) ?? 0
            const retired = v.status === 'retired'
            const short = !retired && seconds < TRAINING_MINIMUM_SECONDS
            const status = v.status as VoiceStatus
            return (
              <Panel as="li" key={v.id} className={retired ? 'opacity-60' : ''}>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="font-brand text-lg font-semibold leading-tight text-dark-ink">{v.artist_name}</h2>
                  <span className="flex items-baseline gap-3">
                    <span className={`font-product text-[11px] font-semibold uppercase tracking-[0.1em] ${STATE_TONE[status] ?? 'text-dark-ink/50'}`}>
                      {v.status}
                    </span>
                    {!retired && (
                      <span className="font-mono text-[11px] tabular-nums text-dark-ink/45">
                        {formatDuration(seconds)}
                      </span>
                    )}
                  </span>
                </div>
                <p className="mt-2 font-product text-sm text-dark-ink/70">
                  {STATE[status] ?? v.status}
                </p>
                {short && (
                  /*
                   * Said on the list as well as on the form, because this is where somebody
                   * comes back to weeks later. A set that is under the minimum will not train
                   * well, and finding that out from us rather than from a poor result is the
                   * whole point of showing the number.
                   */
                  <p className="mt-3 font-product text-sm leading-relaxed text-dark-accent">
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
                  <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-dark-ink/10 pt-4">
                    {v.status === 'collecting' && (
                      <a
                        href={`/studio/voices/new?voice=${v.id}`}
                        className={`inline-flex min-h-11 items-center ${link}`}
                      >
                        Add more takes
                      </a>
                    )}

                    <details className="w-full sm:w-auto">
                      <summary className={`${summary} ${link}`}>
                        Rename
                      </summary>
                      <form action={renameVoice} className="mt-3 flex max-w-md flex-col gap-3">
                        <input type="hidden" name="id" value={v.id} />
                        <input
                          name="artist_name"
                          defaultValue={v.artist_name}
                          required
                          maxLength={200}
                          className={control}
                        />
                        <textarea
                          name="notes"
                          defaultValue={v.notes ?? ''}
                          rows={2}
                          maxLength={2000}
                          placeholder="Note (optional)"
                          className={control}
                        />
                        <button type="submit" className={`w-fit ${button.ghost}`}>
                          Save
                        </button>
                      </form>
                    </details>

                    <details className="w-full sm:w-auto">
                      <summary className={`${summary} ${link} hover:text-dark-accent`}>
                        Retire
                      </summary>
                      <div className="mt-3 max-w-md rounded-card border border-dark-accent/40 bg-dark-accent/10 p-4">
                        <p className="font-product text-sm leading-relaxed text-dark-ink/80">
                          Retire {v.artist_name}? This removes the training audio to free space and
                          stops the voice being offered on new songs. The record that you had
                          permission is kept, and this cannot be undone.
                        </p>
                        <form action={retireVoice} className="mt-4">
                          <input type="hidden" name="id" value={v.id} />
                          <button type="submit" className={button.primary}>
                            Yes, retire it
                          </button>
                        </form>
                      </div>
                    </details>
                  </div>
                )}
              </Panel>
            )
          })}
        </ul>
      )}
    </div>
  )
}
