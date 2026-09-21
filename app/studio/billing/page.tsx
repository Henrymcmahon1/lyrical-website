import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/supabase-server'
import { getBillingSummary } from '@/lib/entitlement-db'
import { PLANS, planById, priceFor, type PlanId } from '@/lib/plans'
import { openBillingPortal, startCheckout } from './actions'

/**
 * The plan a signed-in fan is on, what it has left this period, the credit balance, and the
 * three money buttons. `?plan=<id>` is the handoff from /pricing: the visitor signs in with
 * `next=/studio/billing?plan=fan` (URL-encoded) and lands straight in Stripe Checkout.
 */
export const metadata = { title: 'Billing', robots: { index: false, follow: false } }

const day = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'the next billing date'
const button = 'nudge inline-flex min-h-11 items-center rounded-card px-5 text-sm'

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
    <section className="mx-auto max-w-3xl px-6 py-24 sm:py-28">
      <span className="font-mono text-xs tracking-[0.18em] text-graphite/45">The studio</span>
      <h1 className="mt-5 font-brand text-4xl leading-[1.1] tracking-tight text-balance">Your plan.</h1>

      <div className="mt-10 rounded-card border border-graphite/15 p-6">
        {subscribed ? (
          <>
            <p className="font-brand text-2xl tracking-tight">
              {plan.name}, ${priceFor(plan.id)} a month
            </p>
            <p className="mt-2 text-sm text-graphite/60">Renews on {day(sub!.current_period_end)}</p>
            <p className="mt-4">
              {usedThisPeriod} of {plan.tracks} tracks used this period.{' '}
              {Math.max(0, plan.tracks - usedThisPeriod)} left.
            </p>
          </>
        ) : (
          <p className="font-brand text-2xl tracking-tight">No plan yet</p>
        )}
        <p className="mt-2 text-sm text-graphite/60">
          Single credits: {creditBalance}. A credit makes one track and never expires.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap gap-4">
        {subscribed ? (
          <form action={openBillingPortal}>
            <button type="submit" className={`${button} border border-graphite/25`}>
              Change plan
            </button>
          </form>
        ) : (
          (['fan', 'superfan'] as PlanId[]).map((id) => (
            <form key={id} action={startCheckout.bind(null, id)}>
              <button type="submit" className={`${button} bg-ember text-cream`}>
                Upgrade to {PLANS[id].name}, ${priceFor(id)} a month
              </button>
            </form>
          ))
        )}
        <form action={startCheckout.bind(null, 'single' as PlanId)}>
          <button type="submit" className={`${button} border border-graphite/25`}>
            Buy a Single, ${priceFor('single')}
          </button>
        </form>
      </div>

      <p className="mt-8 text-sm text-graphite/55">
        Founding beta prices. Sign up now and keep them for life.{' '}
        <a href="/pricing" className="underline underline-offset-4">
          See plans
        </a>
      </p>
    </section>
  )
}
