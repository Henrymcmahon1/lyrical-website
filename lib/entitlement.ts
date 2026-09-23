import type { Tables } from './db/database.types'
import { planById, REROLLS_PER_TRACK, type PlanId } from './plans'

/**
 * Who may submit a track right now. Pure: the callers fetch the rows and counts, this decides.
 *
 * A subscription with tracks left this period wins. Otherwise a positive credit balance (Single
 * purchases) allows one track. Otherwise nothing. Fails closed on anything unknown: a tier this
 * code does not recognise is not a plan, and a status other than active or trialing is not a
 * subscription.
 *
 * Re-rolls never pass through here. They consume nothing and are counted separately.
 */
export type SubRow = Pick<
  Tables<'subscriptions'>,
  'tier' | 'status' | 'current_period_start' | 'current_period_end'
> | null

export type Entitlement =
  | {
      ok: true
      source: 'subscription' | 'credit'
      plan: PlanId | null
      tracksLeft: number
      renewsAt: string | null
    }
  | { ok: false; reason: 'no_plan' | 'period_exhausted' }

export const ACTIVE_STATUSES: ReadonlySet<string> = new Set(['active', 'trialing'])

export function computeEntitlement(
  sub: SubRow,
  usedThisPeriod: number,
  creditBalance: number,
): Entitlement {
  const plan = sub && ACTIVE_STATUSES.has(sub.status) ? planById(sub.tier) : null
  const subscribed = !!plan && plan.kind === 'subscription'
  if (subscribed) {
    const left = plan.tracks - usedThisPeriod
    if (left > 0) {
      return {
        ok: true,
        source: 'subscription',
        plan: plan.id,
        tracksLeft: left,
        renewsAt: sub!.current_period_end,
      }
    }
  }
  if (creditBalance > 0) {
    return { ok: true, source: 'credit', plan: 'single', tracksLeft: creditBalance, renewsAt: null }
  }
  return { ok: false, reason: subscribed ? 'period_exhausted' : 'no_plan' }
}

/** How many free re-rolls a track has left, given how many child jobs already exist. */
export function rerollsLeft(childCount: number): number {
  return Math.max(0, REROLLS_PER_TRACK - childCount)
}
