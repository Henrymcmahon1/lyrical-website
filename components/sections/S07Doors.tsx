import { Stagger } from '../Stagger'

const DOORS = [
  {
    k: 'For artists and managers',
    h: 'One flagship release.',
    p: 'Open a song to a new market without re-recording it. Artist-approved, delivered ready for release, and yours to mix.',
    cta: 'Start with one song',
  },
  {
    k: 'For labels and catalogue owners',
    h: 'A catalogue programme.',
    p: 'Selected high-performing songs, priority territories, authorised asset creation, and reporting that feeds the next round of decisions.',
    cta: 'Discuss a catalogue programme',
  },
]

export default function S07Doors() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <Stagger className="grid gap-4 md:grid-cols-2">
        {DOORS.map((d) => (
          <div
            key={d.h}
            className="lift flex flex-col rounded-card border border-graphite/15 bg-cream p-8 sm:p-10"
          >
            <span className="font-mono text-xs tracking-[0.16em] text-graphite/45">
              {d.k}
            </span>
            <h3 className="mt-4 font-brand text-3xl leading-tight tracking-tight">{d.h}</h3>
            <p className="mt-4 leading-relaxed text-graphite/75">{d.p}</p>
            <a
              href="#enquire"
              className="mt-8 self-start rounded-card border border-indigo px-5 py-3 text-sm text-indigo transition-colors hover:bg-indigo hover:text-cream"
            >
              {d.cta} <span className="shift-arrow">&rarr;</span>
            </a>
          </div>
        ))}
      </Stagger>
    </section>
  )
}
