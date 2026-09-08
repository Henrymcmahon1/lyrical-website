import { tierById } from '@/lib/pricing'
import { supabaseAdmin } from '@/lib/supabase-admin'

export interface SubRow {
  tier: string | null
  status: string
  current_period_start: string | null
  current_period_end: string | null
  stripe_customer_id: string | null
}

export const ACTIVE_STATUSES = ['active', 'trialing'] as const

export function isActive(status: string): boolean {
  return (ACTIVE_STATUSES as readonly string[]).includes(status)
}

export function allowanceFor(tier: string | null): number {
  if (!tier) return 0
  return tierById(tier)?.covers ?? 0
}

export interface QuotaStatus {
  entitled: boolean
  active: boolean
  tier: string | null
  allowance: number
  used: number
  remaining: number
  periodEnd: string | null
  hasCustomer: boolean
}

/**
 * The whole gate decision, made from a subscription row and a usage count. Pure,
 * so it is tested directly. Entitled means: active status AND at least one cover
 * left this period. Over-quota is a hard block (Henry's call, 2026-09-08): there
 * is no overage path here.
 */
export function computeQuota(sub: SubRow | null, used: number): QuotaStatus {
  const active = Boolean(sub) && isActive(sub!.status)
  const tier = sub?.tier ?? null
  const allowance = active ? allowanceFor(tier) : 0
  const remaining = Math.max(0, allowance - used)
  return {
    entitled: active && remaining > 0,
    active,
    tier,
    allowance,
    used,
    remaining,
    periodEnd: sub?.current_period_end ?? null,
    hasCustomer: Boolean(sub?.stripe_customer_id),
  }
}

/**
 * Server-only. Reads the user's subscription and counts the covers they have
 * consumed inside the current Stripe billing period, then decides the gate.
 *
 * Uses the service role and scopes every query by this user id explicitly.
 * quota_consumed_at is a staff/service-only column, so it cannot be read through
 * the customer's own client, which is why the count runs here rather than in the
 * page's RLS-scoped query.
 */
export async function quotaStatus(userId: string): Promise<QuotaStatus> {
  const db = supabaseAdmin()
  const { data: sub } = await db
    .from('subscriptions')
    .select('tier, status, current_period_start, current_period_end, stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (!sub || !isActive(sub.status)) return computeQuota((sub as SubRow) ?? null, 0)

  // Count consuming jobs since the period start. If Stripe has not given a period
  // yet, fall back to zero used rather than guessing a window.
  const since = sub.current_period_start
  let used = 0
  if (since) {
    const { count } = await db
      .from('song_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('quota_consumed_at', since)
    used = count ?? 0
  }
  return computeQuota(sub as SubRow, used)
}
