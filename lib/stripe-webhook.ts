import type Stripe from 'stripe'
import { SUBSCRIPTION_PLANS, type PlanId } from '@/lib/plans'

/**
 * What each Stripe event means for our tables. Pure: no Stripe client, no Supabase client,
 * everything arrives through `deps`, so the route stays thin and these run in tests with
 * hand-built events. Idempotency (stripe_events) is the route's job, not this module's.
 */
export type SubscriptionUpsert = {
  user_id: string
  stripe_customer_id: string
  stripe_subscription_id: string
  tier: PlanId
  status: string
  current_period_start: string | null
  current_period_end: string | null
}
export type SubscriptionPatch = Partial<
  Pick<SubscriptionUpsert, 'tier' | 'status' | 'current_period_start' | 'current_period_end'>
>

export type WebhookDeps = {
  addCredit(args: { userId: string; reason: 'purchase_single'; stripeEventId: string }): Promise<void>
  upsertSubscription(row: SubscriptionUpsert): Promise<void>
  updateSubscriptionByStripeId(stripeSubscriptionId: string, patch: SubscriptionPatch): Promise<void>
  retrieveSubscription(id: string): Promise<Stripe.Subscription>
}

/** `fan_founding` -> `fan`. Only subscription plans have a tier; a Single is a credit, not a tier. */
export function tierFromLookupKey(key: string | null | undefined): PlanId {
  const prefix = key?.split('_')[0]
  if (prefix && (SUBSCRIPTION_PLANS as readonly string[]).includes(prefix)) return prefix as PlanId
  throw new Error(`unknown lookup_key: ${key ?? 'null'}`)
}

const iso = (epoch: number | null | undefined) => (epoch ? new Date(epoch * 1000).toISOString() : null)
const idOf = (ref: string | { id: string } | null | undefined) =>
  typeof ref === 'string' ? ref : (ref?.id ?? null)

/** The billing period lives on the subscription item on this API version, not the subscription. */
export function periodOf(sub: Stripe.Subscription) {
  const item = sub.items.data[0]
  return {
    current_period_start: iso(item?.current_period_start),
    current_period_end: iso(item?.current_period_end),
  }
}

export async function handleStripeEvent(event: Stripe.Event, deps: WebhookDeps): Promise<{ handled: boolean }> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.user_id
      if (!userId) throw new Error('metadata.user_id missing on checkout session')
      if (session.mode === 'payment') {
        await deps.addCredit({ userId, reason: 'purchase_single', stripeEventId: event.id })
        return { handled: true }
      }
      const subId = idOf(session.subscription)
      if (!subId) throw new Error('subscription-mode checkout carries no subscription id')
      const sub = await deps.retrieveSubscription(subId)
      await deps.upsertSubscription({
        user_id: userId,
        stripe_customer_id: idOf(session.customer) ?? idOf(sub.customer) ?? '',
        stripe_subscription_id: sub.id,
        tier: tierFromLookupKey(sub.items.data[0]?.price.lookup_key),
        status: sub.status,
        ...periodOf(sub),
      })
      return { handled: true }
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await deps.updateSubscriptionByStripeId(sub.id, {
        status: sub.status,
        tier: tierFromLookupKey(sub.items.data[0]?.price.lookup_key),
        ...periodOf(sub),
      })
      return { handled: true }
    }
    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice
      const subId = idOf(invoice.parent?.subscription_details?.subscription)
      if (!subId) return { handled: false }
      await deps.updateSubscriptionByStripeId(subId, {
        status: 'active',
        ...periodOf(await deps.retrieveSubscription(subId)),
      })
      return { handled: true }
    }
    default:
      return { handled: false }
  }
}
