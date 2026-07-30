import { Stagger } from '../Stagger'

const ITEMS = [
  { h: 'Finished full mix', p: 'Matched to the original record’s vocal balance.' },
  { h: 'Dry vocal stem', p: 'Unprocessed, for your own engineer to mix as they like.' },
  { h: 'Reference versions', p: 'For A/B comparison against the original recording.' },
  { h: 'A per-song report', p: 'What was covered, what was left original, and where.' },
]

export default function S06Receive() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <h2 className="font-brand text-4xl leading-tight tracking-tight sm:text-5xl">
        What you receive
      </h2>

      <Stagger className="mt-14 grid gap-4 sm:grid-cols-2">
        {ITEMS.map((it) => (
          <div
            key={it.h}
            className="lift rounded-card border border-graphite/15 bg-cream p-8"
          >
            <h3 className="font-brand text-2xl tracking-tight">{it.h}</h3>
            <p className="mt-3 leading-relaxed text-graphite/75">{it.p}</p>
          </div>
        ))}
      </Stagger>

      <div className="mt-10 flex flex-wrap gap-x-10 gap-y-3 font-mono text-xs tracking-[0.14em] text-graphite/50 tabular-nums">
        <span>48.0 kHz</span>
        <span>24 bit</span>
        <span>08 languages</span>
        <span>Reviewed by ear</span>
      </div>

      <p className="mt-8 max-w-2xl text-sm leading-relaxed text-graphite/60">
        You keep full creative and mixing control. We iterate with you until the phrasing,
        pronunciation and feel are exactly right &mdash; from a single flagship release to an
        entire catalogue, at a pace that fits your rollout.
      </p>
    </section>
  )
}
