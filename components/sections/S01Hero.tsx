import Link from 'next/link'
import { HERO } from '@/content/two-doors'
import { MarkUnlock } from '../MarkUnlock'
import { Parallax } from '../Parallax'
import { ScrollCue } from '../ScrollCue'

/** Rewritten 2026-09 for Door 2; the rights-holder story lives on /about and /ai-music-translation. */
export default function S01Hero() {
  return (
    <section className="relative mx-auto flex min-h-[84vh] max-w-6xl flex-col items-center justify-center px-6 py-20 text-center">
      <Parallax speed={0.06}><div className="text-indigo"><MarkUnlock size={156} /></div></Parallax>
      <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.18em] text-graphite/45">Founding beta</p>
      <h1 className="mt-4 font-brand text-5xl leading-[1.02] tracking-tight text-balance sm:text-6xl lg:text-7xl">{HERO.headline}</h1>
      <p className="mt-8 max-w-xl text-lg leading-relaxed text-graphite/75">{HERO.sub}</p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <Link href="/pricing" className="nudge rounded-card bg-ember px-7 py-4 text-cream">{HERO.primary} <span className="shift-arrow">&rarr;</span></Link>
        <Link href="/artists" className="nudge rounded-card border border-graphite/30 px-7 py-4 transition-colors hover:border-indigo hover:text-indigo">{HERO.secondary}</Link>
      </div>
      <ScrollCue />
    </section>
  )
}
