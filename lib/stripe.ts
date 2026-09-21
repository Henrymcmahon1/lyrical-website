import 'server-only'
import Stripe from 'stripe'
import type { PlanId } from '@/lib/plans'

/**
 * One Stripe client per server instance. Test keys on omega, live keys only at promotion.
 * apiVersion is pinned to what the installed SDK ships types for, so `npm i stripe` upgrades
 * are a deliberate step (re-run the grep in the brief), never a drift.
 */
export const STRIPE_API_VERSION = '2026-08-26.dahlia' as const

let client: Stripe | null = null

export function stripe(): Stripe {
  if (client) return client
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY must be set')
  client = new Stripe(key, { apiVersion: STRIPE_API_VERSION, typescript: true })
  return client
}

const PRICE_ENV: Record<PlanId, string> = {
  single: 'STRIPE_PRICE_SINGLE',
  fan: 'STRIPE_PRICE_FAN',
  superfan: 'STRIPE_PRICE_SUPERFAN',
}

/** The Stripe price id for a plan, from env. Missing means a broken deploy, not a free song. */
export function priceIdFor(plan: PlanId): string {
  const name = PRICE_ENV[plan]
  if (!name) throw new Error(`unknown plan id: ${plan}`)
  const id = process.env[name]
  if (!id) throw new Error(`${name} must be set`)
  return id
}
