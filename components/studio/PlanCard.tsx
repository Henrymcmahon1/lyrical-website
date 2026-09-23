import type { Entitlement } from '@/lib/entitlement'
import { planById } from '@/lib/plans'
import { Panel, StatChip, button, link } from '@/components/studio/ui'

/**
 * The prominent "how many songs do I have left" card. Lives on /studio/new (Create) now, not
 * the studio home: this is the moment a customer is about to spend a track, so this is where
 * the number needs to be unmissable. Pure and presentational, so any page that already has an
 * Entitlement (lib/entitlement-db.ts getEntitlementFor / getBillingSummary) can drop it in.
 */
const OUT_OF_TRACKS = 'You are out of tracks for this period. Upgrade, buy a Single, or wait for it to renew.'
const NO_PLAN = 'Pick a plan to make your first track.'

export function PlanCard({ entitlement }: { entitlement: Entitlement }) {
  if (!entitlement.ok) {
    return (
      <Panel title="No tracks left" className="border-dark-accent/30">
        <p className="font-brand text-3xl font-semibold leading-tight text-dark-ink">No tracks left</p>
        <p className="mt-2 font-product text-sm leading-relaxed text-dark-ink/70">
          {entitlement.reason === 'period_exhausted' ? OUT_OF_TRACKS : NO_PLAN}
        </p>
        <a href="/pricing" className={`mt-4 inline-flex ${button.primary}`}>See plans<span className="shift-arrow">&rarr;</span></a>
      </Panel>
    )
  }

  const plan = planById(entitlement.plan)
  const renews = entitlement.renewsAt
    ? new Date(entitlement.renewsAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
    : null

  return (
    <Panel title="Your plan">
      <p className="font-brand text-3xl font-semibold leading-tight text-dark-ink">
        {entitlement.tracksLeft} track{entitlement.tracksLeft === 1 ? '' : 's'} left
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <StatChip label="Plan" value={plan?.name ?? 'Single'} />
        {renews ? <StatChip label="Renews" value={renews} /> : null}
      </div>
      <a href="/studio/billing" className={`mt-4 inline-block ${link}`}>Manage plan</a>
    </Panel>
  )
}
