'use server'

import { currentUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getStripe, stripeConfigured } from '@/lib/stripe'
import { priceIdFor, tierById } from '@/lib/pricing'

export type ActionResult = { ok: false; error: string } | { ok: true; url: string }

function origin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://lyricalglobal.com'
}

const NOT_CONNECTED = 'Payments are not connected yet. Please try again shortly.'

export async function startCheckout(tierId: string): Promise<ActionResult> {
  const user = await currentUser()
  if (!user) return { ok: false, error: 'Sign in to subscribe.' }

  const tier = tierById(tierId)
  if (!tier) return { ok: false, error: 'That plan does not exist.' }

  if (!stripeConfigured()) return { ok: false, error: NOT_CONNECTED }
  const price = priceIdFor(tier)
  if (!price) return { ok: false, error: NOT_CONNECTED }

  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price, quantity: 1 }],
    customer_email: user.email ?? undefined,
    // user_id on BOTH the session and the subscription, so checkout.session.completed
    // and every later customer.subscription.* event can find the row to write.
    metadata: { user_id: user.id },
    subscription_data: { metadata: { user_id: user.id } },
    success_url: `${origin()}/studio?subscribed=1`,
    cancel_url: `${origin()}/pricing`,
    allow_promotion_codes: true,
  })

  if (!session.url) return { ok: false, error: NOT_CONNECTED }
  return { ok: true, url: session.url }
}

export async function openBillingPortal(): Promise<ActionResult> {
  const user = await currentUser()
  if (!user) return { ok: false, error: 'Sign in to manage your plan.' }
  if (!stripeConfigured()) return { ok: false, error: NOT_CONNECTED }

  const { data } = await supabaseAdmin()
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const customer = data?.stripe_customer_id
  if (!customer) return { ok: false, error: 'No subscription to manage yet.' }

  const session = await getStripe().billingPortal.sessions.create({
    customer,
    return_url: `${origin()}/studio`,
  })
  return { ok: true, url: session.url }
}
