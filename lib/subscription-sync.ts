import { TIERS } from '@/lib/pricing'
import { supabaseAdmin } from '@/lib/supabase-admin'

export interface SyncInput {
  userId: string
  customerId: string
  subscriptionId: string
  status: string
  tier: string | null
  periodStart: number | null
  periodEnd: number | null
}

/** Reverse of priceIdFor: which tier owns this Stripe Price id, by env lookup. */
export function tierFromPriceId(priceId: string | undefined): string | null {
  if (!priceId) return null
  for (const t of TIERS) {
    if (process.env[t.priceEnvVar] && process.env[t.priceEnvVar] === priceId) return t.id
  }
  return null
}

const iso = (unixSeconds: number | null): string | null =>
  unixSeconds == null ? null : new Date(unixSeconds * 1000).toISOString()

/** The subscriptions row a Stripe subscription maps to. Pure, so it is tested. */
export function toRow(input: SyncInput): Record<string, unknown> {
  return {
    user_id: input.userId,
    stripe_customer_id: input.customerId,
    stripe_subscription_id: input.subscriptionId,
    status: input.status,
    tier: input.tier,
    current_period_start: iso(input.periodStart),
    current_period_end: iso(input.periodEnd),
    updated_at: new Date().toISOString(),
  }
}

/**
 * Write the row, keyed one-per-user. Upsert on user_id so a resubscription reuses
 * the same row rather than stacking. Service role: the webhook is server only.
 */
export async function upsertSubscription(input: SyncInput): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('subscriptions')
    .upsert(toRow(input), { onConflict: 'user_id' })
  if (error) throw new Error(`subscription upsert failed: ${error.message}`)
}
