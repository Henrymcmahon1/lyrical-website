import { supabaseAdmin } from '@/lib/supabase-admin'
import { FLYER } from '@/content/investors'

/**
 * Three placeholders on the gated /investors page: a signed link to the pitch deck, a written
 * flyer built from the page's own content, and a YouTube-unlisted screen recording. Deck and
 * video each render nothing until Henry sets their env; never-throws, sign-what-exists, same
 * pattern as `S02Coffey` and `lib/listen-audio.ts`. The flyer needs no env and always renders.
 */

export type DeckConfig = { bucket: string; path: string }

export function deckConfig(env: NodeJS.ProcessEnv): DeckConfig | null {
  const path = env.INVESTOR_DECK_PATH?.trim()
  if (!path) return null
  return { bucket: env.INVESTOR_DECK_BUCKET?.trim() || 'investors', path }
}

export function videoId(env: NodeJS.ProcessEnv): string | null {
  return env.INVESTOR_VIDEO_ID?.trim() || null
}

const DECK_TTL_S = 4 * 60 * 60

async function signDeck(cfg: DeckConfig): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin().storage.from(cfg.bucket).createSignedUrl(cfg.path, DECK_TTL_S)
    if (error || !data?.signedUrl) return null
    return data.signedUrl
  } catch (e) {
    console.error('[investors] deck storage unreachable', e)
    return null
  }
}

const eyebrow = 'font-mono text-[11px] uppercase tracking-[0.18em] text-graphite/50'

function Flyer() {
  return (
    <div className="rounded-card border border-graphite/15 p-6 sm:p-8">
      <span className={eyebrow}>Pitch flyer</span>
      <h3 className="mt-3 font-brand text-2xl leading-tight tracking-tight text-balance">{FLYER.title}</h3>
      <p className="mt-2 leading-relaxed text-graphite/75">{FLYER.frame}</p>
      <ol className="mt-6 grid gap-4 sm:grid-cols-2">
        {FLYER.points.map((p) => (
          <li key={p.n} className="flex gap-3">
            <span className="font-mono text-xs tabular-nums text-indigo">{p.n}</span>
            <div>
              <p className="font-brand text-base">{p.h}</p>
              <p className="mt-1 text-sm leading-relaxed text-graphite/70">{p.line}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default async function InvestorMedia() {
  const cfg = deckConfig(process.env)
  const deckUrl = cfg ? await signDeck(cfg) : null
  const video = videoId(process.env)

  return (
    <div className="mt-16 flex flex-col gap-8">
      <Flyer />

      {video && (
        <div className="rounded-card border border-graphite/15 p-6 sm:p-8">
          <span className={eyebrow}>Screen recording</span>
          <h3 className="mt-3 font-brand text-2xl leading-tight tracking-tight">A short walkthrough</h3>
          <div className="mt-5 aspect-video w-full overflow-hidden rounded-card">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${video}`}
              title="lyrical, a short walkthrough for investors"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full border-0"
            />
          </div>
        </div>
      )}

      {deckUrl && (
        <div className="rounded-card border border-graphite/15 p-6 sm:p-8">
          <span className={eyebrow}>Pitch deck</span>
          <h3 className="mt-3 font-brand text-2xl leading-tight tracking-tight">The full deck</h3>
          <p className="mt-2 leading-relaxed text-graphite/75">
            The same material as this page, as slides.
          </p>
          <a
            href={deckUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="nudge mt-5 inline-flex min-h-11 items-center gap-1.5 rounded-card bg-indigo px-6 text-cream"
          >
            View the deck <span className="shift-arrow">&rarr;</span>
          </a>
        </div>
      )}
    </div>
  )
}
