import { supabaseAdmin } from '@/lib/supabase-admin'
import { CoffeyPlayer } from './CoffeyPlayer'

/**
 * Coffey Anderson, before and after. The files live in a PRIVATE bucket; Henry supplies the
 * paths through env. Until both files sign, this is `null`: the home page never shows a player
 * with nothing behind it. Same signing pattern as lib/listen-audio.ts; never throws.
 */
export type CoffeyConfig = { bucket: string; original: string; cover: string }

export function coffeyConfig(env: NodeJS.ProcessEnv): CoffeyConfig | null {
  const original = env.COFFEY_ORIGINAL_PATH?.trim()
  const cover = env.COFFEY_COVER_PATH?.trim()
  if (!original || !cover) return null
  return { bucket: env.COFFEY_BUCKET?.trim() || 'listen', original, cover }
}

const TTL_S = 4 * 60 * 60

async function signBoth(cfg: CoffeyConfig): Promise<{ original: string; cover: string } | null> {
  try {
    const { data, error } = await supabaseAdmin().storage.from(cfg.bucket).createSignedUrls([cfg.original, cfg.cover], TTL_S)
    if (error || !data) return null
    const ok = new Map(data.filter((r) => r.signedUrl && !r.error && r.path).map((r) => [r.path as string, r.signedUrl]))
    const original = ok.get(cfg.original)
    const cover = ok.get(cfg.cover)
    return original && cover ? { original, cover } : null
  } catch (e) {
    console.error('[coffey] storage unreachable', e)
    return null
  }
}

export default async function S02Coffey() {
  const cfg = coffeyConfig(process.env)
  if (!cfg) return null
  const urls = await signBoth(cfg)
  if (!urls) return null
  return (
    <section aria-label="Coffey Anderson, before and after" className="bg-dark-ground py-24 text-dark-ink sm:py-28">
      <div className="mx-auto flex max-w-4xl flex-col items-center px-6 text-center">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-dark-ink/50">Hear it</span>
        <h2 className="mt-5 font-brand text-4xl leading-tight tracking-tight text-balance sm:text-5xl">Coffey Anderson, in a language he never recorded.</h2>
        <p className="mt-6 max-w-xl leading-relaxed text-dark-ink/70">Same voice, same melody, the original backing untouched. Switch between the two and listen for what changed: only the words.</p>
        <CoffeyPlayer originalUrl={urls.original} coverUrl={urls.cover} />
      </div>
    </section>
  )
}
