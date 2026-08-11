import S03Wheels from '@/components/sections/S03Wheels'
import S10Start from '@/components/sections/S10Start'

/**
 * The languages page.
 *
 * ⚠️ Its title and description promised playback until 2026-08-11, and there has never been any
 * audio on this site to play. That was raised in three consecutive handovers. Henry's decision
 * was to keep the page and repoint it rather than redirect it, so it now does what it says: it
 * lists the eight languages and asks for a song, like everything else.
 *
 * The examples request that used to live here went the same day, along with the whole machine
 * behind it. See `components/sections/S03Wheels.tsx` for why.
 *
 * The route is still `/hear`, which no longer matches what the page is called. It stays that
 * way on purpose: the URL is indexed, and changing it would trade a real ranking for a tidier
 * path. If audio ever publishes, this is the first page that should get it and the name will
 * be right again.
 */
export const metadata = {
  title: 'Languages',
  description:
    'The eight languages lyrical works in, in both directions. Your record, re-sung in ' +
    'another language by the same artist, over the untouched original backing.',
  alternates: { canonical: '/hear' },
}

export default function Hear() {
  return (
    <>
      <section className="mx-auto max-w-3xl px-6 pt-20 pb-4 text-center sm:pt-28">
        <h1 className="font-brand text-5xl leading-tight tracking-tight text-balance sm:text-6xl">
          The same performance, twice.
        </h1>
        <p className="mt-8 text-lg leading-relaxed text-graphite/75">
          Eight languages, in either direction. The melody, the phrasing and the backing stay
          identical. Only the language changes, and it is still the artist singing it.
        </p>
      </section>

      <div className="mt-12">
        <S03Wheels />
      </div>

      <S10Start />
    </>
  )
}
