import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/supabase-server'
import { getBillingSummary } from '@/lib/entitlement-db'
import { PLANS, SUBSCRIPTION_PLANS, planById, priceFor, type PlanId } from '@/lib/plans'
import { PageHead, Panel, StatChip, button, link } from '@/components/studio/ui'
import { openBillingPortal, startCheckout } from './actions'

/**
 * The plan a signed-in customer is on, what it has left this period, the credit balance, and
 * the three money buttons. `?plan=<id>` is the handoff from /pricing: the visitor signs in with
 * `next=/studio/billing?plan=<id>` (URL-encoded) and lands straight in Stripe Checkout.
 *
 * Plan names and prices come from lib/plans.ts and are never typed here. Drawn as a StatChip
 * row inside a Panel, the dashboard's instrument-panel language.
 */
export const metadata = { title: 'Billing', robots: { index: false, follow: false } }

const day = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'the next billing date'

export default async function Billing({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const [user, params] = await Promise.all([currentUser(), searchParams])
  const here = `/studio/billing${params.plan ? `?plan=${params.plan}` : ''}`
  if (!user) redirect(`/studio/sign-in?next=${encodeURIComponent(here)}`)

  // /pricing buttons land here with ?plan=<id>: straight to Stripe, no second click.
  const wanted = planById(params.plan)
  if (wanted) await startCheckout(wanted.id)

  const { sub, usedThisPeriod, creditBalance } = await getBillingSummary(user.id)
  const plan = sub?.status === 'active' ? planById(sub.tier) : null
  const subscribed = !!plan && plan.kind === 'subscription'

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHead eyebrow="Billing" title="Your plan." />

      <Panel title={subscribed ? plan.name : 'No plan yet'}>
        <div className="flex flex-wrap gap-2">
          {subscribed && (
            <>
              <StatChip label="Monthly" value={`$${priceFor(plan.id)}`} />
              <StatChip label="Used" value={`${usedThisPeriod} of ${plan.tracks}`} />
              <StatChip
                label="Left"
                value={Math.max(0, plan.tracks - usedThisPeriod)}
                tone={plan.tracks - usedThisPeriod <= 0 ? 'action' : 'neutral'}
              />
            </>
          )}
          <StatChip label="Single credits" value={creditBalance} />
        </div>
        {subscribed && (
          <p className="mt-4 font-product text-sm text-dark-ink/60">Renews on {day(sub!.current_period_end)}</p>
        )}
        <p className="mt-2 font-product text-sm text-dark-ink/60">
          A credit makes one track and never expires.
        </p>
      </Panel>

      <div className="flex flex-wrap gap-3">
        {subscribed ? (
          <form action={openBillingPortal}>
            <button type="submit" className={button.ghost}>
              Change plan
            </button>
          </form>
        ) : (
          SUBSCRIPTION_PLANS.map((id) => (
            <form key={id} action={startCheckout.bind(null, id)}>
              <button type="submit" className={button.primary}>
                Upgrade to {PLANS[id].name}, ${priceFor(id)} a month
              </button>
            </form>
          ))
        )}
        <form action={startCheckout.bind(null, 'single' as PlanId)}>
          <button type="submit" className={button.ghost}>
            Buy a Single, ${priceFor('single')}
          </button>
        </form>
      </div>

      <p className="font-product text-sm text-dark-ink/55">
        Founding prices. Sign up now and keep them for life.{' '}
        <a href="/pricing" className={link}>
          See plans
        </a>
      </p>
    </div>
  )
}
