# Chunk E: payments + quota (Stripe) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Door 2 user subscribe to a tier, get N covers a month, and gate every cover on an active subscription plus remaining quota, with Stripe as the billing source of truth.

**Architecture:** A `subscriptions` table (RLS own-read) is kept in sync by a signature-verified Stripe webhook. Tiers/prices/allowances live in one config file (`lib/pricing.ts`). Quota usage is counted server-side (service role) as consuming song_jobs inside the Stripe billing period. A two-sided gate blocks the submit action when there is no active sub or no quota (website), and the pipeline service layer re-checks the same entitlement before it spends. Built dark on `feat/payments`, tested with Stripe test keys and mocked webhooks. Nothing live until Henry deploys.

**Tech Stack:** Next.js 16 App Router (server actions + route handlers, async cookies/headers), TypeScript, Supabase (Postgres + RLS + column grants), Stripe Node SDK (server only, Checkout + Billing Portal + Webhooks), Vitest. Pipeline side: Python, httpx against Supabase PostgREST.

## Global Constraints

- **Git local only.** Branch `feat/payments` off `feat/deliveries`. Never `git push`. Commit trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **The website deploys on push to main.** Repo is PUBLIC. Never commit a secret. All Stripe keys are Vercel env vars, set by Henry at deploy.
- **No em dashes** anywhere (code, docs, copy). Use a colon, a comma, or a new sentence.
- **US spelling** in visitor copy (authorized, catalog, program). Identifiers keep old spelling. Banned copy (`AI-generated`, `Solutions`, `6.4x`, `2.38B`) is enforced by `tests/copy.test.ts`.
- **Brand locked:** cream #F7EFE1, graphite #1C1A19, indigo #4433D6, ember #EE4E22. Fraunces + Archivo self-hosted. No gradients. Ember never carries body text. Indigo never on dark ground.
- **Lowercase `lyrical`** everywhere a visitor or machine reads it. Legal entity `Lyrical Global Technologies, Inc.` is the only exception (lib/terms.ts).
- **Security model:** RLS on every customer table; customer reads via their own client, service role bypasses RLS and is server-only. A NEW column on `song_jobs` is invisible to customers until added to the column SELECT grant, and the grant must be REWRITTEN (revoke + full re-grant), never extended. Staff/service-only columns are deliberately NOT added to the customer grant (like `internal_notes`, `pipeline_*`).
- **Fail loud:** the Stripe client throws when unconfigured (like `supabaseAdmin`). Routes catch and return a clear error; the pricing CTA is disabled when Stripe is not configured, so the site still builds and deploys dark.
- **No secret in a `NEXT_PUBLIC_` var** (test-enforced). Checkout is server-created, so no publishable key reaches the client and no `NEXT_PUBLIC_STRIPE_*` is needed.
- **Verify before done:** `npm test`, `npx tsc --noEmit`, `npx eslint .`, `npm run build`. Pipeline: `PYTHONUTF8=1 .venv/Scripts/python.exe -m pytest -q`.
- **Locked answers (2026-09-08):** tiers Starter $29/3, Creator $79/12, Pro $199/40; over-quota = HARD BLOCK (no overage); quota resets on the Stripe billing anniversary; NO free cover (subscription required from the first); build against Stripe TEST mode, Henry adds live keys.

## E / F boundary (read once)

Chunk E builds the primitives and the BLOCK: the table, Stripe plumbing, the quota accounting library, the gate that REFUSES a submit when the user is not entitled, the pricing page, the studio billing panel, and the pipeline re-check. When an entitled user submits, E stamps `quota_consumed_at` on the job so usage is real and testable. Chunk F (later) adds the AUTO-RUN on that same entitled path: set `pipeline_state='queued'` and move `status` so the poller runs it with no human accept. E must not set `pipeline_state`; F owns that.

## File structure

Website (`C:\Users\User\Documents\Claude\lyrical-website`):

- Create `lib/pricing.ts` : single source of tiers (id, name, price display, covers/mo, price env var). Pure.
- Create `lib/stripe.ts` : server-only Stripe client factory, fails loud; `stripeConfigured()` boolean.
- Create `lib/quota.ts` : pure quota math (`allowanceFor`, `remaining`, `isEntitled`) plus a server helper `quotaStatus(userId)` (service role) that reads the sub and counts consuming jobs in the period.
- Create `lib/subscription-sync.ts` : pure mapping from a Stripe subscription object to a `subscriptions` row + `upsertSubscription` (service role writer).
- Create `app/api/stripe-webhook/route.ts` : verify signature, upsert subscription state.
- Create `app/pricing/subscribe-actions.ts` : server actions `startCheckout(tierId)` and `openBillingPortal()`.
- Create `app/pricing/page.tsx` : the pricing page (brand) with subscribe CTAs.
- Create `components/PricingTiers.tsx` : the tier cards + subscribe buttons (client, posts to the server action).
- Create `components/BillingPanel.tsx` : the "2 of 3 left" panel + Customer Portal link, rendered in `/studio`.
- Modify `app/studio/page.tsx` : render `BillingPanel` with the user's quota status.
- Modify `app/studio/submit-actions.ts` : call the gate before saving; on success stamp `quota_consumed_at`.
- Modify `supabase/schema.sql` : add `subscriptions` table + RLS + grant; add `quota_consumed_at` to `song_jobs` (staff/service only, NOT in the customer grant).
- Modify `package.json` : add `stripe` dependency.
- Tests under `tests/`: `pricing.test.ts`, `stripe-config.test.ts`, `quota.test.ts`, `subscription-sync.test.ts`, `stripe-webhook-route.test.ts`, `subscribe-actions.test.ts`, `submit-gate.test.ts`, `billing-panel.test.tsx`, `pricing-page.test.tsx`.

Pipeline (`C:\Users\User\CascadeProjects\lyrical-studio`):

- Modify `dashboard/service/website/client.py` : add `active_entitlement(user_id)` read.
- Modify `dashboard/service/website/poller.py` : re-check entitlement after claim, before `create_song`; stamp `failed` and skip spend if not entitled.
- Tests under `tests/dashboard/website/` : extend the client + poller tests.

---

### Task 1: Pricing config (single source of tiers)

**Files:**
- Create: `lib/pricing.ts`
- Test: `tests/pricing.test.ts`

**Interfaces:**
- Produces: `type TierId = 'starter' | 'creator' | 'pro'`; `interface Tier { id: TierId; name: string; priceDisplay: string; priceUsd: number; covers: number; priceEnvVar: string; blurb: string }`; `const TIERS: readonly Tier[]`; `function tierById(id: string): Tier | undefined`; `function priceIdFor(tier: Tier): string | undefined` (reads `process.env[tier.priceEnvVar]`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/pricing.test.ts
import { describe, it, expect } from 'vitest'
import { TIERS, tierById, priceIdFor } from '@/lib/pricing'

describe('pricing config', () => {
  it('has the three locked tiers with the agreed numbers', () => {
    expect(TIERS.map((t) => [t.id, t.priceUsd, t.covers])).toEqual([
      ['starter', 29, 3],
      ['creator', 79, 12],
      ['pro', 199, 40],
    ])
  })

  it('looks a tier up by id', () => {
    expect(tierById('creator')?.covers).toBe(12)
    expect(tierById('nope')).toBeUndefined()
  })

  it('reads the price id from the tier env var, undefined when unset', () => {
    delete process.env.STRIPE_PRICE_STARTER
    expect(priceIdFor(TIERS[0])).toBeUndefined()
    process.env.STRIPE_PRICE_STARTER = 'price_123'
    expect(priceIdFor(TIERS[0])).toBe('price_123')
    delete process.env.STRIPE_PRICE_STARTER
  })

  it('uses no em dashes in any copy', () => {
    const copy = TIERS.map((t) => `${t.name} ${t.priceDisplay} ${t.blurb}`).join(' ')
    expect(copy).not.toContain('\u2014')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pricing.test.ts`
Expected: FAIL, cannot find module `@/lib/pricing`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/pricing.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/pricing.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/pricing.ts tests/pricing.test.ts
git commit -m "feat(payments): tier pricing config, single source (DARK)"
```

---

### Task 2: Stripe client factory (fails loud, config-gated)

**Files:**
- Modify: `package.json` (add `stripe`)
- Create: `lib/stripe.ts`
- Test: `tests/stripe-config.test.ts`

**Interfaces:**
- Produces: `function stripeConfigured(): boolean` (true iff `STRIPE_SECRET_KEY` set); `function getStripe(): Stripe` (throws when unset, like `supabaseAdmin`).
- Consumes: `stripe` npm package.

- [ ] **Step 1: Add the dependency**

Run: `npm install stripe@^17`
Expected: `stripe` appears in `package.json` dependencies. Commit the lockfile change with this task.

- [ ] **Step 2: Write the failing test**

```ts
// tests/stripe-config.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { stripeConfigured, getStripe } from '@/lib/stripe'

beforeEach(() => {
  delete process.env.STRIPE_SECRET_KEY
})

describe('stripe client', () => {
  it('reports not configured with no key', () => {
    expect(stripeConfigured()).toBe(false)
  })

  it('throws loudly when asked for a client with no key', () => {
    expect(() => getStripe()).toThrow(/STRIPE_SECRET_KEY/)
  })

  it('is configured and constructs a client with a key', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_x'
    expect(stripeConfigured()).toBe(true)
    expect(getStripe()).toBeTruthy()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/stripe-config.test.ts`
Expected: FAIL, cannot find module `@/lib/stripe`.

- [ ] **Step 4: Write minimal implementation**

```ts
// lib/stripe.ts
import Stripe from 'stripe'

/**
 * Server-only Stripe client. NEVER import into a client component: the secret key
 * must not reach the browser. Fails loud when misconfigured rather than silently
 * dropping a payment, matching lib/supabase-admin.ts. Checkout is created
 * server-side, so there is no publishable key and no NEXT_PUBLIC_STRIPE_* var.
 */
export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

let client: Stripe | null = null

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY must be set')
  if (!client) client = new Stripe(key)
  return client
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/stripe-config.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json lib/stripe.ts tests/stripe-config.test.ts
git commit -m "feat(payments): server-only Stripe client, fails loud (DARK)"
```

---

### Task 3: Subscriptions table + quota column (schema)

**Files:**
- Modify: `supabase/schema.sql`
- Test: `tests/schema-subscriptions.test.ts` (a text assertion on the SQL, matching how the repo pins schema shape where it does)

**Interfaces:**
- Produces (DB shape later code relies on): table `public.subscriptions` with columns `id, created_at, updated_at, user_id, stripe_customer_id, stripe_subscription_id, tier, status, current_period_start, current_period_end`; RLS own-read; a plain table-level SELECT grant to `authenticated`; NO insert/update grant (webhook writes via service role). New `song_jobs.quota_consumed_at timestamptz` NOT in the customer SELECT grant.

- [ ] **Step 1: Write the failing test**

```ts
// tests/schema-subscriptions.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const sql = readFileSync('supabase/schema.sql', 'utf8')

describe('subscriptions schema', () => {
  it('creates the subscriptions table', () => {
    expect(sql).toMatch(/create table if not exists public\.subscriptions/)
  })

  it('enables RLS and an own-read policy on subscriptions', () => {
    expect(sql).toMatch(/alter table public\.subscriptions enable row level security/)
    expect(sql).toMatch(/subscriptions_own_select on public\.subscriptions/)
  })

  it('adds quota_consumed_at to song_jobs but NOT to the customer grant', () => {
    expect(sql).toMatch(/add column if not exists quota_consumed_at/)
    // quota_consumed_at is staff/service only, like pipeline_* and internal_notes:
    // it must never appear inside a `grant select (...) ... to anon, authenticated`.
    const grantBlocks = sql.match(/grant select \(([^)]*)\) on public\.song_jobs to anon, authenticated/g) ?? []
    for (const block of grantBlocks) expect(block).not.toContain('quota_consumed_at')
  })

  it('uses no em dashes', () => {
    expect(sql).not.toContain('\u2014')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/schema-subscriptions.test.ts`
Expected: FAIL (no subscriptions table yet).

- [ ] **Step 3: Append the schema (after the deliveries block, end of file)**

```sql
-- == Subscriptions (Door 2 billing) =============================================
-- Added 2026-09-08 (chunk E). Stripe is the source of truth for billing; this
-- table is a synced projection kept current by the signature-verified webhook
-- (app/api/stripe-webhook). The customer reads their own row (RLS) to see their
-- tier and period; they never write it. The webhook writes via the service role,
-- which bypasses RLS, exactly like the pipeline delivery writes.
create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  user_id                uuid not null references auth.users (id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text unique,
  -- 'starter' | 'creator' | 'pro'
  tier                   text,
  -- Stripe's status: 'active' | 'trialing' | 'past_due' | 'canceled' | ...
  status                 text not null default 'incomplete',
  current_period_start   timestamptz,
  current_period_end     timestamptz
);

-- One live subscription row per user. A user resubscribing reuses their row via
-- the webhook's upsert on user_id, so this stays one-per-user in practice.
create unique index if not exists subscriptions_user_idx on public.subscriptions (user_id);

alter table public.subscriptions enable row level security;

-- Customers read their own subscription; there is deliberately NO customer insert
-- or update policy. The webhook writes with the service role.
drop policy if exists subscriptions_own_select on public.subscriptions;
create policy subscriptions_own_select on public.subscriptions
  for select using (auth.uid() = user_id);

-- A plain table-level SELECT grant is fine here: there is no staff-only column on
-- this table, unlike song_jobs. All columns are safe for the owner to read.
grant select on public.subscriptions to authenticated;

-- == Quota accounting on song_jobs ==============================================
-- Added 2026-09-08 (chunk E). Stamped when an entitled Door 2 submission consumes
-- one of the month's covers, so usage this billing period can be counted. Nullable
-- so pre-existing and manual (Door 1) jobs never count against a Door 2 quota.
--
-- Staff/service only, exactly like pipeline_* and internal_notes: deliberately NOT
-- added to the customer song_jobs SELECT grant, so it needs no grant rewrite. The
-- studio billing panel counts it server-side through the service role.
alter table public.song_jobs add column if not exists quota_consumed_at timestamptz;
create index if not exists song_jobs_quota_consumed_idx
  on public.song_jobs (user_id, quota_consumed_at) where quota_consumed_at is not null;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/schema-subscriptions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/schema.sql tests/schema-subscriptions.test.ts
git commit -m "feat(payments): subscriptions table + quota column, staff-only (DARK)"
```

---

### Task 4: Quota math + server status helper

**Files:**
- Create: `lib/quota.ts`
- Test: `tests/quota.test.ts`

**Interfaces:**
- Consumes: `TierId`, `tierById` from `lib/pricing.ts`; `supabaseAdmin` from `lib/supabase-admin.ts`.
- Produces:
  - Pure: `interface SubRow { tier: string | null; status: string; current_period_start: string | null; current_period_end: string | null; stripe_customer_id: string | null }`; `function allowanceFor(tier: string | null): number`; `const ACTIVE_STATUSES: readonly string[]` (`['active','trialing']`); `function isActive(status: string): boolean`; `interface QuotaStatus { entitled: boolean; active: boolean; tier: string | null; allowance: number; used: number; remaining: number; periodEnd: string | null; hasCustomer: boolean }`; `function computeQuota(sub: SubRow | null, used: number): QuotaStatus`.
  - Server: `async function quotaStatus(userId: string): Promise<QuotaStatus>` (reads the sub + counts consuming jobs in `[current_period_start, current_period_end)` via service role).

- [ ] **Step 1: Write the failing test (pure math only; the server helper is covered in Task 8's gate test via a fake)**

```ts
// tests/quota.test.ts
import { describe, it, expect } from 'vitest'
import { allowanceFor, isActive, computeQuota } from '@/lib/quota'

const base = {
  tier: 'starter',
  status: 'active',
  current_period_start: '2026-09-01T00:00:00Z',
  current_period_end: '2026-10-01T00:00:00Z',
  stripe_customer_id: 'cus_1',
}

describe('quota math', () => {
  it('maps tiers to allowances', () => {
    expect(allowanceFor('starter')).toBe(3)
    expect(allowanceFor('creator')).toBe(12)
    expect(allowanceFor('pro')).toBe(40)
    expect(allowanceFor(null)).toBe(0)
    expect(allowanceFor('bogus')).toBe(0)
  })

  it('treats active and trialing as active, nothing else', () => {
    expect(isActive('active')).toBe(true)
    expect(isActive('trialing')).toBe(true)
    expect(isActive('past_due')).toBe(false)
    expect(isActive('canceled')).toBe(false)
  })

  it('entitled when active and under allowance', () => {
    const q = computeQuota(base, 1)
    expect(q).toMatchObject({ entitled: true, allowance: 3, used: 1, remaining: 2, active: true })
  })

  it('blocks when quota is spent, even while active', () => {
    const q = computeQuota(base, 3)
    expect(q.remaining).toBe(0)
    expect(q.entitled).toBe(false)
  })

  it('blocks when there is no active subscription', () => {
    expect(computeQuota(null, 0).entitled).toBe(false)
    expect(computeQuota({ ...base, status: 'canceled' }, 0).entitled).toBe(false)
  })

  it('never reports negative remaining', () => {
    expect(computeQuota(base, 9).remaining).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/quota.test.ts`
Expected: FAIL, cannot find module `@/lib/quota`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/quota.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/quota.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/quota.ts tests/quota.test.ts
git commit -m "feat(payments): quota math + server status helper (DARK)"
```

---

### Task 5: Subscription sync (Stripe object to row)

**Files:**
- Create: `lib/subscription-sync.ts`
- Test: `tests/subscription-sync.test.ts`

**Interfaces:**
- Consumes: `TierId` from `lib/pricing.ts`; `supabaseAdmin`.
- Produces:
  - Pure: `interface SyncInput { userId: string; customerId: string; subscriptionId: string; status: string; tier: string | null; periodStart: number | null; periodEnd: number | null }`; `function toRow(input: SyncInput): Record<string, unknown>` (unix seconds to ISO, `updated_at` = now); `function tierFromPriceId(priceId: string | undefined): string | null` (reverse of `priceIdFor`, using the env price ids).
  - Server: `async function upsertSubscription(input: SyncInput): Promise<void>` (upsert on `user_id`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/subscription-sync.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { toRow, tierFromPriceId } from '@/lib/subscription-sync'

beforeEach(() => {
  delete process.env.STRIPE_PRICE_STARTER
  delete process.env.STRIPE_PRICE_CREATOR
  delete process.env.STRIPE_PRICE_PRO
})

describe('subscription sync mapping', () => {
  it('maps a price id back to its tier via env', () => {
    process.env.STRIPE_PRICE_CREATOR = 'price_creator'
    expect(tierFromPriceId('price_creator')).toBe('creator')
    expect(tierFromPriceId('price_unknown')).toBeNull()
    expect(tierFromPriceId(undefined)).toBeNull()
  })

  it('converts unix period seconds to ISO and carries the ids', () => {
    const row = toRow({
      userId: 'u1',
      customerId: 'cus_1',
      subscriptionId: 'sub_1',
      status: 'active',
      tier: 'starter',
      periodStart: 1756684800, // 2025-09-01T00:00:00Z-ish
      periodEnd: 1759276800,
    })
    expect(row).toMatchObject({
      user_id: 'u1',
      stripe_customer_id: 'cus_1',
      stripe_subscription_id: 'sub_1',
      status: 'active',
      tier: 'starter',
    })
    expect(typeof row.current_period_start).toBe('string')
    expect(String(row.current_period_start)).toMatch(/T.*Z$/)
    expect(row.updated_at).toBeTruthy()
  })

  it('leaves periods null when Stripe omits them', () => {
    const row = toRow({
      userId: 'u1', customerId: 'c', subscriptionId: 's',
      status: 'incomplete', tier: null, periodStart: null, periodEnd: null,
    })
    expect(row.current_period_start).toBeNull()
    expect(row.current_period_end).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/subscription-sync.test.ts`
Expected: FAIL, cannot find module `@/lib/subscription-sync`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/subscription-sync.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/subscription-sync.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/subscription-sync.ts tests/subscription-sync.test.ts
git commit -m "feat(payments): map a Stripe subscription to a row (DARK)"
```

---

### Task 6: Stripe webhook route

**Files:**
- Create: `app/api/stripe-webhook/route.ts`
- Test: `tests/stripe-webhook-route.test.ts`

**Interfaces:**
- Consumes: `getStripe` (for `webhooks.constructEvent`), `upsertSubscription`, `tierFromPriceId`.
- Produces: `POST(request: Request)`. Returns 400 on a bad/missing signature (reveals nothing further), 200 `{received:true}` otherwise. Handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.

Notes for the implementer:
- Read the raw body with `await request.text()` (signature verification needs the exact bytes). `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`.
- `user_id` travels on `subscription_data.metadata.user_id` set at Checkout (Task 7), so every `customer.subscription.*` event carries it. For `checkout.session.completed`, read `session.metadata.user_id` and the subscription id, then retrieve the subscription to get status/price/period.
- The test mocks `@/lib/stripe` and `@/lib/subscription-sync`, so no real Stripe or DB is touched.

- [ ] **Step 1: Write the failing test**

```ts
// tests/stripe-webhook-route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const constructEvent = vi.fn()
const retrieveSub = vi.fn()
vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({
    webhooks: { constructEvent: (...a: unknown[]) => constructEvent(...a) },
    subscriptions: { retrieve: (...a: unknown[]) => retrieveSub(...a) },
  }),
  stripeConfigured: () => true,
}))

const upsertSubscription = vi.fn()
vi.mock('@/lib/subscription-sync', async (orig) => ({
  ...(await orig<typeof import('@/lib/subscription-sync')>()),
  upsertSubscription: (...a: unknown[]) => upsertSubscription(...a),
}))

const { POST } = await import('@/app/api/stripe-webhook/route')

function req(body: string, sig: string | null = 'good') {
  return new Request('http://x/api/stripe-webhook', {
    method: 'POST',
    headers: sig ? { 'stripe-signature': sig } : {},
    body,
  })
}

beforeEach(() => {
  constructEvent.mockReset()
  retrieveSub.mockReset()
  upsertSubscription.mockReset()
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_x'
  process.env.STRIPE_PRICE_STARTER = 'price_starter'
})

describe('POST /api/stripe-webhook', () => {
  it('400s a bad signature and writes nothing', async () => {
    constructEvent.mockImplementation(() => {
      throw new Error('bad sig')
    })
    const res = await POST(req('{}', 'bad'))
    expect(res.status).toBe(400)
    expect(upsertSubscription).not.toHaveBeenCalled()
  })

  it('upserts on customer.subscription.updated using metadata user_id', async () => {
    constructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_1',
          customer: 'cus_1',
          status: 'active',
          metadata: { user_id: 'u1' },
          current_period_start: 1756684800,
          current_period_end: 1759276800,
          items: { data: [{ price: { id: 'price_starter' } }] },
        },
      },
    })
    const res = await POST(req('{}'))
    expect(res.status).toBe(200)
    expect(upsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', tier: 'starter', status: 'active', subscriptionId: 'sub_1' }),
    )
  })

  it('marks canceled on customer.subscription.deleted', async () => {
    constructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_1', customer: 'cus_1', status: 'canceled',
          metadata: { user_id: 'u1' },
          current_period_start: 1756684800, current_period_end: 1759276800,
          items: { data: [{ price: { id: 'price_starter' } }] },
        },
      },
    })
    const res = await POST(req('{}'))
    expect(res.status).toBe(200)
    expect(upsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'canceled', userId: 'u1' }),
    )
  })

  it('ignores an event type it does not handle', async () => {
    constructEvent.mockReturnValue({ type: 'invoice.paid', data: { object: {} } })
    const res = await POST(req('{}'))
    expect(res.status).toBe(200)
    expect(upsertSubscription).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/stripe-webhook-route.test.ts`
Expected: FAIL, cannot find route module.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/api/stripe-webhook/route.ts
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { tierFromPriceId, upsertSubscription, type SyncInput } from '@/lib/subscription-sync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Keep the local subscriptions table in step with Stripe.
 *
 * Signature-verified against STRIPE_WEBHOOK_SECRET: a wrong or missing signature
 * gets a 400 and nothing is written, so this endpoint cannot be driven by anyone
 * who does not hold the secret. The raw body is read with request.text(), because
 * verification is over the exact bytes Stripe signed.
 *
 * user_id rides on the subscription metadata (set at Checkout), so every
 * customer.subscription.* event knows whose row to write without a customer
 * lookup. checkout.session.completed carries it on the session and is used to
 * catch the very first activation.
 */
function subInputFromSubscription(s: Stripe.Subscription): SyncInput | null {
  const userId = (s.metadata?.user_id as string | undefined) ?? undefined
  if (!userId) return null
  const priceId = s.items?.data?.[0]?.price?.id
  return {
    userId,
    customerId: typeof s.customer === 'string' ? s.customer : s.customer.id,
    subscriptionId: s.id,
    status: s.status,
    tier: tierFromPriceId(priceId),
    periodStart: s.current_period_start ?? null,
    periodEnd: s.current_period_end ?? null,
  }
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const sig = request.headers.get('stripe-signature')
  if (!secret || !sig) return new Response('bad request', { status: 400 })

  const raw = await request.text()
  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, secret)
  } catch {
    // Do not echo the reason: a caller probing the endpoint learns nothing.
    return new Response('bad signature', { status: 400 })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.user_id
      const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
      if (userId && subId) {
        const sub = await getStripe().subscriptions.retrieve(subId)
        // The session may not have stamped subscription metadata; ensure user_id.
        if (!sub.metadata?.user_id) sub.metadata = { ...sub.metadata, user_id: userId }
        const input = subInputFromSubscription(sub)
        if (input) await upsertSubscription(input)
      }
    } else if (
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted' ||
      event.type === 'customer.subscription.created'
    ) {
      const input = subInputFromSubscription(event.data.object as Stripe.Subscription)
      if (input) await upsertSubscription(input)
    }
  } catch (e) {
    // A write failure is a real fault: 500 so Stripe retries the event.
    console.error('[stripe-webhook] handler failed', e)
    return new Response('handler error', { status: 500 })
  }

  return Response.json({ received: true })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/stripe-webhook-route.test.ts`
Expected: PASS. If the Stripe types complain about `current_period_start` on `Subscription`, keep the `?? null` access; it is present at runtime and the test drives the runtime path.

- [ ] **Step 5: Commit**

```bash
git add app/api/stripe-webhook/route.ts tests/stripe-webhook-route.test.ts
git commit -m "feat(payments): signature-verified Stripe webhook, syncs subs (DARK)"
```

---

### Task 7: Checkout + Billing Portal server actions

**Files:**
- Create: `app/pricing/subscribe-actions.ts`
- Test: `tests/subscribe-actions.test.ts`

**Interfaces:**
- Consumes: `currentUser` from `lib/supabase-server`, `supabaseAdmin`, `getStripe`, `stripeConfigured`, `tierById`, `priceIdFor`, site origin from `lib/site.ts` (or `NEXT_PUBLIC_SITE_URL`).
- Produces: `type ActionResult = { ok: false; error: string } | { ok: true; url: string }`; `async function startCheckout(tierId: string): Promise<ActionResult>`; `async function openBillingPortal(): Promise<ActionResult>`. (Return the URL rather than calling `redirect()` inside, so the action is unit-testable; the client component performs the redirect.)

Notes:
- `startCheckout`: require a signed-in user (else `{ok:false, error:'Sign in to subscribe.'}`); require `stripeConfigured()` (else a clear "not connected yet" error, mirroring the enquiry 503 copy); resolve the price id from the tier's env var (else error); create a Checkout Session `mode:'subscription'`, `line_items:[{price, quantity:1}]`, `customer_email: user.email`, `metadata:{user_id}`, `subscription_data:{ metadata:{ user_id } }`, `success_url: <origin>/studio?subscribed=1`, `cancel_url: <origin>/pricing`; return `session.url`.
- `openBillingPortal`: require a signed-in user; read their `subscriptions.stripe_customer_id` (service role); if none, `{ok:false, error:'No subscription to manage yet.'}`; create a portal session `return_url: <origin>/studio`; return `url`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/subscribe-actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const currentUser = vi.fn()
vi.mock('@/lib/supabase-server', () => ({
  currentUser: () => currentUser(),
}))

const maybeSingle = vi.fn()
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => maybeSingle() }) }),
    }),
  }),
}))

const createCheckout = vi.fn()
const createPortal = vi.fn()
vi.mock('@/lib/stripe', () => ({
  stripeConfigured: () => Boolean(process.env.STRIPE_SECRET_KEY),
  getStripe: () => ({
    checkout: { sessions: { create: (...a: unknown[]) => createCheckout(...a) } },
    billingPortal: { sessions: { create: (...a: unknown[]) => createPortal(...a) } },
  }),
}))

const { startCheckout, openBillingPortal } = await import('@/app/pricing/subscribe-actions')

beforeEach(() => {
  currentUser.mockReset()
  maybeSingle.mockReset()
  createCheckout.mockReset()
  createPortal.mockReset()
  process.env.STRIPE_SECRET_KEY = 'sk_test_x'
  process.env.STRIPE_PRICE_STARTER = 'price_starter'
  process.env.NEXT_PUBLIC_SITE_URL = 'https://lyricalglobal.com'
})

describe('startCheckout', () => {
  it('refuses when signed out', async () => {
    currentUser.mockResolvedValue(null)
    expect(await startCheckout('starter')).toMatchObject({ ok: false })
  })

  it('refuses an unknown tier', async () => {
    currentUser.mockResolvedValue({ id: 'u1', email: 'a@b.co' })
    expect(await startCheckout('nope')).toMatchObject({ ok: false })
  })

  it('refuses when Stripe is not configured', async () => {
    delete process.env.STRIPE_SECRET_KEY
    currentUser.mockResolvedValue({ id: 'u1', email: 'a@b.co' })
    expect(await startCheckout('starter')).toMatchObject({ ok: false })
  })

  it('creates a subscription checkout carrying user_id and returns its url', async () => {
    currentUser.mockResolvedValue({ id: 'u1', email: 'a@b.co' })
    createCheckout.mockResolvedValue({ url: 'https://checkout.stripe/x' })
    const res = await startCheckout('starter')
    expect(res).toEqual({ ok: true, url: 'https://checkout.stripe/x' })
    const arg = createCheckout.mock.calls[0][0] as Record<string, any>
    expect(arg.mode).toBe('subscription')
    expect(arg.line_items[0].price).toBe('price_starter')
    expect(arg.metadata.user_id).toBe('u1')
    expect(arg.subscription_data.metadata.user_id).toBe('u1')
  })
})

describe('openBillingPortal', () => {
  it('refuses when there is no customer', async () => {
    currentUser.mockResolvedValue({ id: 'u1', email: 'a@b.co' })
    maybeSingle.mockResolvedValue({ data: null })
    expect(await openBillingPortal()).toMatchObject({ ok: false })
  })

  it('returns a portal url for a customer', async () => {
    currentUser.mockResolvedValue({ id: 'u1', email: 'a@b.co' })
    maybeSingle.mockResolvedValue({ data: { stripe_customer_id: 'cus_1' } })
    createPortal.mockResolvedValue({ url: 'https://portal.stripe/x' })
    expect(await openBillingPortal()).toEqual({ ok: true, url: 'https://portal.stripe/x' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/subscribe-actions.test.ts`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/pricing/subscribe-actions.ts
'use server'

import { currentUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getStripe, stripeConfigured } from '@/lib/stripe'
import { priceIdFor, tierById } from '@/lib/pricing'

export type ActionResult = { ok: false; error: string } | { ok: true; url: string }

function origin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://lyricalglobal.com'
}

const NOT_CONNECTED = 'Payments are not connected yet. Please try again shortly.'

export async function startCheckout(tierId: string): Promise<ActionResult> {
  const user = await currentUser()
  if (!user) return { ok: false, error: 'Sign in to subscribe.' }

  const tier = tierById(tierId)
  if (!tier) return { ok: false, error: 'That plan does not exist.' }

  if (!stripeConfigured()) return { ok: false, error: NOT_CONNECTED }
  const price = priceIdFor(tier)
  if (!price) return { ok: false, error: NOT_CONNECTED }

  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price, quantity: 1 }],
    customer_email: user.email ?? undefined,
    // user_id on BOTH the session and the subscription, so checkout.session.completed
    // and every later customer.subscription.* event can find the row to write.
    metadata: { user_id: user.id },
    subscription_data: { metadata: { user_id: user.id } },
    success_url: `${origin()}/studio?subscribed=1`,
    cancel_url: `${origin()}/pricing`,
    allow_promotion_codes: true,
  })

  if (!session.url) return { ok: false, error: NOT_CONNECTED }
  return { ok: true, url: session.url }
}

export async function openBillingPortal(): Promise<ActionResult> {
  const user = await currentUser()
  if (!user) return { ok: false, error: 'Sign in to manage your plan.' }
  if (!stripeConfigured()) return { ok: false, error: NOT_CONNECTED }

  const { data } = await supabaseAdmin()
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const customer = data?.stripe_customer_id
  if (!customer) return { ok: false, error: 'No subscription to manage yet.' }

  const session = await getStripe().billingPortal.sessions.create({
    customer,
    return_url: `${origin()}/studio`,
  })
  return { ok: true, url: session.url }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/subscribe-actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/pricing/subscribe-actions.ts tests/subscribe-actions.test.ts
git commit -m "feat(payments): checkout + billing portal server actions (DARK)"
```

---

### Task 8: The submit gate (website side)

**Files:**
- Modify: `app/studio/submit-actions.ts`
- Test: `tests/submit-gate.test.ts` (unit-test the gate helper, not the whole action)

**Interfaces:**
- Consumes: `quotaStatus` from `lib/quota.ts`.
- Produces (extracted so it is testable without Turnstile/Supabase): `async function assertEntitled(userId: string): Promise<{ ok: true } | { ok: false; error: string }>` exported from `submit-actions.ts` (or a small `lib/submit-gate.ts` it imports; prefer `lib/submit-gate.ts` to keep the action file focused). The action calls it after auth and before the job insert. On success, after the job + assets insert, the action stamps `quota_consumed_at = now()` on the new job via the service role (a customer cannot write that column). Blocking copy: `'You have used all your covers for this period, or your subscription is not active. Visit pricing to continue.'`

Notes:
- Put `assertEntitled` in `lib/submit-gate.ts` and import it into `submit-actions.ts`.
- The stamp uses `supabaseAdmin()` (service role) because `quota_consumed_at` is staff/service only. Do it right after the successful asset insert, before `notify`. This is the E half; F will additionally set `pipeline_state='queued'` on the same path.

- [ ] **Step 1: Write the failing test**

```ts
// tests/submit-gate.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const quotaStatus = vi.fn()
vi.mock('@/lib/quota', () => ({ quotaStatus: (id: string) => quotaStatus(id) }))

const { assertEntitled } = await import('@/lib/submit-gate')

beforeEach(() => quotaStatus.mockReset())

describe('assertEntitled', () => {
  it('allows an entitled user', async () => {
    quotaStatus.mockResolvedValue({ entitled: true })
    expect(await assertEntitled('u1')).toEqual({ ok: true })
  })

  it('blocks when not entitled, with an upgrade message', async () => {
    quotaStatus.mockResolvedValue({ entitled: false })
    const res = await assertEntitled('u1')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/pricing/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/submit-gate.test.ts`
Expected: FAIL, cannot find module `@/lib/submit-gate`.

- [ ] **Step 3: Write the gate helper**

```ts
// lib/submit-gate.ts
import { quotaStatus } from '@/lib/quota'

/**
 * The website half of the two-sided gate: may this user start a cover right now?
 * The pipeline service layer re-checks the same thing before it spends, so this
 * is the fast, friendly refusal, not the only one.
 */
export async function assertEntitled(
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const q = await quotaStatus(userId)
  if (q.entitled) return { ok: true }
  return {
    ok: false,
    error:
      'You have used all your covers for this period, or your subscription is not active. Visit pricing to continue.',
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/submit-gate.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire it into the action**

In `app/studio/submit-actions.ts`:
- Add imports: `import { assertEntitled } from '@/lib/submit-gate'` and `import { supabaseAdmin } from '@/lib/supabase-admin'`.
- After the `if (!user) ...` guard and before the Turnstile challenge, add:

```ts
  const gate = await assertEntitled(user.id)
  if (!gate.ok) return { ok: false, error: gate.error }
```

- After the successful `song_job_assets` insert (right before `await notify(...)`), add the consumption stamp:

```ts
  // Consume one cover for this billing period. quota_consumed_at is staff/service
  // only, so this is written with the service role, scoped to this exact job. This
  // is chunk E's half; chunk F additionally sets pipeline_state='queued' here so
  // the poller runs it with no human accept.
  await supabaseAdmin()
    .from('song_jobs')
    .update({ quota_consumed_at: new Date().toISOString() })
    .eq('id', jobId)
```

- [ ] **Step 6: Run the full suite to confirm nothing regressed**

Run: `npx vitest run` then `npx tsc --noEmit`
Expected: PASS. If an existing submit-action test now hits the gate, update it to mock `@/lib/submit-gate` returning `{ok:true}` (note it in the commit).

- [ ] **Step 7: Commit**

```bash
git add lib/submit-gate.ts tests/submit-gate.test.ts app/studio/submit-actions.ts
git commit -m "feat(payments): gate submit on active sub + quota, stamp consumption (DARK)"
```

---

### Task 9: Billing panel in the studio

**Files:**
- Create: `components/BillingPanel.tsx`
- Modify: `app/studio/page.tsx`
- Test: `tests/billing-panel.test.tsx`

**Interfaces:**
- Consumes: `QuotaStatus` from `lib/quota`; `openBillingPortal` from `app/pricing/subscribe-actions`.
- Produces: `function BillingPanel({ quota }: { quota: QuotaStatus }): JSX.Element`. Shows, for an entitled/active user, "N of M covers left" and a "Manage plan" button (calls `openBillingPortal`, then `window.location = url`). For a user with no active sub, a "Choose a plan" link to `/pricing`. No em dashes, brand classes.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/billing-panel.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BillingPanel } from '@/components/BillingPanel'

vi.mock('@/app/pricing/subscribe-actions', () => ({
  openBillingPortal: vi.fn(),
}))

describe('BillingPanel', () => {
  it('shows remaining covers for an active plan', () => {
    render(
      <BillingPanel
        quota={{ entitled: true, active: true, tier: 'starter', allowance: 3, used: 1, remaining: 2, periodEnd: null, hasCustomer: true }}
      />,
    )
    expect(screen.getByText(/2 of 3/i)).toBeTruthy()
  })

  it('prompts to choose a plan when inactive', () => {
    render(
      <BillingPanel
        quota={{ entitled: false, active: false, tier: null, allowance: 0, used: 0, remaining: 0, periodEnd: null, hasCustomer: false }}
      />,
    )
    const link = screen.getByRole('link', { name: /plan/i }) as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('/pricing')
  })

  it('has no em dash in its copy', () => {
    const { container } = render(
      <BillingPanel
        quota={{ entitled: true, active: true, tier: 'pro', allowance: 40, used: 0, remaining: 40, periodEnd: null, hasCustomer: true }}
      />,
    )
    expect(container.textContent).not.toContain('\u2014')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/billing-panel.test.tsx`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Write the component**

```tsx
// components/BillingPanel.tsx
'use client'

import { useState } from 'react'
import type { QuotaStatus } from '@/lib/quota'
import { openBillingPortal } from '@/app/pricing/subscribe-actions'

/**
 * The billing summary at the top of the studio. Active plans see how many covers
 * remain this period and can open the Stripe Customer Portal to manage or cancel.
 * A signed-in visitor with no active plan is pointed at pricing. The count comes
 * from the server (service role); this component only renders it.
 */
export function BillingPanel({ quota }: { quota: QuotaStatus }) {
  const [busy, setBusy] = useState(false)

  if (!quota.active) {
    return (
      <div className="rounded-card border border-graphite/15 p-5">
        <p className="text-sm text-graphite/70">
          You do not have an active plan. Choose one to start making covers.
        </p>
        <a
          href="/pricing"
          className="nudge mt-3 inline-flex min-h-11 items-center rounded-card bg-ember px-6 text-cream"
        >
          Choose a plan
        </a>
      </div>
    )
  }

  async function manage() {
    setBusy(true)
    const res = await openBillingPortal()
    if (res.ok) window.location.href = res.url
    else setBusy(false)
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-graphite/15 p-5">
      <p className="text-sm text-graphite/75">
        <span className="font-brand text-lg">
          {quota.remaining} of {quota.allowance}
        </span>{' '}
        covers left this period.
      </p>
      <button
        type="button"
        onClick={manage}
        disabled={busy}
        className="nudge inline-flex min-h-11 items-center rounded-card border border-graphite/25 px-5 text-sm transition-colors hover:border-indigo hover:text-indigo disabled:opacity-50"
      >
        Manage plan
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/billing-panel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire into the studio page**

In `app/studio/page.tsx`:
- Import: `import { BillingPanel } from '@/components/BillingPanel'` and `import { quotaStatus } from '@/lib/quota'`.
- After `if (!user) redirect(...)`, add `const quota = await quotaStatus(user.id)`.
- Render `<BillingPanel quota={quota} />` just under the "Signed in as" paragraph (before the submitted banner), so billing is the first thing a returning customer sees.

- [ ] **Step 6: Confirm suite + types**

Run: `npx vitest run` then `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/BillingPanel.tsx app/studio/page.tsx tests/billing-panel.test.tsx
git commit -m "feat(payments): studio billing panel with remaining covers (DARK)"
```

---

### Task 10: Pricing page + tier cards

**Files:**
- Create: `components/PricingTiers.tsx`
- Create: `app/pricing/page.tsx`
- Test: `tests/pricing-page.test.tsx`

**Interfaces:**
- Consumes: `TIERS` from `lib/pricing`; `startCheckout` from `app/pricing/subscribe-actions`.
- Produces: `function PricingTiers(): JSX.Element` (client; a subscribe button per tier that calls `startCheckout(tier.id)` then redirects to the returned URL, showing the error inline on failure). `app/pricing/page.tsx` is a server component with brand copy + `<PricingTiers/>` and metadata.

Notes:
- Copy rules: lowercase `lyrical`, US spelling, no banned words, no em dashes. The button on failure shows the action's error text (which already says "sign in" when signed out, so no separate auth check is needed here, but linking sign-in is friendlier: on the "Sign in to subscribe." error, also render a link to `/studio/sign-in?next=/pricing`).
- Keep it brand-consistent with existing pages (see `app/studio/new` and marketing sections for class patterns). No gradients.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/pricing-page.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PricingTiers } from '@/components/PricingTiers'

vi.mock('@/app/pricing/subscribe-actions', () => ({
  startCheckout: vi.fn(),
}))

describe('PricingTiers', () => {
  it('renders the three tiers with prices and cover counts', () => {
    render(<PricingTiers />)
    expect(screen.getByText('Starter')).toBeTruthy()
    expect(screen.getByText('Creator')).toBeTruthy()
    expect(screen.getByText('Pro')).toBeTruthy()
    expect(screen.getByText('$199')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /subscribe/i })).toHaveLength(3)
  })

  it('uses no em dash and never says AI-generated', () => {
    const { container } = render(<PricingTiers />)
    expect(container.textContent).not.toContain('\u2014')
    expect(container.textContent).not.toMatch(/AI-generated/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pricing-page.test.tsx`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Write the components**

```tsx
// components/PricingTiers.tsx
'use client'

import { useState } from 'react'
import { TIERS, type TierId } from '@/lib/pricing'
import { startCheckout } from '@/app/pricing/subscribe-actions'

/**
 * The three plan cards. Each subscribe button asks the server to open a Stripe
 * Checkout session and then sends the browser there. Errors (signed out, or
 * payments not connected yet) render inline under the card that was clicked.
 */
export function PricingTiers() {
  const [busy, setBusy] = useState<TierId | null>(null)
  const [error, setError] = useState<{ id: TierId; message: string } | null>(null)

  async function subscribe(id: TierId) {
    setBusy(id)
    setError(null)
    const res = await startCheckout(id)
    if (res.ok) {
      window.location.href = res.url
      return
    }
    setError({ id, message: res.error })
    setBusy(null)
  }

  return (
    <div className="grid gap-6 sm:grid-cols-3">
      {TIERS.map((t) => (
        <div key={t.id} className="flex flex-col rounded-card border border-graphite/15 p-6">
          <span className="font-brand text-2xl tracking-tight">{t.name}</span>
          <span className="mt-2 font-brand text-4xl">{t.priceDisplay}</span>
          <span className="text-sm text-graphite/55">per month</span>
          <p className="mt-4 text-sm text-graphite/70">{t.blurb}</p>
          <p className="mt-4 text-sm text-graphite/75">
            {t.covers} covers a month
          </p>
          <button
            type="button"
            onClick={() => subscribe(t.id)}
            disabled={busy === t.id}
            className="nudge mt-6 inline-flex min-h-11 items-center justify-center rounded-card bg-ember px-6 text-cream disabled:opacity-50"
          >
            Subscribe
          </button>
          {error?.id === t.id && (
            <p role="alert" className="mt-3 text-sm text-ember">
              {error.message}{' '}
              {error.message.includes('Sign in') && (
                <a className="underline" href="/studio/sign-in?next=/pricing">
                  Sign in
                </a>
              )}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
```

```tsx
// app/pricing/page.tsx
import { PricingTiers } from '@/components/PricingTiers'

export const metadata = {
  title: 'Pricing',
  description: 'Subscribe to make your songs multilingual with lyrical.',
}

/**
 * The Door 2 pricing page. Public and indexable: it is a funnel entry. The tier
 * numbers come from lib/pricing.ts (the same source Stripe products are keyed to),
 * so this page and the checkout can never disagree about a price.
 */
export default function Pricing() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-24 sm:py-28">
      <span className="font-mono text-xs tracking-[0.18em] text-graphite/45">Pricing</span>
      <h1 className="mt-5 font-brand text-4xl leading-[1.1] tracking-tight text-balance">
        Pick a plan, send your songs.
      </h1>
      <p className="mt-4 max-w-2xl text-graphite/75">
        Every plan covers a set number of songs a month, re-sung in the language you
        choose and delivered to your studio. Change or cancel any time.
      </p>
      <div className="mt-12">
        <PricingTiers />
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/pricing-page.test.tsx`
Expected: PASS.

- [ ] **Step 5: Add a nav/footer link to /pricing**

Add a "Pricing" link where the site's primary nav lives (find it: `grep -rl "Contact\|/contact" components app | head`). Keep it minimal, brand-consistent. Run `npx vitest run tests/copy.test.ts` after, since it scans rendered tsx.

- [ ] **Step 6: Confirm suite, types, lint, build**

Run: `npx vitest run` then `npx tsc --noEmit` then `npx eslint .` then `npm run build`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add components/PricingTiers.tsx app/pricing/page.tsx tests/pricing-page.test.tsx
git commit -m "feat(payments): pricing page + subscribe CTAs (chunk H folded in) (DARK)"
```

---

### Task 11: Pipeline service-layer re-check (the second gate)

**Files (lyrical-studio):**
- Modify: `dashboard/service/website/client.py`
- Modify: `dashboard/service/website/poller.py`
- Test: `tests/dashboard/website/test_client.py` (add), `tests/dashboard/website/test_poller.py` (add)

**Interfaces:**
- Produces on `WebsiteClient`: `def active_entitlement(self, user_id: str) -> bool` (True iff the user has a subscription row with status in `{active, trialing}` AND the count of `song_jobs` with `quota_consumed_at >= current_period_start` for that user is `<= allowance`). Since the covers are already consumed at submit, the pipeline check is: active status AND used `<=` allowance (the job being run is already counted). Keep the allowance map in Python mirroring `lib/pricing.ts`.
- Consumes in `poller.run_once`: after `client.claim(job.id)` and before `create_song_fn`, call `client.active_entitlement(job.user_id)`; if False, `client.set_pipeline_state(job.id, "failed", error="not entitled at render time")` and `return run_id=None` without spending.

Notes:
- This is belt-and-braces: F only queues entitled jobs, but a subscription can lapse between submit and render, and spend must never happen for a lapsed account. Fail loud (stamp failed), do not silently skip.
- Mirror the existing httpx MockTransport test style in that folder.

- [ ] **Step 1: Write the failing client test**

```python
# tests/dashboard/website/test_client.py  (add this test to the existing file)
import httpx
from dashboard.service.website.client import WebsiteClient
from dashboard.service.website.config import WebsiteConfig


def _cfg():
    return WebsiteConfig(
        supabase_url="https://x.supabase.co",
        service_role_key="k",
        submissions_bucket="submissions",
    )


def test_active_entitlement_true_when_active_and_under_allowance():
    def handler(request: httpx.Request) -> httpx.Response:
        if "subscriptions" in request.url.path:
            return httpx.Response(200, json=[{
                "tier": "starter", "status": "active",
                "current_period_start": "2026-09-01T00:00:00Z",
            }])
        if "song_jobs" in request.url.path:
            # PostgREST count via Content-Range header
            return httpx.Response(200, headers={"content-range": "0-1/2"}, json=[])
        raise AssertionError(request.url.path)

    client = WebsiteClient(_cfg(), httpx.Client(transport=httpx.MockTransport(handler)))
    assert client.active_entitlement("u1") is True


def test_active_entitlement_false_when_canceled():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[{
            "tier": "starter", "status": "canceled",
            "current_period_start": "2026-09-01T00:00:00Z",
        }])

    client = WebsiteClient(_cfg(), httpx.Client(transport=httpx.MockTransport(handler)))
    assert client.active_entitlement("u1") is False


def test_active_entitlement_false_when_over_allowance():
    def handler(request: httpx.Request) -> httpx.Response:
        if "subscriptions" in request.url.path:
            return httpx.Response(200, json=[{
                "tier": "starter", "status": "active",
                "current_period_start": "2026-09-01T00:00:00Z",
            }])
        return httpx.Response(200, headers={"content-range": "0-3/4"}, json=[])

    client = WebsiteClient(_cfg(), httpx.Client(transport=httpx.MockTransport(handler)))
    assert client.active_entitlement("u1") is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONUTF8=1 .venv/Scripts/python.exe -m pytest tests/dashboard/website/test_client.py -q`
Expected: FAIL (no `active_entitlement`).

- [ ] **Step 3: Implement on the client**

```python
# dashboard/service/website/client.py  (add near the reads)

# Tier -> covers a month, mirroring lyrical-website/lib/pricing.ts. Kept here so the
# render side can refuse spend without importing anything from the website repo.
_ALLOWANCE = {"starter": 3, "creator": 12, "pro": 40}
_ACTIVE = {"active", "trialing"}


def active_entitlement(self, user_id: str) -> bool:
    """True iff this user may have a cover rendered right now: an active
    subscription AND still within the tier's monthly allowance. The website has
    already consumed the cover at submit, so the running job is included in the
    count and the test is used <= allowance. Belt-and-braces against a
    subscription that lapsed between submit and render; never spend without it."""
    r = self._http.get(
        f"{self._rest}/subscriptions",
        params={
            "user_id": f"eq.{user_id}",
            "select": "tier,status,current_period_start",
            "limit": "1",
        },
        headers=self._headers,
    )
    r.raise_for_status()
    rows = r.json()
    if not rows:
        return False
    sub = rows[0]
    if sub.get("status") not in _ACTIVE:
        return False
    allowance = _ALLOWANCE.get(sub.get("tier") or "", 0)
    if allowance == 0:
        return False
    since = sub.get("current_period_start")
    if not since:
        return False

    cr = self._http.get(
        f"{self._rest}/song_jobs",
        params={
            "user_id": f"eq.{user_id}",
            "quota_consumed_at": f"gte.{since}",
            "select": "id",
        },
        headers={**self._headers, "Prefer": "count=exact", "Range-Unit": "items", "Range": "0-0"},
    )
    cr.raise_for_status()
    # PostgREST returns the total in Content-Range as "start-end/total".
    total = cr.headers.get("content-range", "*/0").split("/")[-1]
    used = int(total) if total.isdigit() else 0
    return used <= allowance
```

(Add `active_entitlement` as a method on `WebsiteClient`, indented into the class.)

- [ ] **Step 4: Run test to verify it passes**

Run: `PYTHONUTF8=1 .venv/Scripts/python.exe -m pytest tests/dashboard/website/test_client.py -q`
Expected: PASS.

- [ ] **Step 5: Write the failing poller test**

```python
# tests/dashboard/website/test_poller.py  (add to the existing file)

def test_run_once_skips_spend_when_not_entitled(tmp_path):
    from dashboard.service.website.poller import run_once
    from dashboard.service.website.config import WebsiteConfig
    from dashboard.service.website.models import WebsiteJob

    calls = {"created": 0}

    class FakeClient:
        def next_queued_job(self):
            return WebsiteJob(
                id="j1", user_id="u1", title="t", primary_artist="a",
                source_language="es", target_language="en",
                pipeline_voice_model="Some_Voice",
            )
        def claim(self, job_id):
            return True
        def active_entitlement(self, user_id):
            return False
        def set_pipeline_state(self, job_id, state, error=None):
            self.state = (state, error)

    def create_song_fn(req, appstate=None):
        calls["created"] += 1
        return "run1"

    client = FakeClient()
    cfg = WebsiteConfig(supabase_url="u", service_role_key="k", submissions_bucket="s")
    out = run_once(client, cfg, create_song_fn=create_song_fn, work_root=tmp_path)
    assert out is None
    assert calls["created"] == 0
    assert client.state[0] == "failed"
```

(Match `WebsiteJob`'s real constructor; if it does not take these kwargs, build it the way the existing poller tests do.)

- [ ] **Step 6: Run test to verify it fails**

Run: `PYTHONUTF8=1 .venv/Scripts/python.exe -m pytest tests/dashboard/website/test_poller.py -q`
Expected: FAIL (spend still happens).

- [ ] **Step 7: Wire the re-check into the poller**

In `dashboard/service/website/poller.py`, inside `run_once`, right after `if not client.claim(job.id): return None` and before the `try:` that downloads and spends:

```python
    # Second gate: the customer must still be entitled at render time. The website
    # consumed the cover at submit, but a subscription can lapse in between, and
    # spend must never happen for a lapsed account. Fail loud, do not silently skip.
    if not client.active_entitlement(job.user_id):
        client.set_pipeline_state(job.id, "failed", error="not entitled at render time")
        return None
```

- [ ] **Step 8: Run test to verify it passes**

Run: `PYTHONUTF8=1 .venv/Scripts/python.exe -m pytest tests/dashboard/website/ -q`
Expected: PASS.

- [ ] **Step 9: Commit (lyrical-studio repo)**

```bash
git add dashboard/service/website/client.py dashboard/service/website/poller.py tests/dashboard/website/test_client.py tests/dashboard/website/test_poller.py
git commit -m "feat(website): re-check subscription entitlement before render spend"
```

---

### Task 12: Full verification pass

- [ ] **Step 1: Website full suite + gates**

Run (in `lyrical-website`):
```bash
npx vitest run
npx tsc --noEmit
npx eslint .
npm run build
npm audit --omit=dev
```
Expected: tests pass, no type errors, no lint errors, build clean, no new high-severity audit findings from `stripe`.

- [ ] **Step 2: Pipeline full suite**

Run (in `lyrical-studio`):
```bash
PYTHONUTF8=1 .venv/Scripts/python.exe -m pytest -q
```
Expected: full suite passes (~1571 + the new tests).

- [ ] **Step 3: Write the deploy notes into the plan's sibling doc**

Confirm the deploy checklist additions (env vars, Stripe products, webhook endpoint) are captured in the handover's section 5. If not, append them.

- [ ] **Step 4: Final commit (docs only, if needed)**

```bash
git add docs/
git commit -m "docs(payments): deploy notes for chunk E (DARK)"
```

---

## Deploy-time (Henry only, when he says launch)

Not part of the build. Recorded here so nothing is missed:
1. Run `supabase/schema.sql` in the Supabase SQL editor (adds `subscriptions` + `quota_consumed_at`). The `song_jobs` customer grant is unchanged by this chunk (quota_consumed_at is staff-only).
2. Create the three Stripe products/prices (test first, then live). Set `STRIPE_PRICE_STARTER/CREATOR/PRO` in Vercel.
3. Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Vercel.
4. Add the Stripe webhook endpoint pointing at `/api/stripe-webhook`, subscribed to `checkout.session.completed`, `customer.subscription.created/updated/deleted`.
5. ff-merge the branch into main and push (= deploy). Read the live pricing page and a test checkout back.

## Self-review

- **Spec coverage:** subscriptions table + RLS (Task 3); Stripe Checkout + Portal (Task 7); `/api/stripe-webhook` verify + upsert (Task 6); quota accounting (Task 4); two-sided gate: website (Task 8) + pipeline (Task 11); pricing page + billing panel, chunk H folded in (Tasks 9, 10). All five locked answers honored: tiers (Task 1), hard block (Task 4 `computeQuota`, no overage path), anniversary reset (Task 4 uses `current_period_start`), no free cover (gate blocks with no active sub, Task 8), Stripe test mode (config-gated everywhere, Henry adds keys).
- **Type consistency:** `QuotaStatus`, `SubRow`, `SyncInput`, `Tier`, `TierId`, `ActionResult` are defined once and reused by name across tasks. `quota_consumed_at`, `subscriptions` columns, and the allowance map (TS `TIERS.covers` and Python `_ALLOWANCE`) agree on the three numbers.
- **Placeholder scan:** every code step carries real code; no TODO/TBD.
