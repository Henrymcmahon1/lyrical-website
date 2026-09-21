import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { addCredit } from '@/lib/credits'
import { handleStripeEvent, type WebhookDeps } from '@/lib/stripe-webhook'

export const runtime = 'nodejs'

/**
 * Stripe calls this. In order: prove the body came from Stripe (raw text, never a parsed body,
 * or the signature cannot match); claim the event id in stripe_events so a retry or replay is
 * a no-op; hand the event to the pure handlers; stamp processed_at. A thrown handler is a 500
 * on purpose: Stripe retries, and the unprocessed row shows what still needs doing.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return new Response('STRIPE_WEBHOOK_SECRET must be set', { status: 500 })
  const body = await request.text()

  let event: Stripe.Event
  try {
    event = stripe().webhooks.constructEvent(body, request.headers.get('stripe-signature') ?? '', secret)
  } catch {
    return new Response('invalid signature', { status: 400 })
  }

  const admin = supabaseAdmin()
  const { error: claim } = await admin.from('stripe_events').insert({ id: event.id, type: event.type })
  if (claim?.code === '23505') return new Response('already processed', { status: 200 })
  if (claim) return new Response(claim.message, { status: 500 })

  const deps: WebhookDeps = {
    addCredit: (args) => addCredit(admin, args),
    upsertSubscription: async (row) => {
      const { error } = await admin.from('subscriptions').upsert(row, { onConflict: 'user_id' })
      if (error) throw new Error(error.message)
    },
    updateSubscriptionByStripeId: async (id, patch) => {
      const { error } = await admin.from('subscriptions').update(patch).eq('stripe_subscription_id', id)
      if (error) throw new Error(error.message)
    },
    retrieveSubscription: (id) => stripe().subscriptions.retrieve(id),
  }

  try {
    await handleStripeEvent(event, deps)
  } catch (e) {
    console.error('stripe webhook failed', event.id, event.type, e)
    // Release the claim, or Stripe's retry would read "already processed" and the event would
    // be lost for good. A claim only sticks once the handler has finished.
    await admin.from('stripe_events').delete().eq('id', event.id)
    return new Response('handler failed', { status: 500 })
  }
  await admin.from('stripe_events').update({ processed_at: new Date().toISOString() }).eq('id', event.id)
  return new Response('ok', { status: 200 })
}
