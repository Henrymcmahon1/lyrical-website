/**
 * The three Door-2 plans. Single source of truth for prices and allowances: the pricing page,
 * the billing page, the Stripe setup script and the entitlement gate all read from here.
 *
 * Founding-beta prices are what checkout charges while FOUNDING_BETA is true. An existing
 * subscription keeps its Stripe price object when the flag flips, which is how grandfathering
 * works without any code: only NEW checkouts move to the standard price.
 *
 * Single is a one-off purchase that lands as a credit (`song_credits`), not a subscription.
 * Fan and Superfan are monthly subscriptions with a per-period track allowance.
 */
export type PlanId = 'single' | 'fan' | 'superfan'

export type Plan = {
  id: PlanId
  name: string
  kind: 'one_off' | 'subscription'
  /** Tracks per purchase (one_off) or per billing period (subscription). */
  tracks: number
  foundingUsd: number
  standardUsd: number
  blurb: string
}

export const PLANS: Record<PlanId, Plan> = {
  single: {
    id: 'single',
    name: 'Single',
    kind: 'one_off',
    tracks: 1,
    foundingUsd: 9,
    standardUsd: 12,
    blurb: 'Try it, or a one-off gift',
  },
  fan: {
    id: 'fan',
    name: 'Plus',
    kind: 'subscription',
    tracks: 5,
    foundingUsd: 19,
    standardUsd: 29,
    blurb: 'A few tracks a month',
  },
  superfan: {
    id: 'superfan',
    name: 'Pro',
    kind: 'subscription',
    tracks: 15,
    foundingUsd: 39,
    standardUsd: 59,
    blurb: 'Making tracks every week',
  },
}

export const PLAN_IDS: readonly PlanId[] = ['single', 'fan', 'superfan']
export const SUBSCRIPTION_PLANS: readonly PlanId[] = ['fan', 'superfan']

/** Free re-rolls per track, on every plan. */
export const REROLLS_PER_TRACK = 2

/** Flip to false when the beta ends. Checkout then charges standardUsd for new customers. */
export const FOUNDING_BETA = true

export function planById(id: string | null | undefined): Plan | null {
  return id && Object.prototype.hasOwnProperty.call(PLANS, id) ? PLANS[id as PlanId] : null
}

export function priceFor(id: PlanId): number {
  return FOUNDING_BETA ? PLANS[id].foundingUsd : PLANS[id].standardUsd
}
