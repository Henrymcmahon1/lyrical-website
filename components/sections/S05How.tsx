import { Reveal } from '../Reveal'

/** Numbering is legitimate here: this is a real sequence, not decoration. */
const STEPS = [
  {
    h: 'You send the song',
    p: 'The finished master, and the language or languages you want it in.',
  },
  {
    h: 'We recreate the lyrics',
    p: 'Rewritten to sing naturally on the original melody and rhythm, syllable by syllable.',
  },
  {
    h: 'We sing it in the voice',
    p: 'The vocal is performed in the artist’s own voice, in the new language.',
  },
  {
    h: 'You receive the assets',
    p: 'A finished mix plus a dry vocal stem, reviewed by ear before delivery.',
  },
]

export default function S05How() {
  return (
    <section id="how" className="mx-auto max-w-6xl px-6 py-24">
      <h2 className="font-brand text-4xl leading-tight tracking-tight sm:text-5xl">
        How it works
      </h2>
      <ol className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.h}>
            <Reveal delay={i * 80}>
              <span className="font-mono text-xs tracking-[0.18em] text-indigo">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-3 font-brand text-2xl leading-snug tracking-tight">{s.h}</h3>
              <p className="mt-3 text-sm leading-relaxed text-graphite/75">{s.p}</p>
            </Reveal>
          </li>
        ))}
      </ol>
    </section>
  )
}
