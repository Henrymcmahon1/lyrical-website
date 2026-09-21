import Link from 'next/link'
import { PLANS, PLAN_IDS, REROLLS_PER_TRACK, priceFor, type PlanId } from '@/lib/plans'
import { GOOD_FOR, MOST_POPULAR, PLAN_FEATURES } from '@/content/two-doors'

/** Sign in first, then land on billing with the plan carried through; Bot A's /studio/billing starts checkout from ?plan=. */
export function checkoutHref(id: PlanId): string {
  return `/studio/sign-in?next=${encodeURIComponent(`/studio/billing?plan=${id}`)}`
}

/**
 * Three cards. Every dollar comes from lib/plans.ts; tests fail if one is typed here.
 *
 * The struck-through standard price left the cards on 2026-09-22 on Henry's instruction: one
 * price per card, the founding one, and the page says once that it is kept for life. Each card
 * carries a "Good for" line and its own feature list instead. The featured card is the middle
 * plan, still id `fan` in lib/plans.ts; the id is a Stripe and database key and never renders.
 */
export function PlanCards({ compact = false }: { compact?: boolean }) {
  return (
    <ul className="grid gap-6 sm:grid-cols-3">
      {PLAN_IDS.map((id) => {
        const plan = PLANS[id]
        const featured = id === 'fan'
        const per = plan.kind === 'subscription' ? '/ month' : '/ track'
        return (
          <li key={id} className={`relative flex flex-col rounded-card border p-6 ${featured ? 'border-indigo' : 'border-graphite/15'}`}>
            {featured && <span className="absolute -top-3 left-6 rounded-card bg-indigo px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-cream">{MOST_POPULAR}</span>}
            <h3 className="font-brand text-2xl tracking-tight">{plan.name}</h3>
            <p className="mt-1 text-sm text-graphite/60">{GOOD_FOR[id]}</p>
            <p className="mt-5 font-brand text-5xl tracking-tight">${priceFor(id)}<span className="ml-1 text-base text-graphite/60">{per}</span></p>
            <ul className="mt-5 flex flex-col gap-2 text-sm text-graphite/75">
              <li>{plan.tracks} {plan.tracks === 1 ? 'track' : 'tracks'}{plan.kind === 'subscription' ? ' a month' : ''}</li>
              <li>{REROLLS_PER_TRACK} free re-rolls per track</li>
              {PLAN_FEATURES.map((f) => <li key={f}>{f}</li>)}
            </ul>
            <Link href={checkoutHref(id)} className={`nudge mt-6 inline-flex min-h-11 items-center justify-center rounded-card px-5 ${featured ? 'bg-ember text-cream' : 'border border-graphite/30 hover:border-indigo hover:text-indigo'}`}>
              {compact ? 'Choose' : `Choose ${plan.name}`}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
