# Bot A: Payments (Stripe test mode, credits, entitlement gate, billing page)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Paste this to start the session:**
> Read `docs/superpowers/specs/2026-09-22-two-doors-v2-design.md` then `docs/bots/BOT-A-payments.md` in `C:\Users\User\CascadeProjects\lyrical-website`. Work on branch `feat/v2-payments` off `develop` (Bot 0's `feat/v2-prep` must already be merged). Never touch `main`. Execute the brief task by task, TDD, one commit per task. Never type a Stripe key into any file; I fill `.env.local` and the Vercel env myself.

**Goal:** A fan can buy a Single or subscribe to Fan or Superfan with a Stripe test card on omega, the webhook writes the subscription or credit to Supabase, `/studio/billing` shows the plan, and `submitSelfServeJob` gates on `computeEntitlement` and consumes a credit when that is what paid for the track.

**Architecture:** Stripe Node SDK in test mode. One client singleton (`lib/stripe.ts`). Two server actions start Checkout and open the Billing Portal. One route handler receives webhooks: it verifies the signature on the raw body, claims the event id in `stripe_events` for idempotency, then hands the event to a pure module (`lib/stripe-webhook.ts`) that reaches the database only through an injected `deps` object, so it is unit-tested with constructed events and fakes. `lib/credits.ts` is the only writer of `song_credits`. `lib/entitlement-db.ts` fetches the three inputs and calls Bot 0's pure `computeEntitlement`.

**Tech Stack:** Next 16 (App Router; `cookies()`, `headers()`, `searchParams` are async), TypeScript, Vitest (`@/` alias), Supabase service-role client, `stripe` npm (new dependency), `tsx` for scripts.

**Spec:** `docs/superpowers/specs/2026-09-22-two-doors-v2-design.md` (§4, §5, §11, §12)

## Global Constraints

- Branch `feat/v2-payments` off `develop`. PR into `develop`. Never touch `main`, the `lyrical-website` Vercel project, or lyricalglobal.com. Omega (Vercel project `lyrical-studio`, team `hjam`, https://lyrical-studio-omega.vercel.app) deploys `develop`.
- No em dashes anywhere: code, comments, tests, docs, commit messages.
- Secrets never go into files. `.env.local` is gitignored (`.env*` rule) and Henry fills it. Scripts read it and strip surrounding quotes (`sk_test_...` values are often pasted quoted).
- You own only: `app/api/stripe/**`, `app/studio/billing/**`, `lib/stripe.ts`, `lib/stripe-webhook.ts`, `lib/credits.ts`, `lib/entitlement-db.ts`, `scripts/stripe-setup.ts`, `tests/stripe-*.test.ts`, and the entitlement block of `app/studio/self-serve-actions.ts` (Task 8 names the exact lines). Bot C adds one licence field to that file after you merge; touch nothing else in it.
- Consume Bot 0's exports as-is: `PLANS`, `PlanId`, `planById`, `priceFor`, `SUBSCRIPTION_PLANS` from `@/lib/plans`; `computeEntitlement`, `SubRow`, `Entitlement`, `ACTIVE_STATUSES` from `@/lib/entitlement`. Never redefine them.
- Fail loud: a missing env value, an unknown plan id, an unknown lookup_key prefix all throw with a named message.
- Visitor copy: lowercase `lyrical`, US spelling, strings from `docs/v2/copy-deck.md`.
- `npm test && npm run build` green before the PR.

## File structure

| File | Responsibility |
|---|---|
| `lib/stripe.ts` | client singleton (apiVersion pinned), `priceIdFor(plan)` from env |
| `scripts/stripe-setup.ts` | idempotent product + price creation keyed on `lookup_key`; prints price ids |
| `lib/credits.ts` | `creditBalance`, `addCredit`, `consumeCredit` on `song_credits` |
| `lib/entitlement-db.ts` | `getBillingSummary(userId)`, `getEntitlementFor(userId)` |
| `lib/stripe-webhook.ts` | `handleStripeEvent(event, deps)`, `tierFromLookupKey`, `periodOf` |
| `app/api/stripe/webhook/route.ts` | raw-body signature check, `stripe_events` idempotency, wires deps, stamps `processed_at` |
| `app/studio/billing/actions.ts` | `startCheckout(plan)`, `openBillingPortal()` |
| `app/studio/billing/page.tsx` | plan card, usage, credits, buttons; `?plan=<id>` starts checkout |
| `app/studio/self-serve-actions.ts` | the entitlement block only |
| `tests/stripe-*.test.ts` | unit tests, one file per module |

---

### Task 1: Branch, dependency, client singleton

**Files:** Create `lib/stripe.ts`. `package.json` changes via `npm i`.

**Interfaces:** Produces `stripe(): Stripe`, `priceIdFor(plan: PlanId): string`, `STRIPE_API_VERSION`.

- [ ] **Step 1: Branch and install**

```bash
git checkout develop && git pull && git checkout -b feat/v2-payments
npm i stripe
grep -o "LATEST_API_VERSION = '[^']*'" node_modules/stripe/cjs/apiVersion.js
```

The grep prints the API version the installed SDK's types are generated for. Pin exactly that string in Step 2 (the SDK's `apiVersion` type accepts only that literal). The code shows the value as of writing; use the printed one if it differs.

- [ ] **Step 2: Write `lib/stripe.ts`**

```ts
import 'server-only'
import Stripe from 'stripe'
import type { PlanId } from '@/lib/plans'

/**
 * One Stripe client per server instance. Test keys on omega, live keys only at promotion.
 * apiVersion is pinned to what the installed SDK ships types for, so `npm i stripe` upgrades
 * are a deliberate step (re-run the grep in the brief), never a drift.
 */
export const STRIPE_API_VERSION = '2026-01-28.clover' as const

let client: Stripe | null = null

export function stripe(): Stripe {
  if (client) return client
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY must be set')
  client = new Stripe(key, { apiVersion: STRIPE_API_VERSION, typescript: true })
  return client
}

const PRICE_ENV: Record<PlanId, string> = { single: 'STRIPE_PRICE_SINGLE', fan: 'STRIPE_PRICE_FAN', superfan: 'STRIPE_PRICE_SUPERFAN' }

/** The Stripe price id for a plan, from env. Missing means a broken deploy, not a free song. */
export function priceIdFor(plan: PlanId): string {
  const name = PRICE_ENV[plan]
  if (!name) throw new Error(`unknown plan id: ${plan}`)
  const id = process.env[name]
  if (!id) throw new Error(`${name} must be set`)
  return id
}
```

- [ ] **Step 3:** `npx tsc --noEmit -p .` then `git add package.json package-lock.json lib/stripe.ts && git commit -m "feat(stripe): client singleton with pinned api version"`

### Task 2: `scripts/stripe-setup.ts`

**Files:** Create `scripts/stripe-setup.ts`, `tests/stripe-setup.test.ts`.

**Interfaces:** Produces `CATALOG`, `stripQuotes`, `readEnvLocal`, `ensurePrice(stripe, entry)`.

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it, vi } from 'vitest'
import { CATALOG, ensurePrice, stripQuotes } from '@/scripts/stripe-setup'

describe('stripe-setup', () => {
  it('lists the six locked lookup keys with cents from lib/plans', () => {
    expect(CATALOG.map((c) => c.lookupKey)).toEqual([
      'single_founding', 'single_standard', 'fan_founding', 'fan_standard', 'superfan_founding', 'superfan_standard',
    ])
    expect(CATALOG[2]).toMatchObject({ unitAmount: 1900, recurring: true })
    expect(CATALOG[1]).toMatchObject({ unitAmount: 1200, recurring: false })
  })
  it('strips surrounding quotes from .env values', () => {
    expect(stripQuotes('"sk_test_abc"')).toBe('sk_test_abc')
    expect(stripQuotes('sk_test_abc')).toBe('sk_test_abc')
  })
  it('reuses an existing price, else creates product then price', async () => {
    const fake = {
      prices: { list: vi.fn().mockResolvedValueOnce({ data: [{ id: 'price_old' }] }).mockResolvedValueOnce({ data: [] }), create: vi.fn().mockResolvedValue({ id: 'price_new' }) },
      products: { search: vi.fn().mockResolvedValue({ data: [] }), create: vi.fn().mockResolvedValue({ id: 'prod_new' }) },
    }
    expect(await ensurePrice(fake as never, CATALOG[0])).toBe('price_old')
    expect(await ensurePrice(fake as never, CATALOG[2])).toBe('price_new')
    expect(fake.prices.create).toHaveBeenCalledWith(expect.objectContaining({
      product: 'prod_new', unit_amount: 1900, currency: 'usd', lookup_key: 'fan_founding', recurring: { interval: 'month' },
    }))
  })
})
```

- [ ] **Step 2: Run, expect FAIL** `npx vitest run tests/stripe-setup.test.ts`

- [ ] **Step 3: Implement**

```ts
/**
 * Creates the Door-2 products and prices in the Stripe account behind STRIPE_SECRET_KEY.
 * Idempotent: every price is keyed on lookup_key, so re-running finds and prints, never duplicates.
 * Run: npx tsx scripts/stripe-setup.ts   (reads STRIPE_SECRET_KEY from .env.local)
 * Henry copies the printed ids into the omega Vercel env as STRIPE_PRICE_SINGLE/FAN/SUPERFAN.
 */
import { readFileSync } from 'node:fs'
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

export const stripQuotes = (v: string) => v.trim().replace(/^(["'])(.*)\1$/, '$2')

export function readEnvLocal(name: string): string {
  const line = readFileSync('.env.local', 'utf8').split('\n').find((l) => l.startsWith(name + '='))
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
    ...(entry.recurring ? { recurring: { interval: 'month' } } : {}),
  })
  return created.id
}

async function main() {
  const key = readEnvLocal('STRIPE_SECRET_KEY')
  if (!key.startsWith('sk_test_')) throw new Error('refusing to run: STRIPE_SECRET_KEY is not a test key')
  const s = new Stripe(key)
  for (const entry of CATALOG) console.log(`${entry.lookupKey.padEnd(20)} ${await ensurePrice(s, entry)}`)
  console.log('\nVercel env while FOUNDING_BETA: STRIPE_PRICE_SINGLE=single_founding id, STRIPE_PRICE_FAN=fan_founding id, STRIPE_PRICE_SUPERFAN=superfan_founding id')
}

if (process.argv[1]?.endsWith('stripe-setup.ts')) main().catch((e) => { console.error(e); process.exit(1) })
```

The `sk_test_` guard means this script can never create products in a live account by accident.

- [ ] **Step 4: Run, expect PASS.** Once Henry has put `STRIPE_SECRET_KEY` in `.env.local`, run `npx tsx scripts/stripe-setup.ts` and paste the printed ids (never the key) into the PR body. Commit: `git add scripts/stripe-setup.ts tests/stripe-setup.test.ts && git commit -m "feat(stripe): idempotent product and price setup script"`

### Task 3: `lib/credits.ts`

**Files:** Create `lib/credits.ts`, `tests/stripe-credits.test.ts`.

**Interfaces:** Produces `creditBalance(admin, userId)`, `addCredit(admin, {userId, reason, stripeEventId})`, `consumeCredit(admin, {userId, jobId})`. `admin` is `ReturnType<typeof supabaseAdmin>`.

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { addCredit, consumeCredit, creditBalance } from '@/lib/credits'

const insert = vi.fn()
const eq = vi.fn()
const admin = { from: vi.fn(() => ({ insert, select: () => ({ eq }) })) }

beforeEach(() => { insert.mockReset(); eq.mockReset() })

describe('credits', () => {
  it('sums delta rows for the user; a read error throws', async () => {
    eq.mockResolvedValueOnce({ data: [{ delta: 1 }, { delta: 1 }, { delta: -1 }], error: null })
    expect(await creditBalance(admin as never, 'u1')).toBe(1)
    expect(admin.from).toHaveBeenCalledWith('song_credits')
    expect(eq).toHaveBeenCalledWith('user_id', 'u1')
    eq.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    await expect(creditBalance(admin as never, 'u1')).rejects.toThrow('boom')
  })
  it('addCredit writes +1 with the stripe event id', async () => {
    insert.mockResolvedValue({ error: null })
    await addCredit(admin as never, { userId: 'u1', reason: 'purchase_single', stripeEventId: 'evt_1' })
    expect(insert).toHaveBeenCalledWith({ user_id: 'u1', delta: 1, reason: 'purchase_single', stripe_event_id: 'evt_1' })
  })
  it('consumeCredit writes -1 against the job and reports failure as false', async () => {
    insert.mockResolvedValueOnce({ error: null })
    expect(await consumeCredit(admin as never, { userId: 'u1', jobId: 'j1' })).toBe(true)
    expect(insert).toHaveBeenCalledWith({ user_id: 'u1', delta: -1, reason: 'consume', job_id: 'j1' })
    insert.mockResolvedValueOnce({ error: { message: 'rls' } })
    expect(await consumeCredit(admin as never, { userId: 'u1', jobId: 'j1' })).toBe(false)
  })
})
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
import type { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * The song_credits ledger. Append only: a Single purchase is +1, a submit that spends it is -1,
 * a refund or staff grant is +1. The balance is the sum, never a stored counter, so a replayed
 * webhook (blocked by stripe_event_id unique) or a crashed submit cannot leave a wrong number.
 * Only the service role writes here; customers have no insert policy.
 */
type Admin = ReturnType<typeof supabaseAdmin>

export async function creditBalance(admin: Admin, userId: string): Promise<number> {
  const { data, error } = await admin.from('song_credits').select('delta').eq('user_id', userId)
  if (error) throw new Error(error.message)
  return (data ?? []).reduce((sum, row) => sum + (row.delta as number), 0)
}

export async function addCredit(
  admin: Admin,
  args: { userId: string; reason: 'purchase_single' | 'refund' | 'grant'; stripeEventId: string | null },
): Promise<void> {
  const { error } = await admin
    .from('song_credits')
    .insert({ user_id: args.userId, delta: 1, reason: args.reason, stripe_event_id: args.stripeEventId })
  if (error) throw new Error(error.message)
}

/** Returns false instead of throwing: the caller must delete the job it just inserted. */
export async function consumeCredit(admin: Admin, args: { userId: string; jobId: string }): Promise<boolean> {
  const { error } = await admin.from('song_credits').insert({ user_id: args.userId, delta: -1, reason: 'consume', job_id: args.jobId })
  return !error
}
```

- [ ] **Step 4: Run, expect PASS.** Commit: `git add lib/credits.ts tests/stripe-credits.test.ts && git commit -m "feat(credits): song_credits ledger helpers"`

### Task 4: `lib/entitlement-db.ts`

**Files:** Create `lib/entitlement-db.ts`, `tests/stripe-entitlement-db.test.ts`.

**Interfaces:** Consumes `computeEntitlement`, `SubRow`, `Entitlement`, `ACTIVE_STATUSES` (Bot 0), `creditBalance` (Task 3). Produces `getBillingSummary(userId, admin?)` returning `{ entitlement, sub, usedThisPeriod, creditBalance }` and `getEntitlementFor(userId, admin?)` returning `Entitlement`. Bot C imports `getEntitlementFor` for the `/studio/new` redirect.

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'

const subQ = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn() }
const jobsQ = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), gte: vi.fn(), not: vi.fn() }
const creditsQ = { select: vi.fn().mockReturnThis(), eq: vi.fn() }
const admin = { from: (t: string) => (t === 'subscriptions' ? subQ : t === 'song_jobs' ? jobsQ : creditsQ) }
vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: () => admin }))
const { getBillingSummary, getEntitlementFor } = await import('@/lib/entitlement-db')

const fan = { tier: 'fan', status: 'active', current_period_start: '2026-09-01T00:00:00Z', current_period_end: '2026-10-01T00:00:00Z' }

beforeEach(() => {
  vi.clearAllMocks()
  jobsQ.gte.mockResolvedValue({ count: 2, error: null })
  creditsQ.eq.mockResolvedValue({ data: [], error: null })
})

describe('entitlement-db', () => {
  it('counts originals since the period start and feeds computeEntitlement', async () => {
    subQ.maybeSingle.mockResolvedValue({ data: fan, error: null })
    const s = await getBillingSummary('u1', admin as never)
    expect(jobsQ.eq).toHaveBeenCalledWith('reroll_index', 0)
    expect(jobsQ.gte).toHaveBeenCalledWith('quota_consumed_at', fan.current_period_start)
    expect(s).toMatchObject({ usedThisPeriod: 2, entitlement: { ok: true, source: 'subscription', tracksLeft: 3 } })
  })
  it('no subscription fails closed unless credits exist', async () => {
    subQ.maybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await getEntitlementFor('u1', admin as never)).toEqual({ ok: false, reason: 'no_plan' })
    creditsQ.eq.mockResolvedValue({ data: [{ delta: 1 }], error: null })
    expect(await getEntitlementFor('u1', admin as never)).toMatchObject({ ok: true, source: 'credit' })
  })
})
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ACTIVE_STATUSES, computeEntitlement, type Entitlement, type SubRow } from '@/lib/entitlement'
import { creditBalance } from '@/lib/credits'

/**
 * The I/O half of the entitlement gate: the subscription row, the count of ORIGINAL tracks
 * (reroll_index = 0) consumed this period, the credit ledger sum, then the pure decision.
 * Service-role client: callers have already verified the session.
 */
type Admin = ReturnType<typeof supabaseAdmin>

export type BillingSummary = { entitlement: Entitlement; sub: SubRow; usedThisPeriod: number; creditBalance: number }

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
    const base = admin.from('song_jobs').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('reroll_index', 0)
    // No period start yet (a brand-new subscription before invoice.paid lands): count every
    // consumed original. Conservative on purpose.
    const { count, error } = sub.current_period_start
      ? await base.gte('quota_consumed_at', sub.current_period_start)
      : await base.not('quota_consumed_at', 'is', null)
    if (error) throw new Error(error.message)
    usedThisPeriod = count ?? 0
  }

  const credits = await creditBalance(admin, userId)
  return { entitlement: computeEntitlement(sub, usedThisPeriod, credits), sub, usedThisPeriod, creditBalance: credits }
}

export async function getEntitlementFor(userId: string, admin: Admin = supabaseAdmin()): Promise<Entitlement> {
  return (await getBillingSummary(userId, admin)).entitlement
}
```

- [ ] **Step 4: Run, expect PASS.** Commit: `git add lib/entitlement-db.ts tests/stripe-entitlement-db.test.ts && git commit -m "feat(entitlement): db-backed getEntitlementFor"`

### Task 5: `lib/stripe-webhook.ts` (pure handlers)

**Files:** Create `lib/stripe-webhook.ts`, `tests/stripe-webhook.test.ts`.

**Interfaces:** Produces `WebhookDeps`, `handleStripeEvent(event, deps)`, `tierFromLookupKey(key)`, `periodOf(sub)`. On current API versions the billing period lives on the subscription ITEM (`items.data[0].current_period_start`) and an invoice's subscription id at `invoice.parent.subscription_details.subscription`; the helpers read those shapes and the tests pin them. If `tsc` says `current_period_start` is not on `SubscriptionItem`, the pinned version predates the move: read `sub.current_period_start` instead and adjust the fixture. No casts.

- [ ] **Step 1: Failing tests**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type Stripe from 'stripe'
import { handleStripeEvent, periodOf, tierFromLookupKey, type WebhookDeps } from '@/lib/stripe-webhook'

const sub = {
  id: 'sub_1', customer: 'cus_1', status: 'active',
  items: { data: [{ current_period_start: 1758000000, current_period_end: 1760592000, price: { lookup_key: 'fan_founding' } }] },
} as unknown as Stripe.Subscription
const period = { current_period_start: '2025-09-16T05:20:00.000Z', current_period_end: '2025-10-16T05:20:00.000Z' }
const deps: WebhookDeps = {
  addCredit: vi.fn(), upsertSubscription: vi.fn(), updateSubscriptionByStripeId: vi.fn(),
  retrieveSubscription: vi.fn().mockResolvedValue(sub),
}
const ev = (type: string, object: unknown) => ({ id: 'evt_1', type, data: { object } }) as unknown as Stripe.Event

beforeEach(() => vi.clearAllMocks())

describe('helpers', () => {
  it('maps lookup_key prefixes to tiers and rejects strangers', () => {
    expect(tierFromLookupKey('superfan_standard')).toBe('superfan')
    expect(() => tierFromLookupKey('pro_founding')).toThrow('unknown lookup_key')
  })
  it('reads the period from the first item as ISO strings', () => expect(periodOf(sub)).toEqual(period))
})

describe('handleStripeEvent', () => {
  it('checkout payment grants one credit keyed on the event id', async () => {
    const r = await handleStripeEvent(ev('checkout.session.completed', { mode: 'payment', metadata: { user_id: 'u1', plan: 'single' } }), deps)
    expect(deps.addCredit).toHaveBeenCalledWith({ userId: 'u1', reason: 'purchase_single', stripeEventId: 'evt_1' })
    expect(r).toEqual({ handled: true })
  })
  it('checkout subscription upserts the row from the retrieved subscription', async () => {
    await handleStripeEvent(ev('checkout.session.completed', { mode: 'subscription', subscription: 'sub_1', customer: 'cus_1', metadata: { user_id: 'u1', plan: 'fan' } }), deps)
    expect(deps.upsertSubscription).toHaveBeenCalledWith({
      user_id: 'u1', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1', tier: 'fan', status: 'active', ...period,
    })
  })
  it('checkout without a user_id throws, never a silent skip', async () => {
    await expect(handleStripeEvent(ev('checkout.session.completed', { mode: 'payment', metadata: {} }), deps)).rejects.toThrow('user_id')
  })
  it('subscription updated and deleted patch status, tier and period', async () => {
    await handleStripeEvent(ev('customer.subscription.deleted', { ...sub, status: 'canceled' }), deps)
    expect(deps.updateSubscriptionByStripeId).toHaveBeenCalledWith('sub_1', { status: 'canceled', tier: 'fan', ...period })
  })
  it('invoice.paid refreshes the period; a one-off invoice and unknown types are ignored', async () => {
    await handleStripeEvent(ev('invoice.paid', { parent: { subscription_details: { subscription: 'sub_1' } } }), deps)
    expect(deps.updateSubscriptionByStripeId).toHaveBeenCalledWith('sub_1', { status: 'active', ...period })
    expect(await handleStripeEvent(ev('invoice.paid', { parent: null }), deps)).toEqual({ handled: false })
    expect(await handleStripeEvent(ev('charge.refunded', {}), deps)).toEqual({ handled: false })
  })
})
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
import type Stripe from 'stripe'
import { SUBSCRIPTION_PLANS, type PlanId } from '@/lib/plans'

/**
 * What each Stripe event means for our tables. Pure: no Stripe client, no Supabase client,
 * everything arrives through `deps`, so the route stays thin and these run in tests with
 * hand-built events. Idempotency (stripe_events) is the route's job, not this module's.
 */
export type SubscriptionUpsert = {
  user_id: string; stripe_customer_id: string; stripe_subscription_id: string; tier: PlanId; status: string
  current_period_start: string | null; current_period_end: string | null
}
export type SubscriptionPatch = Partial<Pick<SubscriptionUpsert, 'tier' | 'status' | 'current_period_start' | 'current_period_end'>>

export type WebhookDeps = {
  addCredit(args: { userId: string; reason: 'purchase_single'; stripeEventId: string }): Promise<void>
  upsertSubscription(row: SubscriptionUpsert): Promise<void>
  updateSubscriptionByStripeId(stripeSubscriptionId: string, patch: SubscriptionPatch): Promise<void>
  retrieveSubscription(id: string): Promise<Stripe.Subscription>
}

export function tierFromLookupKey(key: string | null | undefined): PlanId {
  const prefix = key?.split('_')[0]
  if (prefix && (SUBSCRIPTION_PLANS as readonly string[]).includes(prefix)) return prefix as PlanId
  throw new Error(`unknown lookup_key: ${key ?? 'null'}`)
}

const iso = (epoch: number | null | undefined) => (epoch ? new Date(epoch * 1000).toISOString() : null)
const idOf = (ref: string | { id: string } | null | undefined) => (typeof ref === 'string' ? ref : ref?.id ?? null)

export function periodOf(sub: Stripe.Subscription) {
  const item = sub.items.data[0]
  return { current_period_start: iso(item?.current_period_start), current_period_end: iso(item?.current_period_end) }
}

export async function handleStripeEvent(event: Stripe.Event, deps: WebhookDeps): Promise<{ handled: boolean }> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.user_id
      if (!userId) throw new Error('metadata.user_id missing on checkout session')
      if (session.mode === 'payment') {
        await deps.addCredit({ userId, reason: 'purchase_single', stripeEventId: event.id })
        return { handled: true }
      }
      const subId = idOf(session.subscription)
      if (!subId) throw new Error('subscription-mode checkout carries no subscription id')
      const sub = await deps.retrieveSubscription(subId)
      await deps.upsertSubscription({
        user_id: userId,
        stripe_customer_id: idOf(session.customer) ?? idOf(sub.customer) ?? '',
        stripe_subscription_id: sub.id,
        tier: tierFromLookupKey(sub.items.data[0]?.price.lookup_key),
        status: sub.status,
        ...periodOf(sub),
      })
      return { handled: true }
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await deps.updateSubscriptionByStripeId(sub.id, { status: sub.status, tier: tierFromLookupKey(sub.items.data[0]?.price.lookup_key), ...periodOf(sub) })
      return { handled: true }
    }
    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice
      const subId = idOf(invoice.parent?.subscription_details?.subscription)
      if (!subId) return { handled: false }
      await deps.updateSubscriptionByStripeId(subId, { status: 'active', ...periodOf(await deps.retrieveSubscription(subId)) })
      return { handled: true }
    }
    default:
      return { handled: false }
  }
}
```

- [ ] **Step 4: Run, expect PASS.** Commit: `git add lib/stripe-webhook.ts tests/stripe-webhook.test.ts && git commit -m "feat(stripe): pure webhook handlers with tests"`

### Task 6: `app/api/stripe/webhook/route.ts`

**Files:** Create `app/api/stripe/webhook/route.ts`, `tests/stripe-webhook-route.test.ts`.

- [ ] **Step 1: Failing test** (signature verification mocked at the boundary)

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'

const constructEvent = vi.fn()
vi.mock('@/lib/stripe', () => ({ stripe: () => ({ webhooks: { constructEvent }, subscriptions: { retrieve: vi.fn() } }) }))
const handle = vi.fn().mockResolvedValue({ handled: true })
vi.mock('@/lib/stripe-webhook', () => ({ handleStripeEvent: (...a: unknown[]) => handle(...a) }))
const insert = vi.fn()
const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }))
vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: () => ({ from: () => ({ insert, update, upsert: vi.fn() }) }) }))
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
const { POST } = await import('@/app/api/stripe/webhook/route')

const req = () => new Request('http://localhost/api/stripe/webhook', { method: 'POST', headers: { 'stripe-signature': 't=1,v1=abc' }, body: '{}' })
const event = { id: 'evt_1', type: 'invoice.paid', data: { object: {} } }

beforeEach(() => { vi.clearAllMocks(); insert.mockResolvedValue({ error: null }) })

describe('POST /api/stripe/webhook', () => {
  it('400 on a bad signature and never touches the database', async () => {
    constructEvent.mockImplementationOnce(() => { throw new Error('bad sig') })
    expect((await POST(req())).status).toBe(400)
    expect(insert).not.toHaveBeenCalled()
  })
  it('claims the event, handles it, stamps processed_at', async () => {
    constructEvent.mockReturnValue(event)
    expect((await POST(req())).status).toBe(200)
    expect(insert).toHaveBeenCalledWith({ id: 'evt_1', type: 'invoice.paid' })
    expect(handle).toHaveBeenCalledOnce()
    expect(update).toHaveBeenCalledWith({ processed_at: expect.any(String) })
  })
  it('a replayed event id is 200 and skips the handler; a handler failure is 500 so Stripe retries', async () => {
    constructEvent.mockReturnValue(event)
    insert.mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate' } })
    expect((await POST(req())).status).toBe(200)
    expect(handle).not.toHaveBeenCalled()
    handle.mockRejectedValueOnce(new Error('db down'))
    expect((await POST(req())).status).toBe(500)
  })
})
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { addCredit } from '@/lib/credits'
import { handleStripeEvent, type WebhookDeps } from '@/lib/stripe-webhook'

export const runtime = 'nodejs'

/**
 * Stripe calls this. In order: prove the body came from Stripe (raw text, never a parsed body,
 * or the signature cannot match); claim the event id in stripe_events so a retry or replay is
 * a no-op; hand the event to the pure handlers; stamp processed_at. A thrown handler is a 500
 * on purpose: Stripe retries, and the unprocessed row shows what still needs doing.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return new Response('STRIPE_WEBHOOK_SECRET must be set', { status: 500 })
  const body = await request.text()

  let event
  try {
    event = stripe().webhooks.constructEvent(body, request.headers.get('stripe-signature') ?? '', secret)
  } catch {
    return new Response('invalid signature', { status: 400 })
  }

  const admin = supabaseAdmin()
  const { error: claim } = await admin.from('stripe_events').insert({ id: event.id, type: event.type })
  if (claim?.code === '23505') return new Response('already processed', { status: 200 })
  if (claim) return new Response(claim.message, { status: 500 })

  const deps: WebhookDeps = {
    addCredit: (args) => addCredit(admin, args),
    upsertSubscription: async (row) => {
      const { error } = await admin.from('subscriptions').upsert(row, { onConflict: 'user_id' })
      if (error) throw new Error(error.message)
    },
    updateSubscriptionByStripeId: async (id, patch) => {
      const { error } = await admin.from('subscriptions').update(patch).eq('stripe_subscription_id', id)
      if (error) throw new Error(error.message)
    },
    retrieveSubscription: (id) => stripe().subscriptions.retrieve(id),
  }

  try {
    await handleStripeEvent(event, deps)
  } catch (e) {
    console.error('stripe webhook failed', event.id, event.type, e)
    return new Response('handler failed', { status: 500 })
  }
  await admin.from('stripe_events').update({ processed_at: new Date().toISOString() }).eq('id', event.id)
  return new Response('ok', { status: 200 })
}
```

`onConflict: 'user_id'` needs a unique constraint on `subscriptions.user_id`. Check in the SQL editor: `select conname from pg_constraint where conrelid = 'public.subscriptions'::regclass;`. If none covers `user_id`, ask Henry to run `alter table public.subscriptions add constraint subscriptions_user_id_key unique (user_id);` (one user, one subscription row is the model) and record it in the PR body.

- [ ] **Step 4: Run, expect PASS.** Commit: `git add app/api/stripe tests/stripe-webhook-route.test.ts && git commit -m "feat(stripe): webhook route with signature check and idempotency"`

### Task 7: Billing actions and page

**Files:** Create `app/studio/billing/actions.ts`, `app/studio/billing/page.tsx`.

**Interfaces:** Produces `startCheckout(plan: PlanId)`, `openBillingPortal()`. Both end in Next's `redirect`, which throws, so it is never inside a try/catch.

- [ ] **Step 1: Write `app/studio/billing/actions.ts`**

```ts
'use server'

import { redirect } from 'next/navigation'
import { planById, type PlanId } from '@/lib/plans'
import { priceIdFor, stripe } from '@/lib/stripe'
import { SITE_URL } from '@/lib/site'
import { currentUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

/** Find or create the Stripe customer and remember it on profiles (the auth callback upserts the row at first sign-in). */
async function customerIdFor(user: { id: string; email?: string }): Promise<string> {
  const admin = supabaseAdmin()
  const { data } = await admin.from('profiles').select('stripe_customer_id').eq('id', user.id).maybeSingle()
  if (data?.stripe_customer_id) return data.stripe_customer_id as string
  const customer = await stripe().customers.create({ email: user.email, metadata: { user_id: user.id } })
  const { error } = await admin.from('profiles').upsert({ id: user.id, stripe_customer_id: customer.id }, { onConflict: 'id' })
  if (error) throw new Error(error.message)
  return customer.id
}

export async function startCheckout(plan: PlanId): Promise<void> {
  const p = planById(plan)
  if (!p) throw new Error(`unknown plan id: ${plan}`)
  const user = await currentUser()
  if (!user) redirect(`/studio/sign-in?next=${encodeURIComponent(`/studio/billing?plan=${plan}`)}`)
  const customer = await customerIdFor(user)
  const session = await stripe().checkout.sessions.create({
    customer,
    mode: p.kind === 'one_off' ? 'payment' : 'subscription',
    line_items: [{ price: priceIdFor(plan), quantity: 1 }],
    success_url: `${SITE_URL}/studio?paid=1`,
    cancel_url: `${SITE_URL}/pricing`,
    metadata: { user_id: user.id, plan },
    ...(p.kind === 'subscription' ? { subscription_data: { metadata: { user_id: user.id, plan } } } : {}),
  })
  if (!session.url) throw new Error('Stripe returned a checkout session without a url')
  redirect(session.url)
}

export async function openBillingPortal(): Promise<void> {
  const user = await currentUser()
  if (!user) redirect('/studio/sign-in?next=/studio/billing')
  const session = await stripe().billingPortal.sessions.create({ customer: await customerIdFor(user), return_url: `${SITE_URL}/studio/billing` })
  redirect(session.url)
}
```

- [ ] **Step 2: Write `app/studio/billing/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/supabase-server'
import { getBillingSummary } from '@/lib/entitlement-db'
import { PLANS, planById, priceFor, type PlanId } from '@/lib/plans'
import { openBillingPortal, startCheckout } from './actions'

export const metadata = { title: 'Billing', robots: { index: false, follow: false } }

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'the next billing date')
const button = 'nudge inline-flex min-h-11 items-center rounded-card px-5 text-sm'

export default async function Billing({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const [user, params] = await Promise.all([currentUser(), searchParams])
  const here = `/studio/billing${params.plan ? `?plan=${params.plan}` : ''}`
  if (!user) redirect(`/studio/sign-in?next=${encodeURIComponent(here)}`)

  // /pricing buttons land here with ?plan=<id>: straight to Stripe, no second click.
  const wanted = planById(params.plan)
  if (wanted) await startCheckout(wanted.id)

  const { sub, usedThisPeriod, creditBalance } = await getBillingSummary(user.id)
  const plan = sub?.status === 'active' ? planById(sub.tier) : null
  const subscribed = !!plan && plan.kind === 'subscription'

  return (
    <section className="mx-auto max-w-3xl px-6 py-24 sm:py-28">
      <span className="font-mono text-xs tracking-[0.18em] text-graphite/45">The studio</span>
      <h1 className="mt-5 font-brand text-4xl leading-[1.1] tracking-tight text-balance">Your plan.</h1>

      <div className="mt-10 rounded-card border border-graphite/15 p-6">
        {subscribed ? (
          <>
            <p className="font-brand text-2xl tracking-tight">{plan.name}, ${priceFor(plan.id)} a month</p>
            <p className="mt-2 text-sm text-graphite/60">Renews on {day(sub!.current_period_end)}</p>
            <p className="mt-4">{usedThisPeriod} of {plan.tracks} tracks used this period. {Math.max(0, plan.tracks - usedThisPeriod)} left.</p>
          </>
        ) : (
          <p className="font-brand text-2xl tracking-tight">No plan yet</p>
        )}
        <p className="mt-2 text-sm text-graphite/60">Single credits: {creditBalance}. A credit makes one track and never expires.</p>
      </div>

      <div className="mt-8 flex flex-wrap gap-4">
        {subscribed ? (
          <form action={openBillingPortal}>
            <button type="submit" className={`${button} border border-graphite/25`}>Change plan</button>
          </form>
        ) : (
          (['fan', 'superfan'] as PlanId[]).map((id) => (
            <form key={id} action={startCheckout.bind(null, id)}>
              <button type="submit" className={`${button} bg-ember text-cream`}>Upgrade to {PLANS[id].name}, ${priceFor(id)} a month</button>
            </form>
          ))
        )}
        <form action={startCheckout.bind(null, 'single' as PlanId)}>
          <button type="submit" className={`${button} border border-graphite/25`}>Buy a Single, ${priceFor('single')}</button>
        </form>
      </div>

      <p className="mt-8 text-sm text-graphite/55">
        Founding beta prices. Sign up now and keep them for life. <a href="/pricing" className="underline underline-offset-4">See plans</a>
      </p>
    </section>
  )
}
```

Recorded decision: a subscriber's "Upgrade" goes through the Billing Portal (Change plan), not a second Checkout, because Checkout would create a second subscription instead of swapping the price. Only a non-subscriber sees the checkout upgrade buttons.

- [ ] **Step 3: Hand-off for Bot B** (goes in the PR body): `/pricing` buttons must link to `/studio/sign-in?next=` + `encodeURIComponent('/studio/billing?plan=fan')`. Unencoded, the `plan` query is split off the `next` value.

- [ ] **Step 4:** `npx tsc --noEmit -p .` then `git add app/studio/billing && git commit -m "feat(billing): checkout, portal and the billing page"`

### Task 8: Replace the quota gate in `app/studio/self-serve-actions.ts`

**Files:** Modify `app/studio/self-serve-actions.ts` (this block only). Create `tests/stripe-selfserve-gate.test.ts`.

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'

const getEntitlementFor = vi.fn()
vi.mock('@/lib/entitlement-db', () => ({ getEntitlementFor: (...a: unknown[]) => getEntitlementFor(...a) }))
const consumeCredit = vi.fn()
vi.mock('@/lib/credits', () => ({ consumeCredit: (...a: unknown[]) => consumeCredit(...a) }))
vi.mock('@/lib/turnstile', () => ({ verifyTurnstile: async () => ({ ok: true }) }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/lib/supabase-server', () => ({ currentUser: async () => ({ id: 'u1', email: 'fan@example.com' }) }))
const insert = vi.fn()
const del = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }))
vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: () => ({ from: () => ({ insert, delete: del }) }) }))
const { submitSelfServeJob } = await import('@/app/studio/self-serve-actions')

const jobId = '11111111-1111-4111-8111-111111111111'
const raw = {
  jobId, turnstileToken: 't', title: 'Song', primaryArtist: 'Artist', sourceLanguage: 'EN', targetLanguage: 'ES',
  assets: [
    { kind: 'instrumental', path: `submissions/u1/${jobId}/inst.wav`, filename: 'inst.wav', bytes: 10 },
    { kind: 'vocal', path: `submissions/u1/${jobId}/vox.wav`, filename: 'vox.wav', bytes: 10 },
  ],
}
const credit = { ok: true, source: 'credit', plan: 'single', tracksLeft: 1, renewsAt: null }

beforeEach(() => { vi.clearAllMocks(); insert.mockResolvedValue({ error: null }) })

describe('submitSelfServeJob entitlement gate', () => {
  it('refuses with the copy-deck line when not entitled', async () => {
    getEntitlementFor.mockResolvedValue({ ok: false, reason: 'no_plan' })
    expect(await submitSelfServeJob(raw)).toEqual({ ok: false, error: 'You are out of tracks for this period. Upgrade, buy a Single, or wait for it to renew.' })
    expect(insert).not.toHaveBeenCalled()
  })
  it('a subscription track consumes no credit; a credit track writes the consume row', async () => {
    getEntitlementFor.mockResolvedValueOnce({ ok: true, source: 'subscription', plan: 'fan', tracksLeft: 3, renewsAt: null })
    expect(await submitSelfServeJob(raw)).toEqual({ ok: true, jobId })
    expect(consumeCredit).not.toHaveBeenCalled()
    getEntitlementFor.mockResolvedValueOnce(credit)
    consumeCredit.mockResolvedValueOnce(true)
    expect(await submitSelfServeJob(raw)).toEqual({ ok: true, jobId })
    expect(consumeCredit).toHaveBeenCalledWith(expect.anything(), { userId: 'u1', jobId })
  })
  it('a failed consume deletes the job and reports an error', async () => {
    getEntitlementFor.mockResolvedValue(credit)
    consumeCredit.mockResolvedValue(false)
    expect((await submitSelfServeJob(raw)).ok).toBe(false)
    expect(del).toHaveBeenCalled()
  })
})
```

If `SongJobSchema` requires fields the fixture lacks, read `lib/song-job-schema.ts` and add exactly those to `raw`; never loosen the schema.

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Edit the file.** Add two imports beside the existing ones:

```ts
import { getEntitlementFor } from '@/lib/entitlement-db'
import { consumeCredit } from '@/lib/credits'
```

Delete these lines above `submitSelfServeJob`:

```ts
// Covers included per active billing period, by tier. Mirrors the studio serverless gate.
const ALLOWANCE: Record<string, number> = { starter: 3, creator: 12, pro: 40 }
const ACTIVE_STATUSES = new Set(['active', 'trialing'])
```

Replace the block from `// Quota gate: an active subscription with covers left this period. Fail closed.` down to and including the closing brace of `return { ok: false, error: 'You are out of covers for this period. Upgrade or wait for it to renew.' }` with:

```ts
  // Entitlement gate: an active plan with tracks left, else a Single credit. Fails closed.
  const entitlement = await getEntitlementFor(user.id, admin)
  if (!entitlement.ok) {
    return { ok: false, error: 'You are out of tracks for this period. Upgrade, buy a Single, or wait for it to renew.' }
  }
```

Immediately before the final `return { ok: true, jobId }` (after the assets insert has succeeded), add:

```ts
  // A credit-funded track spends the credit in the same path as the job insert. If the ledger
  // write fails the job goes too (assets cascade), so nobody gets a free render.
  if (entitlement.source === 'credit') {
    const consumed = await consumeCredit(admin, { userId: user.id, jobId })
    if (!consumed) {
      await admin.from('song_jobs').delete().eq('id', jobId)
      return { ok: false, error: 'We could not apply your credit. Try again in a moment.' }
    }
  }
```

Nothing else in the file changes. `quota_consumed_at: now` stays on the insert for both sources.

- [ ] **Step 4: Run, expect PASS**, then the whole suite `npm test`. Commit: `git add app/studio/self-serve-actions.ts tests/stripe-selfserve-gate.test.ts && git commit -m "feat(studio): self-serve gate uses computeEntitlement and consumes credits"`

### Task 9: Env, webhook endpoint, local run

**Files:** none in the repo. `.env.example` already carries the names (Bot 0).

- [ ] **Step 1: Tell Henry what to add to the omega Vercel project** (project `lyrical-studio`, team `hjam`, all three environments). Send this table verbatim:

| Name | Where it comes from |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe dashboard, Developers, API keys, test mode, `sk_test_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | same page, `pk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | the endpoint's signing secret after Step 2, `whsec_...` |
| `STRIPE_PRICE_SINGLE` | `single_founding` id printed by `npx tsx scripts/stripe-setup.ts` |
| `STRIPE_PRICE_FAN` | `fan_founding` id from the same output |
| `STRIPE_PRICE_SUPERFAN` | `superfan_founding` id from the same output |

Also confirm `NEXT_PUBLIC_SITE_URL` on omega is `https://lyrical-studio-omega.vercel.app`: the checkout success and cancel urls are built from it. Henry's local `.env.local` gets the same six values for the setup script and `next dev`.

- [ ] **Step 2: Register the webhook endpoint in the Stripe TEST dashboard.** URL `https://lyrical-studio-omega.vercel.app/api/stripe/webhook`; events `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`. Henry does it, or you do it in his signed-in Chrome: `ToolSearch select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__find,mcp__claude-in-chrome__form_input`, navigate to `https://dashboard.stripe.com/test/workbench/webhooks/create`, fill the URL, pick the four events, click Add endpoint, then tell Henry the signing secret is on screen for him to copy into Vercel. You never paste it anywhere. If the dashboard asks to sign in, stop and tell Henry.

- [ ] **Step 3: Local run note** (goes in the PR body): with the Stripe CLI signed in to the test account, run `stripe listen --forward-to localhost:3000/api/stripe/webhook`, put the printed `whsec_` into `.env.local` as `STRIPE_WEBHOOK_SECRET`, then `npm run dev`. `stripe trigger checkout.session.completed` hits the route without a browser; its fixture has no `user_id` metadata, so expect a 500 and an unprocessed `stripe_events` row. That is the fail-loud path working.

### Task 10: Verification and PR

- [ ] **Step 1:** `npm test && npm run build`, both green. Em-dash check prints nothing: `grep -rn $'\u2014' lib/stripe.ts lib/stripe-webhook.ts lib/credits.ts lib/entitlement-db.ts app/api/stripe app/studio/billing scripts/stripe-setup.ts tests/stripe-*.test.ts`

- [ ] **Step 2: Manual walkthrough on omega** once Henry confirms the env values and the endpoint (merge into `develop`, or ask Henry for a preview deploy of the branch). Record each line with the observed result in the PR body:

1. Sign in with a test account at `/studio/sign-in`.
2. Open `/studio/billing?plan=fan`. Expect an immediate redirect to Stripe Checkout showing Fan at $19.00 a month.
3. Pay with `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP. Expect a redirect to `/studio?paid=1`.
4. Supabase table editor (Henry's Chrome): `subscriptions` has one row for the user with `tier='fan'`, `status='active'`, both period stamps set; `stripe_events` shows `checkout.session.completed` and `invoice.paid` with `processed_at` set.
5. `/studio/billing` shows "Fan, $19 a month", the renewal date, "0 of 5 tracks used".
6. Buy a Single from the same page. Expect one `purchase_single` row in `song_credits` and "Single credits: 1" on the page.
7. Change plan opens the Billing Portal and returns to `/studio/billing`.
8. Replay: in the Stripe dashboard, resend the `checkout.session.completed` event. Expect 200 and no second credit or subscription row.

- [ ] **Step 3:** `git push -u origin feat/v2-payments`. Open a PR into `develop` titled "v2 payments: Stripe test mode, credits, entitlement gate, billing page". Body: the printed price ids, the walkthrough results, the Bot B encoding note, the `subscriptions.user_id` constraint check, the local `stripe listen` note. Tell Henry the branch is ready and that Bot C can rebase.

## Done when

- `tests/stripe-setup.test.ts`, `tests/stripe-credits.test.ts`, `tests/stripe-entitlement-db.test.ts`, `tests/stripe-webhook.test.ts`, `tests/stripe-webhook-route.test.ts`, `tests/stripe-selfserve-gate.test.ts` pass and `npm run build` is green.
- `npx tsx scripts/stripe-setup.ts` prints six price ids and prints the same six on a second run.
- The omega walkthrough (Task 10, Step 2) is recorded in the PR with every step observed.
- `submitSelfServeJob` no longer mentions `ALLOWANCE`, `starter`, `creator` or `pro`.
- PR open into `develop`.
