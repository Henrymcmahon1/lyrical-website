# Bot 0: Prep (migrations, plans, entitlement, copy deck)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Paste this to start the session:**
> Read `docs/superpowers/specs/2026-09-22-two-doors-v2-design.md` then `docs/bots/BOT-0-prep.md` in `C:\Users\User\CascadeProjects\lyrical-website`. Work on branch `feat/v2-prep` off `develop`. Never touch `main`. Execute the brief task by task. Migrations are applied by driving the Supabase SQL editor in my signed-in Chrome (claude-in-chrome tools), never by tokens on disk.

**Goal:** Land the shared foundation every other v2 bot builds on: three SQL migrations applied to the live Supabase project, `lib/plans.ts`, a pure tested `lib/entitlement.ts`, a runnable `supabase/schema.sql`, `.env.example` additions, and the copy deck.

**Architecture:** Nothing here renders a page. It is the data model and two pure modules with exact interfaces that Bots A and C import. Migrations are numbered files in `supabase/migrations/`, applied by hand through the Supabase SQL editor in Henry's Chrome, then verified over PostgREST with the anon key.

**Tech Stack:** Next 16 (App Router), TypeScript, Vitest, Supabase (Postgres + PostgREST), zod.

**Spec:** `docs/superpowers/specs/2026-09-22-two-doors-v2-design.md` (§3, §4, §7 copy deck)

## Global Constraints

- Branch `feat/v2-prep` off `develop`. PR into `develop`. Never touch `main` or lyricalglobal.com.
- No em dashes anywhere (code, comments, SQL, docs).
- No secrets in files. The service key is never needed here: verification uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` from `.env.local`.
- Brand copy rules from `CLAUDE.md`: lowercase `lyrical`, US spelling in visitor copy, banned phrases ("AI-generated", "Solutions").
- `npm test && npm run build` green before the PR.
- Supabase project: `https://hikvjnpkvnxibfzdnpig.supabase.co`. SQL editor: `https://supabase.com/dashboard/project/hikvjnpkvnxibfzdnpig/sql/new`.

## File structure

| File | Responsibility |
|---|---|
| `supabase/migrations/001_plans_and_credits.sql` | plan tiers, `profiles.stripe_customer_id`, `song_credits`, `stripe_events` |
| `supabase/migrations/002_feedback_and_rerolls.sql` | `job_feedback`, re-roll + licence + delivery-profile columns, purge stamp, watermark id, column grants |
| `supabase/migrations/003_worker_heartbeat.sql` | `worker_heartbeat` |
| `supabase/schema.sql` | append the same DDL so the file stays runnable from scratch |
| `scripts/verify-schema.ts` | reads PostgREST OpenAPI with the anon key, asserts the new tables and columns exist |
| `lib/plans.ts` | the three plans, prices, allowances, `REROLLS_PER_TRACK`, `FOUNDING_BETA` |
| `lib/entitlement.ts` | `computeEntitlement(sub, usedThisPeriod, creditBalance)` pure |
| `tests/plans.test.ts`, `tests/entitlement.test.ts` | unit tests |
| `.env.example` | Stripe + investor env names (values blank) |
| `docs/v2/copy-deck.md` | the strings Bots B, C, D use |

---

### Task 1: Branch and migration files

**Files:**
- Create: `supabase/migrations/001_plans_and_credits.sql`, `002_feedback_and_rerolls.sql`, `003_worker_heartbeat.sql`

- [ ] **Step 1: Branch**

```bash
git checkout develop && git pull && git checkout -b feat/v2-prep
```

- [ ] **Step 2: Write `001_plans_and_credits.sql`**

```sql
-- 001: plans and credits (v2 two doors). Applied 2026-09-XX via the Supabase SQL editor.
alter table public.subscriptions drop constraint if exists subscriptions_tier_check;
alter table public.subscriptions add constraint subscriptions_tier_check
  check (tier in ('fan','superfan','starter','creator','pro'));
update public.subscriptions set tier = 'superfan' where tier in ('pro','creator');
update public.subscriptions set tier = 'fan' where tier = 'starter';

-- One user, one subscription row: the webhook upserts on user_id.
create unique index if not exists subscriptions_user_id_key on public.subscriptions (user_id);

alter table public.profiles add column if not exists stripe_customer_id text unique;
alter table public.profiles add column if not exists licence_terms_version text;

create table if not exists public.song_credits (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  delta           integer not null,
  reason          text not null check (reason in ('purchase_single','consume','refund','grant')),
  job_id          uuid references public.song_jobs (id) on delete set null,
  stripe_event_id text unique
);
create index if not exists song_credits_user_idx on public.song_credits (user_id, created_at desc);
alter table public.song_credits enable row level security;
drop policy if exists song_credits_self_select on public.song_credits;
create policy song_credits_self_select on public.song_credits for select using (auth.uid() = user_id);

create table if not exists public.stripe_events (
  id           text primary key,
  type         text not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz
);
alter table public.stripe_events enable row level security;
```

- [ ] **Step 3: Write `002_feedback_and_rerolls.sql`**

```sql
-- 002: feedback, re-rolls, licence version, delivery profile, purge stamp, watermark id.
create table if not exists public.job_feedback (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  job_id     uuid not null references public.song_jobs (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  rating     text not null check (rating in ('up','down')),
  note       text,
  tags       text[] not null default '{}',
  constraint job_feedback_down_needs_note
    check (rating <> 'down' or length(btrim(coalesce(note,''))) >= 20),
  unique (job_id, user_id)
);
create index if not exists job_feedback_created_idx on public.job_feedback (created_at desc);
alter table public.job_feedback enable row level security;
drop policy if exists job_feedback_self_select on public.job_feedback;
create policy job_feedback_self_select on public.job_feedback for select using (auth.uid() = user_id);
drop policy if exists job_feedback_self_insert on public.job_feedback;
create policy job_feedback_self_insert on public.job_feedback for insert with check (auth.uid() = user_id);
drop policy if exists job_feedback_self_update on public.job_feedback;
create policy job_feedback_self_update on public.job_feedback for update using (auth.uid() = user_id);

alter table public.song_jobs add column if not exists parent_job_id uuid references public.song_jobs (id) on delete set null;
alter table public.song_jobs add column if not exists reroll_index smallint not null default 0;
alter table public.song_jobs add column if not exists seed integer;
alter table public.song_jobs add column if not exists licence_terms_version text;
alter table public.song_jobs add column if not exists delivery_profile text not null default 'door2';
alter table public.song_jobs drop constraint if exists song_jobs_delivery_profile_check;
alter table public.song_jobs add constraint song_jobs_delivery_profile_check
  check (delivery_profile in ('door2','door1'));
create index if not exists song_jobs_parent_idx on public.song_jobs (parent_job_id);

-- song_jobs carries a COLUMN grant (see schema.sql). New customer-readable columns must be
-- added to it explicitly; seed and pipeline_error stay service-role only.
grant select (parent_job_id, reroll_index, licence_terms_version, delivery_profile)
  on public.song_jobs to anon, authenticated;

alter table public.song_job_assets add column if not exists purged_at timestamptz;
alter table public.song_job_deliveries add column if not exists watermark_id integer;
```

- [ ] **Step 4: Write `003_worker_heartbeat.sql`**

```sql
-- 003: render-worker heartbeat, upserted by the OptiPlex poller every loop.
create table if not exists public.worker_heartbeat (
  worker   text primary key,
  seen_at  timestamptz not null default now(),
  version  text
);
alter table public.worker_heartbeat enable row level security;
drop policy if exists worker_heartbeat_read on public.worker_heartbeat;
create policy worker_heartbeat_read on public.worker_heartbeat for select using (true);
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations && git commit -m "db: v2 migrations (plans, credits, feedback, re-rolls, heartbeat)"
```

### Task 2: Apply the migrations in Henry's Chrome

**Files:** none changed. This task drives the browser.

- [ ] **Step 1: Load the Chrome tools**

ToolSearch: `select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__find,mcp__claude-in-chrome__form_input,mcp__claude-in-chrome__tabs_create_mcp`

- [ ] **Step 2: Open the SQL editor**

Navigate to `https://supabase.com/dashboard/project/hikvjnpkvnxibfzdnpig/sql/new`. If it asks to sign in, stop and tell Henry; never enter credentials.

- [ ] **Step 3: Run 001, then 002, then 003**

For each file: paste the full contents into the editor (find the editor element with `find "editor"`, click it, select all, type the SQL), click Run, read the result panel. Expected: "Success. No rows returned" (001 and 002 also report rows updated). On any error, stop, fix the SQL file, re-run only the failed statement, and record what happened in the file header comment.

- [ ] **Step 4: Verify from the repo**

Create `scripts/verify-schema.ts`:

```ts
// Reads PostgREST's OpenAPI document with the anon key and asserts the v2 schema landed.
// Run: npx tsx scripts/verify-schema.ts
import { readFileSync } from 'node:fs'

function env(name: string): string {
  const line = readFileSync('.env.local', 'utf8').split('\n').find((l) => l.startsWith(name + '='))
  const v = line?.slice(name.length + 1).trim().replace(/^"|"$/g, '')
  if (!v) throw new Error(`${name} missing from .env.local`)
  return v
}

const url = env('NEXT_PUBLIC_SUPABASE_URL')
const key = env('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const res = await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
const spec = (await res.json()) as { definitions: Record<string, { properties: Record<string, unknown> }> }

const expect: Record<string, string[]> = {
  song_credits: ['delta', 'reason', 'stripe_event_id'],
  stripe_events: ['id', 'processed_at'],
  job_feedback: ['rating', 'note', 'tags'],
  worker_heartbeat: ['worker', 'seen_at'],
  song_jobs: ['parent_job_id', 'reroll_index', 'seed', 'licence_terms_version', 'delivery_profile'],
  song_job_assets: ['purged_at'],
  song_job_deliveries: ['watermark_id'],
  profiles: ['stripe_customer_id', 'licence_terms_version'],
}
let failed = false
for (const [table, cols] of Object.entries(expect)) {
  const props = spec.definitions[table]?.properties ?? {}
  for (const c of cols) {
    const ok = c in props
    if (!ok) failed = true
    console.log(`${ok ? 'ok  ' : 'MISSING'} ${table}.${c}`)
  }
}
if (failed) process.exit(1)
console.log('schema verified')
```

Run: `npx tsx scripts/verify-schema.ts`. Expected: every line `ok`, then `schema verified`.

- [ ] **Step 5: Check the grant the hard way**

Run in the SQL editor: `select column_name from information_schema.column_privileges where table_name='song_jobs' and grantee='authenticated' order by 1;`. Expected: the 12 original columns plus `parent_job_id, reroll_index, licence_terms_version, delivery_profile`, and NOT `seed`.

- [ ] **Step 6: Commit**

```bash
git add scripts/verify-schema.ts && git commit -m "db: verify-schema script (anon OpenAPI check)"
```

### Task 3: `lib/plans.ts`

**Files:**
- Create: `lib/plans.ts`, `tests/plans.test.ts`

**Interfaces:**
- Produces: `PlanId`, `PLANS`, `REROLLS_PER_TRACK`, `FOUNDING_BETA`, `planById(id)`, `priceFor(plan)`, `SUBSCRIPTION_PLANS`

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it } from 'vitest'
import { PLANS, REROLLS_PER_TRACK, planById, priceFor, SUBSCRIPTION_PLANS } from '@/lib/plans'

describe('plans', () => {
  it('has the three founding plans with the locked numbers', () => {
    expect(PLANS.single).toMatchObject({ kind: 'one_off', tracks: 1, foundingUsd: 9, standardUsd: 12 })
    expect(PLANS.fan).toMatchObject({ kind: 'subscription', tracks: 5, foundingUsd: 19, standardUsd: 29 })
    expect(PLANS.superfan).toMatchObject({ kind: 'subscription', tracks: 15, foundingUsd: 39, standardUsd: 59 })
    expect(REROLLS_PER_TRACK).toBe(2)
  })
  it('charges the founding price while the beta is on', () => {
    expect(priceFor('fan')).toBe(19)
  })
  it('rejects unknown ids', () => {
    expect(planById('pro')).toBeNull()
    expect(SUBSCRIPTION_PLANS).toEqual(['fan', 'superfan'])
  })
})
```

- [ ] **Step 2: Run, expect FAIL** `npx vitest run tests/plans.test.ts`

- [ ] **Step 3: Implement**

```ts
/**
 * The three Door-2 plans. Single source of truth for prices and allowances: the pricing page,
 * the billing page, the Stripe setup script and the entitlement gate all read from here.
 * Founding-beta prices are what checkout charges while FOUNDING_BETA is true; an existing
 * subscription keeps its Stripe price when the flag flips, which is how grandfathering works.
 */
export type PlanId = 'single' | 'fan' | 'superfan'

export type Plan = {
  id: PlanId
  name: string
  kind: 'one_off' | 'subscription'
  tracks: number
  foundingUsd: number
  standardUsd: number
  blurb: string
}

export const PLANS: Record<PlanId, Plan> = {
  single:   { id: 'single',   name: 'Single',   kind: 'one_off',      tracks: 1,  foundingUsd: 9,  standardUsd: 12, blurb: 'Try it, or a one-off gift' },
  fan:      { id: 'fan',      name: 'Fan',      kind: 'subscription', tracks: 5,  foundingUsd: 19, standardUsd: 29, blurb: 'The casual repeat user' },
  superfan: { id: 'superfan', name: 'Superfan', kind: 'subscription', tracks: 15, foundingUsd: 39, standardUsd: 59, blurb: 'Power user' },
}

export const PLAN_IDS: readonly PlanId[] = ['single', 'fan', 'superfan']
export const SUBSCRIPTION_PLANS: readonly PlanId[] = ['fan', 'superfan']
export const REROLLS_PER_TRACK = 2
export const FOUNDING_BETA = true

export function planById(id: string | null | undefined): Plan | null {
  return id && id in PLANS ? PLANS[id as PlanId] : null
}
export function priceFor(id: PlanId): number {
  return FOUNDING_BETA ? PLANS[id].foundingUsd : PLANS[id].standardUsd
}
```

- [ ] **Step 4: Run, expect PASS.** Step 5: `git add lib/plans.ts tests/plans.test.ts && git commit -m "feat(plans): the three Door-2 plans as one source of truth"`

### Task 4: `lib/entitlement.ts`

**Files:**
- Create: `lib/entitlement.ts`, `tests/entitlement.test.ts`

**Interfaces:**
- Consumes: `planById`, `REROLLS_PER_TRACK` from Task 3.
- Produces (Bots A and C import exactly these):

```ts
export type SubRow = { tier: string; status: string; current_period_start: string | null; current_period_end: string | null } | null
export type Entitlement =
  | { ok: true; source: 'subscription' | 'credit'; plan: PlanId | null; tracksLeft: number; renewsAt: string | null }
  | { ok: false; reason: 'no_plan' | 'period_exhausted' }
export const ACTIVE_STATUSES: ReadonlySet<string>
export function computeEntitlement(sub: SubRow, usedThisPeriod: number, creditBalance: number): Entitlement
export function rerollsLeft(childCount: number): number
```

- [ ] **Step 1: Failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { computeEntitlement, rerollsLeft } from '@/lib/entitlement'

const fan = { tier: 'fan', status: 'active', current_period_start: '2026-09-01T00:00:00Z', current_period_end: '2026-10-01T00:00:00Z' }

describe('computeEntitlement', () => {
  it('no subscription and no credits fails closed', () => {
    expect(computeEntitlement(null, 0, 0)).toEqual({ ok: false, reason: 'no_plan' })
  })
  it('an active Fan with tracks left is entitled by subscription', () => {
    expect(computeEntitlement(fan, 2, 0)).toEqual({ ok: true, source: 'subscription', plan: 'fan', tracksLeft: 3, renewsAt: fan.current_period_end })
  })
  it('an exhausted period falls through to credits', () => {
    expect(computeEntitlement(fan, 5, 1)).toMatchObject({ ok: true, source: 'credit', tracksLeft: 1 })
  })
  it('an exhausted period with no credits says so', () => {
    expect(computeEntitlement(fan, 5, 0)).toEqual({ ok: false, reason: 'period_exhausted' })
  })
  it('a cancelled subscription counts as none', () => {
    expect(computeEntitlement({ ...fan, status: 'canceled' }, 0, 0)).toEqual({ ok: false, reason: 'no_plan' })
  })
  it('an unknown tier is not a plan', () => {
    expect(computeEntitlement({ ...fan, tier: 'pro' }, 0, 0)).toEqual({ ok: false, reason: 'no_plan' })
  })
  it('credits alone entitle a single track', () => {
    expect(computeEntitlement(null, 0, 2)).toEqual({ ok: true, source: 'credit', plan: 'single', tracksLeft: 2, renewsAt: null })
  })
  it('rerolls left counts down from two', () => {
    expect(rerollsLeft(0)).toBe(2); expect(rerollsLeft(2)).toBe(0); expect(rerollsLeft(5)).toBe(0)
  })
})
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
import { planById, REROLLS_PER_TRACK, type PlanId } from './plans'

/**
 * Who may submit a track right now. Pure: the callers fetch the rows and counts, this decides.
 * A subscription with tracks left this period wins; otherwise a positive credit balance
 * (Single purchases) allows one track; otherwise nothing. Fails closed on anything unknown.
 * Re-rolls never pass through here: they consume nothing.
 */
export type SubRow = { tier: string; status: string; current_period_start: string | null; current_period_end: string | null } | null

export type Entitlement =
  | { ok: true; source: 'subscription' | 'credit'; plan: PlanId | null; tracksLeft: number; renewsAt: string | null }
  | { ok: false; reason: 'no_plan' | 'period_exhausted' }

export const ACTIVE_STATUSES: ReadonlySet<string> = new Set(['active', 'trialing'])

export function computeEntitlement(sub: SubRow, usedThisPeriod: number, creditBalance: number): Entitlement {
  const plan = sub && ACTIVE_STATUSES.has(sub.status) ? planById(sub.tier) : null
  const subscribed = !!plan && plan.kind === 'subscription'
  if (subscribed) {
    const left = plan.tracks - usedThisPeriod
    if (left > 0) return { ok: true, source: 'subscription', plan: plan.id, tracksLeft: left, renewsAt: sub!.current_period_end }
  }
  if (creditBalance > 0) return { ok: true, source: 'credit', plan: 'single', tracksLeft: creditBalance, renewsAt: null }
  return { ok: false, reason: subscribed ? 'period_exhausted' : 'no_plan' }
}

export function rerollsLeft(childCount: number): number {
  return Math.max(0, REROLLS_PER_TRACK - childCount)
}
```

- [ ] **Step 4: Run, expect PASS.** Step 5: `git add lib/entitlement.ts tests/entitlement.test.ts && git commit -m "feat(entitlement): pure plan/credit gate with tests"`

### Task 5: schema.sql, .env.example

- [ ] **Step 1:** Append to `supabase/schema.sql` a section `-- ── v2 two doors (2026-09-22) ──` containing the three migration files' DDL verbatim (so a fresh project can be built from the one file). Also add the two missing table definitions the file never had, copied from the live shapes: `subscriptions (id, created_at, updated_at, user_id, stripe_customer_id, stripe_subscription_id, tier, status, current_period_start, current_period_end)` and `song_job_deliveries (id, created_at, job_id, user_id, kind, path, filename, bytes)`, each with RLS enabled and a self-select policy on `user_id`.
- [ ] **Step 2:** Add to `.env.example` (values blank, one comment each):

```
# Stripe (test keys on omega, live only at promotion). Bot A's scripts/stripe-setup.ts prints the price ids.
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_PRICE_SINGLE=
STRIPE_PRICE_FAN=
STRIPE_PRICE_SUPERFAN=
# /investors gate. Separate namespace from DEMO_PASSWORD and ADMIN_PASSWORD.
INVESTOR_PASSWORD=
```

- [ ] **Step 3:** `npm test && npm run build`. Commit: `git commit -am "db: schema.sql carries v2 DDL; env names for Stripe and investors"`

### Task 6: Copy deck

**Files:** Create `docs/v2/copy-deck.md`

- [ ] **Step 1:** Write the deck. Every string below is final unless Henry changes it; Bots B, C, D copy them verbatim.

```markdown
# v2 copy deck (two doors)

Rules: lowercase `lyrical`. US spelling. No em dashes. Never "AI-generated". Say re-sung, recreated, performed.

## Fan-facing (Door 2)
- Hero headline: Sing your favorite song in any language.
- Hero sub: Upload your song, pick a language, and hear it re-sung in the same voice. Founding beta: rough edges, honest prices, two free re-rolls on every track.
- Primary CTA: See plans
- Secondary CTA: For artists
- Beta line (everywhere a track is shown): Beta output. Personal use only.
- Licence line (delivery card): Personal use only. Not for release or sale. lyrical may carry an inaudible provenance mark.
- Plan names: Single, Fan, Superfan. Badge on Fan: Most fans.
- Plan blurbs: Single: Try it, or a one-off gift. Fan: The casual repeat user. Superfan: Power user.
- Re-roll line: Every track comes with 2 free re-rolls.
- Founding line: Founding beta prices. Sign up now and keep them for life.
- Anchor line: A human singer costs $2,000 a language. We never charge that for automated output.
- Empty studio: Nothing here yet. Pick a plan and make your first track.
- Thumbs-down prompt: Tell us exactly what is wrong: which line, what time in the song, is it timing, pronunciation, the voice, or the meaning of the words? The more you write, the better the re-roll.
- Thumbs-up prompt: Anything you loved, or anything small to fix? (optional)
- Re-roll button: Re-roll this track ({n} left)
- Re-roll closed: The re-roll window for this song has closed. Make it again to start fresh.
- Out of tracks: You are out of tracks for this period. Upgrade, buy a Single, or wait for it to renew.

## Artist-facing (Door 1)
- Headline: Your songs, in every language, in your voice.
- Terms sentence: 30% of net streaming receipts on the new-language masters, perpetual and exclusive, $0 upfront. You get lossless stems and a human in the loop.
- Precedent: Our first signed artist is Coffey Anderson.
- Calculator title: What could a new language earn you?
- Calculator caveat: Every number here is an estimate from public payout averages and your own inputs. Real receipts depend on the songs, the markets and the release.
- EOI title: Register your interest
- EOI button: Send

## Investor page
- Title: One technology, two doors.
- Frame: Not a tool. A rights catalog with an engine.
- Placeholder flag: The $8,000 per master per year is a placeholder until one real release reports.
```

- [ ] **Step 2:** Commit: `git add docs/v2/copy-deck.md && git commit -m "docs: v2 copy deck"`

### Task 7: PR

- [ ] `npm test && npm run build` green. `git push -u origin feat/v2-prep`. Open a PR into `develop` titled "v2 prep: migrations, plans, entitlement, copy deck". Body lists the three migrations as APPLIED with the date and the verify-schema output. Tell Henry the branch is ready and that Bots A to F can start.

## Done when

- `npx tsx scripts/verify-schema.ts` prints `schema verified` against the live project.
- `tests/plans.test.ts` and `tests/entitlement.test.ts` pass.
- `docs/v2/copy-deck.md` exists.
- PR open into `develop`.
