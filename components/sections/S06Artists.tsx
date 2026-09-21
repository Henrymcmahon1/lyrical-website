import Link from 'next/link'
import { DOOR1 } from '@/content/two-doors'

/** The Door-1 block. Dark ground, so dark-accent carries the action; indigo fails contrast there. */
export default function S06Artists() {
  return (
    <section id="artists" className="bg-dark-ground py-24 text-dark-ink sm:py-28">
      <div className="mx-auto flex max-w-3xl flex-col items-start px-6">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-dark-ink/50">{DOOR1.label}</span>
        <h2 className="mt-5 font-brand text-4xl leading-tight tracking-tight text-balance sm:text-5xl">{DOOR1.h}</h2>
        <p className="mt-6 max-w-xl leading-relaxed text-dark-ink/70">{DOOR1.p}</p>
        <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.16em] text-dark-ink/55">
          <li>30% royalty</li><li>$0 upfront</li><li>Lossless stems</li><li>Human QA</li>
        </ul>
        <p className="mt-6 text-sm text-dark-ink/55">{DOOR1.precedent}</p>
        <Link href="/artists" className="nudge mt-10 rounded-card bg-dark-accent px-8 py-4 text-dark-ground">{DOOR1.cta} <span className="shift-arrow">&rarr;</span></Link>
      </div>
    </section>
  )
}
