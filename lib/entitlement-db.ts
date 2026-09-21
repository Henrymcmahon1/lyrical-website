import { supabaseAdmin } from '@/lib/supabase-admin'
import { ACTIVE_STATUSES, computeEntitlement, type Entitlement, type SubRow } from '@/lib/entitlement'
import { creditBalance } from '@/lib/credits'

/**
 * The I/O half of the entitlement gate: the subscription row, the count of ORIGINAL tracks
 * (reroll_index = 0) consumed this period, the credit ledger sum, then the pure decision.
 * Service-role client: callers have already verified the session.
 */
type Admin = ReturnType<typeof supabaseAdmin>

export type BillingSummary = {
  entitlement: Entitlement
  sub: SubRow
  usedThisPeriod: number
  creditBalance: number
}

export async function getBillingSummary(userId: string, admin: Admin = supabaseAdmin()): Promise<BillingSummary> {
  const { data: subData, error: subError } = await admin
    .from('subscriptions')
    .select('tier,status,current_period_start,current_period_end')
    .eq('user_id', userId)
    .maybeSingle()
  if (subError) throw new Error(subError.message)
  const sub = (subData as SubRow) ?? null

  let usedThisPeriod = 0
  if (sub && ACTIVE_STATUSES.has(sub.status)) {
    const base = admin
      .from('song_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('reroll_index', 0)
    // No period start yet (a brand-new subscription before invoice.paid lands): count every
    // consumed original. Conservative on purpose.
    const { count, error } = sub.current_period_start
      ? await base.gte('quota_consumed_at', sub.current_period_start)
      : await base.not('quota_consumed_at', 'is', null)
    if (error) throw new Error(error.message)
    usedThisPeriod = count ?? 0
  }

  const credits = await creditBalance(admin, userId)
  return {
    entitlement: computeEntitlement(sub, usedThisPeriod, credits),
    sub,
    usedThisPeriod,
    creditBalance: credits,
  }
}

export async function getEntitlementFor(userId: string, admin: Admin = supabaseAdmin()): Promise<Entitlement> {
  return (await getBillingSummary(userId, admin)).entitlement
}
