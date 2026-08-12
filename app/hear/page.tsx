import S03Wheels from '@/components/sections/S03Wheels'

/**
 * The languages page.
 *
 * ⚠️ Its title and description promised playback until 2026-08-11, and there has never been any
 * audio on this site to play. That was raised in three consecutive handovers. Henry's decision
 * was to keep the page and repoint it rather than redirect it, so it now does what it says: it
 * shows the eight languages and asks for a song, like everything else.
 *
 * The route is still `/hear`, which no longer matches what the page is called. It stays that
 * way on purpose: the URL is indexed, and changing it would trade a real ranking for a tidier
 * path. If audio ever publishes, this is the first page that should get it and the name will be
 * right again.
 *
 * ## `S10Start` was here for a few hours on 2026-08-11 and had to come off
 *
 * Putting the site's standard closing section under `S03Wheels` stacked TWO dark sections back
 * to back, in two nearly identical blacks: `dark-ground` #1B1D1F followed by `graphite`
 * #1C1A19. The seam between them read as a rendering fault rather than a decision, which is
 * the worst kind of visual bug because it makes the whole page look broken rather than plain.
 *
 * It also asked for the same thing twice, with the identical ember label 500px apart, and
 * repeated the melody-and-phrasing sentence that the header above already carried.
 *
 * So this page closes on the wheel section's own call to action. One dark band, one ask.
 * ⚠️ Do not add another full-width section under `S03Wheels` here without checking what colour
 * it lands on.
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
        {/*
          Deliberately one short line. It carried the melody-and-phrasing sentence until
          2026-08-11, which is the same sentence `S03Wheels` says immediately below it. Saying
          it twice in one screen reads as a page assembled rather than written.
        */}
        <p className="mt-8 text-lg leading-relaxed text-graphite/75">
          Eight languages, in either direction.
        </p>
      </section>

      <div className="mt-12">
        <S03Wheels />
      </div>
    </>
  )
}
