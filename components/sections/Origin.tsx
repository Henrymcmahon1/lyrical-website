import { Reveal } from '../Reveal'
import { Mark } from '../Mark'

/**
 * The founding story.
 *
 * Deliberately names no artists and never describes one artist's voice on another
 * artist's catalogue. That was the idea the founders DISCARDED, and publishing it would
 * describe unauthorised cross-catalogue voice cloning on a site whose entire proposition
 * is that everything is authorised. The pivot away from it is the actual story, and it is
 * stronger without the names.
 */
export function Origin() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-24">
      <Reveal>
        <div className="text-indigo">
          <Mark size={40} />
        </div>
        <h2 className="mt-8 font-brand text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
          One song changed everything.
        </h2>
      </Reveal>

      <div className="mt-10 flex flex-col gap-6 text-lg leading-relaxed text-graphite/75">
        <Reveal delay={80}>
          <p>
            Lyrical did not begin as a music company. Jordan and Henry were building
            technology together, and music was not the plan.
          </p>
        </Reveal>

        <Reveal delay={120}>
          <p>
            It started with a reinterpretation. Jordan heard a song he had loved for years
            performed by somebody else, and it landed completely differently. The same song,
            the same words, a different voice, and somehow an entirely different feeling. It
            made him want something he had never wanted before: for that to happen on
            purpose, rather than by chance.
          </p>
        </Reveal>

        <Reveal delay={160}>
          <p>
            He could not let it go. He brought it to Henry, convinced there had to be a way
            to make it possible.
          </p>
        </Reveal>

        <Reveal delay={200}>
          <p>
            Then came the Super Bowl. Watching a stadium sing along to an artist performing
            in a language most of the audience did not speak, Henry saw something bigger.
            The reach was already there. The words were not.
          </p>
        </Reveal>

        <Reveal delay={240}>
          <p className="border-l-2 border-indigo pl-6 text-graphite">
            Jordan had seen how a different voice could transform a song. Henry saw that the
            voice did not have to change at all. The language could.
          </p>
        </Reveal>

        <Reveal delay={280}>
          <p>
            What if artists could perform their own songs in other languages, authentically,
            keeping the voice, the emotion and the identity that made them who they are?
          </p>
        </Reveal>

        <Reveal delay={320}>
          <p className="font-brand text-2xl leading-snug tracking-tight text-graphite sm:text-3xl">
            A great song was never meant to have one life, or one language.
          </p>
        </Reveal>
      </div>
    </section>
  )
}

const BELIEFS = [
  'Technology should expand creativity, not compete with it.',
  'Language should never limit an artist’s audience.',
  'Artists and rights holders stay in control of how their work is used.',
  'Software makes possible what traditional production could not.',
  'A great creative work should not stop evolving the day it was released.',
]

export function Beliefs() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-24">
      <h2 className="font-brand text-4xl leading-tight tracking-tight sm:text-5xl">
        What we believe
      </h2>

      <ol className="mt-12 flex flex-col">
        {BELIEFS.map((b, i) => (
          <li
            key={b}
            className="flex items-baseline gap-6 border-t border-graphite/15 py-6 last:border-b"
          >
            <span className="font-mono text-xs tracking-[0.18em] text-indigo tabular-nums">
              {String(i + 1).padStart(2, '0')}
            </span>
            <p className="font-brand text-xl leading-snug tracking-tight sm:text-2xl">{b}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
