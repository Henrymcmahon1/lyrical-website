import { HONEST } from '@/content/two-doors'

/** Deliberately still, like S08Rights: honesty reads better without motion. */
export default function S05Beta() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-24 text-center">
      <span className="font-mono text-xs tracking-[0.18em] text-graphite/45">Rate it, re-roll it</span>
      <h2 className="mt-5 font-brand text-3xl leading-snug tracking-tight text-balance sm:text-4xl">{HONEST.h}</h2>
      {HONEST.p.map((p) => <p key={p.slice(0, 24)} className="mt-6 leading-relaxed text-graphite/75">{p}</p>)}
    </section>
  )
}
