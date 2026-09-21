/**
 * Creates the Door-2 products and prices in the Stripe account behind STRIPE_SECRET_KEY.
 * Idempotent: every price is keyed on lookup_key, so re-running finds and prints, never duplicates.
 * Run: npx tsx scripts/stripe-setup.ts   (reads STRIPE_SECRET_KEY from .env.local)
 * Henry copies the printed ids into the omega Vercel env as STRIPE_PRICE_SINGLE/FAN/SUPERFAN.
 */
import { existsSync, readFileSync } from 'node:fs'
import Stripe from 'stripe'
import { PLANS, type PlanId } from '../lib/plans'

export type CatalogEntry = { plan: PlanId; lookupKey: string; unitAmount: number; recurring: boolean }

export const CATALOG: CatalogEntry[] = (['single', 'fan', 'superfan'] as PlanId[]).flatMap((plan) => {
  const p = PLANS[plan]
  const recurring = p.kind === 'subscription'
  return [
    { plan, lookupKey: `${plan}_founding`, unitAmount: p.foundingUsd * 100, recurring },
    { plan, lookupKey: `${plan}_standard`, unitAmount: p.standardUsd * 100, recurring },
  ]
})

/** `.env` values are often pasted with quotes around them; the key is the bare string inside. */
export const stripQuotes = (v: string) => v.trim().replace(/^(["'])(.*)\1$/, '$2')

export function readEnvLocal(name: string): string {
  if (!existsSync('.env.local')) throw new Error(`.env.local not found: cannot read ${name}`)
  const line = readFileSync('.env.local', 'utf8')
    .split('\n')
    .find((l) => l.startsWith(name + '='))
  const v = line ? stripQuotes(line.slice(name.length + 1)) : ''
  if (!v) throw new Error(`${name} missing from .env.local`)
  return v
}

async function ensureProduct(s: Stripe, plan: PlanId): Promise<string> {
  const found = await s.products.search({ query: `metadata['plan']:'${plan}' AND active:'true'`, limit: 1 })
  if (found.data[0]) return found.data[0].id
  return (await s.products.create({ name: `lyrical ${PLANS[plan].name}`, metadata: { plan } })).id
}

export async function ensurePrice(s: Stripe, entry: CatalogEntry): Promise<string> {
  const existing = await s.prices.list({ lookup_keys: [entry.lookupKey], limit: 1 })
  if (existing.data[0]) return existing.data[0].id
  const created = await s.prices.create({
    product: await ensureProduct(s, entry.plan),
    unit_amount: entry.unitAmount,
    currency: 'usd',
    lookup_key: entry.lookupKey,
    metadata: { plan: entry.plan },
    ...(entry.recurring ? { recurring: { interval: 'month' as const } } : {}),
  })
  return created.id
}

async function main() {
  const key = readEnvLocal('STRIPE_SECRET_KEY')
  if (!key.startsWith('sk_test_')) throw new Error('refusing to run: STRIPE_SECRET_KEY is not a test key')
  const s = new Stripe(key)
  for (const entry of CATALOG) console.log(`${entry.lookupKey.padEnd(20)} ${await ensurePrice(s, entry)}`)
  console.log(
    '\nVercel env while FOUNDING_BETA: STRIPE_PRICE_SINGLE=single_founding id, STRIPE_PRICE_FAN=fan_founding id, STRIPE_PRICE_SUPERFAN=superfan_founding id',
  )
}

if (process.argv[1]?.endsWith('stripe-setup.ts')) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
