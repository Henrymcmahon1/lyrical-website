import { MarkLiving } from '../MarkLiving'
import { Reveal } from '../Reveal'

const CLAIMS = [
  {
    h: 'The artist’s real voice',
    p: 'Not a cover and not a soundalike. The new vocal carries the artist’s own timbre and character, so it truly sounds like them.',
  },
  {
    h: 'The original melody and feel',
    p: 'We never rewrite the tune. New lyrics are crafted to sing naturally on the exact original melody, rhythm and phrasing.',
  },
  {
    h: 'The backing stays untouched',
    p: 'Only the vocal changes. The original instrumental, groove and production are delivered exactly as they were.',
  },
  {
    h: 'Natural, singable translations',
    p: 'Never literal or robotic. Rewritten to feel native in the new language while staying true to the meaning and emotion of the original.',
  },
]

export default function S04Fidelity() {
  return (
    <section className="mx-auto grid max-w-6xl gap-14 px-6 py-24 md:grid-cols-2 md:gap-20">
      <div className="md:sticky md:top-28 md:self-start">
        <div className="text-indigo">
          <MarkLiving size={132} />
        </div>
        <h2 className="mt-8 font-brand text-4xl leading-tight tracking-tight text-balance">
          What changes is the language. Nothing else.
        </h2>
        <p className="mt-5 max-w-sm text-graphite/70">
          Every stage is measured against the original record, and every song is checked by
          ear before it reaches you.
        </p>
      </div>

      <ul className="flex flex-col gap-12">
        {CLAIMS.map((c, i) => (
          <li key={c.h}>
            <Reveal delay={i * 60}>
              <span className="font-mono text-xs tracking-[0.18em] text-graphite/45">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-3 font-brand text-2xl tracking-tight">{c.h}</h3>
              <p className="mt-3 leading-relaxed text-graphite/75">{c.p}</p>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  )
}
