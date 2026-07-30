import { Reveal } from '../Reveal'

export default function S02Border() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-24">
      <Reveal>
        <h2 className="font-brand text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
          A great song stops at a language border.
        </h2>
      </Reveal>
      <Reveal delay={120}>
        <p className="mt-8 max-w-2xl text-lg leading-relaxed text-graphite/75">
          Subtitles don&rsquo;t sing, and a cover by a different singer isn&rsquo;t the same
          record. Traditional localisation means booking the artist, a studio, a translator
          and an engineer &mdash; weeks of work per song. So it only ever happens for the
          biggest releases.
        </p>
      </Reveal>
      <Reveal delay={220}>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-graphite/75">
          Meanwhile the catalogue that already works sits in one language, available
          everywhere and built for nowhere in particular.
        </p>
      </Reveal>
    </section>
  )
}
