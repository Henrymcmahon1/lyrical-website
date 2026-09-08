// Create the three Lyrical subscription products + monthly prices in Stripe.
//
// Run it yourself with your TEST secret key in the environment (never commit the
// key, never paste it into chat). It is idempotent: it tags each product with
// metadata.lyrical_tier and reuses an existing one, so re-running does not create
// duplicates. It prints the three price ids as the env-var lines you then set.
//
//   Windows PowerShell:
//     $env:STRIPE_SECRET_KEY="sk_test_..."; node scripts/create-stripe-products.mjs
//   macOS / Linux / git-bash:
//     STRIPE_SECRET_KEY=sk_test_... node scripts/create-stripe-products.mjs
//
// The numbers below mirror lib/pricing.ts (the single source of truth).

import Stripe from 'stripe'

const key = process.env.STRIPE_SECRET_KEY
if (!key) {
  console.error('Set STRIPE_SECRET_KEY (use your TEST key, sk_test_...) and re-run.')
  process.exit(1)
}
if (!key.startsWith('sk_test_')) {
  console.error('That is not a TEST key. Use sk_test_... for the sandbox. Refusing to run.')
  process.exit(1)
}

const stripe = new Stripe(key)

const TIERS = [
  { id: 'starter', name: 'lyrical Starter', usd: 29, covers: 3, envVar: 'STRIPE_PRICE_STARTER' },
  { id: 'creator', name: 'lyrical Creator', usd: 79, covers: 12, envVar: 'STRIPE_PRICE_CREATOR' },
  { id: 'pro', name: 'lyrical Pro', usd: 199, covers: 40, envVar: 'STRIPE_PRICE_PRO' },
]

async function findProduct(tierId) {
  const res = await stripe.products.search({
    query: `metadata['lyrical_tier']:'${tierId}' AND active:'true'`,
  })
  return res.data[0] ?? null
}

async function ensureProduct(t) {
  const existing = await findProduct(t.id)
  if (existing) return existing
  return stripe.products.create({
    name: t.name,
    description: `${t.covers} covers a month`,
    metadata: { lyrical_tier: t.id, covers: String(t.covers) },
  })
}

async function ensurePrice(product, t) {
  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 100 })
  const want = t.usd * 100
  const match = prices.data.find(
    (p) => p.unit_amount === want && p.currency === 'usd' && p.recurring?.interval === 'month',
  )
  if (match) return match
  return stripe.prices.create({
    product: product.id,
    unit_amount: want,
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { lyrical_tier: t.id },
  })
}

const lines = []
for (const t of TIERS) {
  const product = await ensureProduct(t)
  const price = await ensurePrice(product, t)
  console.log(`  ${t.name.padEnd(16)} product ${product.id}  price ${price.id}  ($${t.usd}/mo)`)
  lines.push(`${t.envVar}=${price.id}`)
}

console.log('\nSet these env vars (in .env.local for local testing, and in Vercel for prod):\n')
console.log(lines.join('\n'))
console.log('\nDone. These are TEST-mode price ids; create the live ones the same way at launch.')
