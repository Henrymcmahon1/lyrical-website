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

/**
 * A slot, not a section: this used to be its own full-bleed dark `<section>` on the home
 * page and was never wired to one. Since 2026-09-22 it is embedded inside the audience
 * section (`S02bAudience`) as a contained block, so it carries the dark listening treatment
 * on a rounded card rather than owning the page's background, and no `<section>` or
 * `aria-label` of its own (the parent section already has one).
 */
export default async function S02Coffey() {
  const cfg = coffeyConfig(process.env)
  if (!cfg) return null
  const urls = await signBoth(cfg)
  if (!urls) return null
  return (
    <div className="mt-14 rounded-card bg-dark-ground px-6 py-10 text-center text-dark-ink sm:mt-20 sm:px-10 sm:py-14">
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-dark-ink/50">Hear it</span>
      <h3 className="mt-5 font-brand text-2xl leading-tight tracking-tight text-balance sm:text-3xl">Coffey Anderson, in a language he never recorded.</h3>
      <p className="mx-auto mt-4 max-w-xl leading-relaxed text-dark-ink/70">Same voice, same melody, the original backing untouched. Switch between the two and listen for what changed: only the words.</p>
      <div className="flex justify-center">
        <CoffeyPlayer originalUrl={urls.original} coverUrl={urls.cover} />
      </div>
    </div>
  )
}
