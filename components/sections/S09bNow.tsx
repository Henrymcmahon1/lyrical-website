import { Reveal } from '../Reveal'

/**
 * The urgency beat, immediately before the ask.
 *
 * Deliberately framed as the cost of inaction stated as fact, not as pressure. The buyer
 * here is deciding whether to trust us with masters, and a visitor who feels pushed gets
 * more cautious, not less. It also carries no figure: quantifying what a catalogue is
 * "missing" would walk straight back into the population-multiplier claim the
 * Monetization Thesis rules out.
 */
export default function S09bNow() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-24 text-center">
      <Reveal>
        <h2 className="font-brand text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
          Your catalogue is already working. In one language.
        </h2>
      </Reveal>
      <Reveal delay={120}>
        <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-graphite/75">
          Every month it stays that way is a month those songs reach only part of the people
          who would have loved them. The audience is already there. The record is already
          finished. The only thing missing is the language.
        </p>
      </Reveal>
      <Reveal delay={200}>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <a
            href="#enquire"
            className="nudge rounded-card bg-ember px-7 py-4 text-cream"
          >
            Start with one song <span className="shift-arrow">&rarr;</span>
          </a>
          <a
            href="#hear"
            className="nudge rounded-card border border-graphite/30 px-7 py-4 transition-colors hover:border-indigo hover:text-indigo"
          >
            Hear it first
          </a>
        </div>
      </Reveal>
    </section>
  )
}
