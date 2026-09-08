import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { tierFromPriceId, upsertSubscription, type SyncInput } from '@/lib/subscription-sync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Keep the local subscriptions table in step with Stripe.
 *
 * Signature-verified against STRIPE_WEBHOOK_SECRET: a wrong or missing signature
 * gets a 400 and nothing is written, so this endpoint cannot be driven by anyone
 * who does not hold the secret. The raw body is read with request.text(), because
 * verification is over the exact bytes Stripe signed.
 *
 * user_id rides on the subscription metadata (set at Checkout), so every
 * customer.subscription.* event knows whose row to write without a customer
 * lookup. checkout.session.completed carries it on the session and is used to
 * catch the very first activation.
 */
function subInputFromSubscription(s: Stripe.Subscription): SyncInput | null {
  const userId = (s.metadata?.user_id as string | undefined) ?? undefined
  if (!userId) return null
  const priceId = s.items?.data?.[0]?.price?.id
  // The billing period lives at the top level at runtime; recent Stripe types
  // model it more loosely, so read it through a narrow cast rather than fight the
  // type. Absent, it stays null and the row simply carries no period yet.
  const periods = s as unknown as {
    current_period_start?: number | null
    current_period_end?: number | null
  }
  return {
    userId,
    customerId: typeof s.customer === 'string' ? s.customer : s.customer.id,
    subscriptionId: s.id,
    status: s.status,
    tier: tierFromPriceId(priceId),
    periodStart: periods.current_period_start ?? null,
    periodEnd: periods.current_period_end ?? null,
  }
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const sig = request.headers.get('stripe-signature')
  if (!secret || !sig) return new Response('bad request', { status: 400 })

  const raw = await request.text()
  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, secret)
  } catch {
    // Do not echo the reason: a caller probing the endpoint learns nothing.
    return new Response('bad signature', { status: 400 })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.user_id
      const subId =
        typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id
      if (userId && subId) {
        const sub = await getStripe().subscriptions.retrieve(subId)
        // The session may not have stamped subscription metadata; ensure user_id.
        if (!sub.metadata?.user_id) sub.metadata = { ...sub.metadata, user_id: userId }
        const input = subInputFromSubscription(sub)
        if (input) await upsertSubscription(input)
      }
    } else if (
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted' ||
      event.type === 'customer.subscription.created'
    ) {
      const input = subInputFromSubscription(event.data.object as Stripe.Subscription)
      if (input) await upsertSubscription(input)
    }
  } catch (e) {
    // A write failure is a real fault: 500 so Stripe retries the event.
    console.error('[stripe-webhook] handler failed', e)
    return new Response('handler error', { status: 500 })
  }

  return Response.json({ received: true })
}
