/**
 * The single source of truth for Door 2 tiers. Prices and cover counts are the
 * locked business numbers (2026-09-08). The actual Stripe Price id for each tier
 * is an env var, so test and live use different products without a code change.
 */
export type TierId = 'starter' | 'creator' | 'pro'

export interface Tier {
  id: TierId
  name: string
  priceDisplay: string
  priceUsd: number
  covers: number
  priceEnvVar: string
  blurb: string
}

export const TIERS: readonly Tier[] = [
  {
    id: 'starter',
    name: 'Starter',
    priceDisplay: '$29',
    priceUsd: 29,
    covers: 3,
    priceEnvVar: 'STRIPE_PRICE_STARTER',
    blurb: 'Three covers a month. For the artist testing the water.',
  },
  {
    id: 'creator',
    name: 'Creator',
    priceDisplay: '$79',
    priceUsd: 79,
    covers: 12,
    priceEnvVar: 'STRIPE_PRICE_CREATOR',
    blurb: 'Twelve covers a month. For a steady release schedule.',
  },
  {
    id: 'pro',
    name: 'Pro',
    priceDisplay: '$199',
    priceUsd: 199,
    covers: 40,
    priceEnvVar: 'STRIPE_PRICE_PRO',
    blurb: 'Forty covers a month. For a catalog going multilingual.',
  },
]

export function tierById(id: string): Tier | undefined {
  return TIERS.find((t) => t.id === id)
}

export function priceIdFor(tier: Tier): string | undefined {
  return process.env[tier.priceEnvVar] || undefined
}
