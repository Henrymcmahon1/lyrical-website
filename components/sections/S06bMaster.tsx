import { Reveal } from '../Reveal'

/**
 * The single strongest line for a label or publisher: it reframes a catalogue from a
 * closed archive into an asset that can still grow. Kept quiet and full-width so it reads
 * as a position rather than a pitch.
 */
export default function S06bMaster() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-24 text-center">
      <Reveal>
        <p className="font-mono text-xs tracking-[0.18em] text-graphite/45">
          What we believe
        </p>
        <h2 className="mt-6 font-brand text-3xl leading-snug tracking-tight text-balance sm:text-4xl">
          A master recording is not a finished product. It is the foundation for
          everything that comes next.
        </h2>
      </Reveal>
      <Reveal delay={120}>
        <p className="mx-auto mt-8 max-w-2xl leading-relaxed text-graphite/70">
          Music went global. Catalogues did not. The best songs in the world are still
          largely confined to the language they were written in, and that is one of the
          last real barriers between a great song and the audience it was always going to
          find.
        </p>
      </Reveal>
    </section>
  )
}
