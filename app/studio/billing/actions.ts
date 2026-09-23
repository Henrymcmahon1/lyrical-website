'use server'

import { redirect } from 'next/navigation'
import { planById, type PlanId } from '@/lib/plans'
import { priceIdFor, stripe } from '@/lib/stripe'
import { SITE_URL } from '@/lib/site'
import { currentUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * Checkout and the Billing Portal. Both end in Next's `redirect`, which throws, so neither
 * sits inside a try/catch. A subscriber changes plan through the portal, never a second
 * checkout: a second checkout would open a second subscription instead of swapping the price.
 */

/** Find or create the Stripe customer and remember it on profiles (the auth callback upserts the row at first sign-in). */
async function customerIdFor(user: { id: string; email?: string }): Promise<string> {
  const admin = supabaseAdmin()
  const { data } = await admin.from('profiles').select('stripe_customer_id').eq('id', user.id).maybeSingle()
  if (data?.stripe_customer_id) return data.stripe_customer_id
  const customer = await stripe().customers.create({ email: user.email, metadata: { user_id: user.id } })
  const { error } = await admin
    .from('profiles')
    .upsert({ id: user.id, stripe_customer_id: customer.id }, { onConflict: 'id' })
  if (error) throw new Error(error.message)
  return customer.id
}

export async function startCheckout(plan: PlanId): Promise<void> {
  const p = planById(plan)
  if (!p) throw new Error(`unknown plan id: ${plan}`)
  const user = await currentUser()
  if (!user) redirect(`/studio/sign-in?next=${encodeURIComponent(`/studio/billing?plan=${plan}`)}`)
  const customer = await customerIdFor(user)
  const session = await stripe().checkout.sessions.create({
    customer,
    mode: p.kind === 'one_off' ? 'payment' : 'subscription',
    line_items: [{ price: priceIdFor(plan), quantity: 1 }],
    success_url: `${SITE_URL}/studio?paid=1`,
    cancel_url: `${SITE_URL}/pricing`,
    metadata: { user_id: user.id, plan },
    ...(p.kind === 'subscription' ? { subscription_data: { metadata: { user_id: user.id, plan } } } : {}),
  })
  if (!session.url) throw new Error('Stripe returned a checkout session without a url')
  redirect(session.url)
}

export async function openBillingPortal(): Promise<void> {
  const user = await currentUser()
  if (!user) redirect('/studio/sign-in?next=/studio/billing')
  const session = await stripe().billingPortal.sessions.create({
    customer: await customerIdFor(user),
    return_url: `${SITE_URL}/studio/billing`,
  })
  redirect(session.url)
}
