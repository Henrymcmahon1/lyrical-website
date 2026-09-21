import Link from 'next/link'
import { CLOSE } from '@/content/two-doors'
import { Reveal } from '../Reveal'

/** The creator close, off the home page since 2026-09-22. S10Start serves /, /about and /ai-music-translation. */
export default function S07Close() {
  return (
    <section id="start" className="bg-graphite py-24 text-cream sm:py-28">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <Reveal><h2 className="font-brand text-5xl leading-[1.05] tracking-tight text-balance sm:text-6xl">{CLOSE.h}</h2></Reveal>
        <Reveal delay={120}><p className="mx-auto mt-7 max-w-xl leading-relaxed text-cream/70">{CLOSE.p}</p></Reveal>
        <Reveal delay={200}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/pricing" className="nudge rounded-card bg-ember px-7 py-4 text-cream sm:px-8 sm:text-lg">{CLOSE.cta} <span className="shift-arrow">&rarr;</span></Link>
            <Link href="/artists" className="nudge inline-flex min-h-11 items-center rounded-card border border-cream/30 px-7 py-4 transition-colors hover:border-cream">For artists</Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
