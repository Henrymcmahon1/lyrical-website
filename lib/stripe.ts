import Stripe from 'stripe'

/**
 * Server-only Stripe client. NEVER import into a client component: the secret key
 * must not reach the browser. Fails loud when misconfigured rather than silently
 * dropping a payment, matching lib/supabase-admin.ts. Checkout is created
 * server-side, so there is no publishable key and no NEXT_PUBLIC_STRIPE_* var.
 */
export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

let client: Stripe | null = null

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY must be set')
  if (!client) client = new Stripe(key)
  return client
}
