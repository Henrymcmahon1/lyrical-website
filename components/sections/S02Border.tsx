import { Reveal } from '../Reveal'

/**
 * Split in two on purpose.
 *
 * `S02BorderStatement` is what the zoom aperture reveals: one line, large, centred. An
 * aperture cutting across paragraph text reads as broken clipping rather than a reveal,
 * so the detail lives in `S02BorderDetail` below the transition, in normal flow.
 */
export function S02BorderStatement() {
  return (
    <div className="mx-auto flex h-full max-w-4xl items-center px-6">
      <h2 className="font-brand text-5xl leading-[1.05] tracking-tight text-balance sm:text-6xl lg:text-7xl">
        A great song stops at a language border.
      </h2>
    </div>
  )
}

export default function S02BorderDetail() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-24">
      <Reveal>
        <p className="max-w-2xl text-lg leading-relaxed text-graphite/75">
          Subtitles don&rsquo;t sing, and a cover by a different singer isn&rsquo;t the same
          record. Traditional localisation means booking the artist, a studio, a translator
          and an engineer. Weeks of work per song, so it only ever happens for the biggest
          releases.
        </p>
      </Reveal>
      <Reveal delay={120}>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-graphite/75">
          Meanwhile the catalogue that already works sits in one language, available
          everywhere and built for nowhere in particular.
        </p>
      </Reveal>
    </section>
  )
}
