import { cookies } from 'next/headers'
import { GATE_COOKIE, verifyGateSafe } from '@/lib/gate'
import { HomeInteractive } from '@/components/HomeInteractive'
import S10Start from '@/components/sections/S10Start'

/**
 * The language page.
 *
 * ⚠️ Its title and description promised playback until 2026-08-11, and there has never been
 * any audio on this site to play. That was raised in three consecutive handovers. Henry's
 * decision was to keep the page and repoint it rather than redirect it, so what it promises now
 * is what it actually does: choose a pair, see what a release in it involves, and ask us to
 * send examples.
 *
 * The moment real audio publishes, this is the first page that should get it, and the words
 * "hear" and "before and after" can come back with it.
 */
export const metadata = {
  title: 'Languages',
  description:
    'The eight languages lyrical works in, in both directions. Choose a pair and ask us to ' +
    'send you before and afters.',
  alternates: { canonical: '/hear' },
}

export default async function Hear() {
  const jar = await cookies()
  const requested = verifyGateSafe(jar.get(GATE_COOKIE)?.value)

  return (
    <>
      <section className="mx-auto max-w-3xl px-6 pt-20 pb-4 text-center sm:pt-28">
        <h1 className="font-brand text-5xl leading-tight tracking-tight text-balance sm:text-6xl">
          The same performance, twice.
        </h1>
        <p className="mt-8 text-lg leading-relaxed text-graphite/75">
          Choose a language pair and ask us to send you the before and after. The melody, the
          phrasing and the backing stay identical. Only the language changes, and it is still
          the artist singing it.
        </p>
      </section>

      <div className="mt-12">
        <HomeInteractive initiallyRequested={requested} />
      </div>

      <S10Start />
    </>
  )
}
