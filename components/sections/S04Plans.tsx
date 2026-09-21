import Link from 'next/link'
import { FOUNDING_LINE } from '@/content/two-doors'
import { PlanCards } from './PlanCards'

/** The home-page preview of the three plans; /pricing carries the full page. */
export default function S04Plans() {
  return (
    <section id="plans" className="mx-auto max-w-5xl px-6 py-24">
      <h2 className="font-brand text-4xl leading-tight tracking-tight sm:text-5xl">{FOUNDING_LINE}</h2>
      <div className="mt-12"><PlanCards compact /></div>
      <p className="mt-8 text-sm text-graphite/60">
        <Link href="/pricing" className="nudge inline-flex min-h-11 items-center underline underline-offset-4 hover:text-indigo">Everything on the pricing page <span className="shift-arrow">&rarr;</span></Link>
      </p>
    </section>
  )
}
