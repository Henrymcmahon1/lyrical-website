import type { Metadata } from 'next'
import { Mark } from '@/components/Mark'
import { Trademark } from '@/components/Trademark'
import { hasDemoSession } from '@/lib/demo-session'
import { LISTEN_INTRO, LISTEN_TITLE, TRACKS } from '@/content/listen'
import { signListenTracks } from '@/lib/listen-audio'
import { lock, unlock } from './actions'

/**
 * The private comparison page. Not linked from anywhere on the site, by design.
 *
 * Four independent reasons it should never be indexed or wandered into: it is password
 * gated, `noindex` here, disallowed in robots.txt, and absent from the sitemap. Nothing in
 * the nav or the footer points at it; the URL is given out in a conversation.
 *
 * Dark ground, because every listening surface on this site is dark and this is the most
 * listening-focused page there is. Indigo is never used on the dark ground (2.7:1), so the
 * accent here is `dark-accent`, as in the rest of the dark treatment.
 */
export const metadata: Metadata = {
  title: 'Listen',
  robots: { index: false, follow: false, nocache: true },
}

export const dynamic = 'force-dynamic'

const SHELL = 'mx-auto w-full max-w-2xl px-6'

function Gate({ error }: { error?: string }) {
  return (
    <main className="min-h-screen bg-dark-ground text-dark-ink">
      <section className={`${SHELL} flex min-h-screen flex-col justify-center py-20`}>
        <div className="text-dark-accent">
          <Mark size={40} />
        </div>

        <h1 className="mt-8 font-brand text-4xl leading-tight tracking-tight">
          lyrical
          <Trademark />
        </h1>
        <p className="mt-4 max-w-sm leading-relaxed text-dark-ink/60">
          A private listening page. If you were sent a password, it goes here.
        </p>

        <form action={unlock} className="mt-10 flex max-w-sm flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm">Password</span>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              autoFocus
              className="w-full rounded-card border border-dark-ink/25 bg-transparent px-4 py-3 outline-none transition-colors focus-visible:border-dark-accent"
            />
          </label>

          {error === '1' && (
            <p role="alert" className="text-sm text-dark-accent">
              That password is not right.
            </p>
          )}
          {error === 'rate' && (
            <p role="alert" className="text-sm text-dark-accent">
              Too many attempts. Wait ten minutes and try again.
            </p>
          )}

          <button
            type="submit"
            className="nudge inline-flex min-h-11 items-center self-start rounded-card bg-dark-accent px-6 text-dark-ground"
          >
            Listen
          </button>
        </form>
      </section>
    </main>
  )
}

export default async function Listen({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const [unlocked, params] = await Promise.all([hasDemoSession(), searchParams])
  if (!unlocked) return <Gate error={params.error} />

  /*
   * Signed AFTER the password check, never before.
   *
   * These URLs are the actual capability: anyone holding one can fetch the recording without
   * the password. Minting them for a visitor who has not unlocked the page would hand the
   * audio to whoever loaded the URL, which is what the gate exists to prevent.
   */
  const signed = await signListenTracks(TRACKS.map((t) => t.key))
  const urlFor = new Map(signed.map((s) => [s.key, s.url]))
  const anyAudio = signed.some((s) => s.url)

  return (
    <main className="min-h-screen bg-dark-ground text-dark-ink">
      <section className={`${SHELL} py-16 sm:py-24`}>
        <div className="flex items-start justify-between gap-6">
          <div className="text-dark-accent">
            <Mark size={32} />
          </div>
          <form action={lock}>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center text-sm text-dark-ink/45 underline underline-offset-4 hover:text-dark-ink"
            >
              Lock
            </button>
          </form>
        </div>

        <h1 className="mt-8 font-brand text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
          {LISTEN_TITLE}
        </h1>
        <p className="mt-6 max-w-xl leading-relaxed text-dark-ink/65">{LISTEN_INTRO}</p>

        {!anyAudio && (
          <p
            role="status"
            className="mt-10 rounded-card border border-dark-ink/20 px-5 py-4 text-sm leading-relaxed text-dark-ink/60"
          >
            No recordings are loaded yet. Upload them to the{' '}
            <code className="font-mono text-dark-ink/80">listen</code> bucket in Supabase
            Storage, named exactly as in{' '}
            <code className="font-mono text-dark-ink/80">content/listen.ts</code>.
          </p>
        )}

        <ol className="mt-12 flex flex-col gap-10">
          {TRACKS.map((t, i) => (
            <li
              key={t.id}
              className={
                t.ours
                  ? 'rounded-card border border-dark-accent/45 p-6 sm:p-7'
                  : 'border-t border-dark-ink/12 pt-8'
              }
            >
              <div className="flex items-baseline gap-4">
                <span className="font-mono text-xs tabular-nums text-dark-accent">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h2 className="font-brand text-2xl leading-tight tracking-tight">{t.label}</h2>
              </div>

              <p className="mt-3 max-w-lg text-sm leading-relaxed text-dark-ink/60">{t.note}</p>

              {urlFor.get(t.key) ? (
                /*
                 * Native controls, deliberately.
                 *
                 * These are full songs being compared, so a listener needs to scrub to the
                 * same point in each one, adjust volume and use the keyboard. A custom
                 * transport would have to reimplement all of that, badly, for a page three
                 * people will ever open. `preload="none"` because three full tracks is
                 * several megabytes and nobody wants that fetched on load over mobile data.
                 */
                <audio
                  controls
                  preload="none"
                  src={urlFor.get(t.key) ?? undefined}
                  className="mt-5 w-full"
                  aria-label={t.label}
                />
              ) : (
                <p className="mt-5 font-mono text-xs uppercase tracking-[0.16em] text-dark-ink/35">
                  Not loaded yet
                </p>
              )}
            </li>
          ))}
        </ol>

        <p className="mt-16 max-w-xl text-xs leading-relaxed text-dark-ink/40">
          Shared privately for evaluation. Please do not forward this link or redistribute
          these recordings.
        </p>
      </section>
    </main>
  )
}
