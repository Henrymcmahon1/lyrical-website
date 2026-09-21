import { STEPS } from '@/content/two-doors'
import { Reveal } from '../Reveal'

/** How it works, three static steps. PinnedStepper is the rights-holder journey and stays with S05How. */
export default function S03Steps() {
  return (
    <section id="how" className="mx-auto max-w-5xl px-6 py-24">
      <h2 className="font-brand text-4xl leading-tight tracking-tight sm:text-5xl">How it works</h2>
      <ol className="mt-12 grid gap-10 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.h}>
            <Reveal delay={i * 90}>
              <span className="font-mono text-xs tabular-nums text-indigo">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="mt-3 font-brand text-2xl tracking-tight">{s.h}</h3>
              <p className="mt-3 leading-relaxed text-graphite/75">{s.p}</p>
            </Reveal>
          </li>
        ))}
      </ol>
    </section>
  )
}
