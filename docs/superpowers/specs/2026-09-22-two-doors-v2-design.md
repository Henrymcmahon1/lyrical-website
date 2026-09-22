# Two doors v2: design spec

**Date:** 2026-09-22. **Status:** approved by Henry (design page: https://claude.ai/artifact/Rgk8kaYBHb8JaPHnYqEmRS).
**Branch:** everything lands on `develop` of `lyrical-website` (deploys to https://lyrical-studio-omega.vercel.app) and on `main` of `lyrical-studio` (the pipeline, runs on the OptiPlex render PC).
**Never touch `main` of `lyrical-website` or lyricalglobal.com.** Real clients, manual funnel. See `docs/HANDOVER-v2-businessmodel-2026-09-22.md` §4.

Every bot reads this spec, then its own brief in `docs/bots/`.

---

## 1. What we are building

"One technology, two doors." The same pipeline, two go-to-market doors.

| | Door 1: the moat | Door 2: the toy (beta) |
|---|---|---|
| Who | Signed career artists | Fans and hobbyists |
| Model | 30% of net streaming receipts, perpetual, exclusive, $0 upfront | Single $9 / Fan $19 mo / Superfan $39 mo (founding beta prices, grandfathered) |
| Output | 24-bit WAV stems, no watermark, commercial licence, human QA | One flattened 192k MP3, inaudible watermark, personal use only, no human QA |
| Where it runs | Internal dashboard on the render PC, manual | Self-serve on the website, automated |
| Precedent | Coffey Anderson | Nobody yet: the beta finds them |

The cap on Door 2 is the funnel: a fan who wants stems or commercial rights hits a wall and is pointed to Door 1.

**The feedback loop is the product.** Every delivered track gets a one-tap rating. A thumbs-down requires a detailed note and unlocks a free re-roll (up to 2 per track). The ratings are the labelled data that trains the placement engine.

Out of scope this round: a per-tier quality ladder (the pipeline already ships the capped profile by default), self-serve royalty ("Door 1.5"), the Studio Single bridge SKU as a purchasable product (it is mentioned on the site, sold by hand), renaming `lyrical-studio` to `lyrical-pipeline`.

## 2. Architecture: two repos, one contract

```
lyrical-website (Next 16, Vercel)   <-- Supabase -->   lyrical-studio (Python, OptiPlex 192.168.86.31)
  marketing, /pricing, /artists,        song_jobs          poller (scripts/website_poll.py, task LyricalPoller)
  /investors, Door-2 studio, Stripe,    song_job_assets    SynthV + Seed-VC render, watermark, MP3 encode
  feedback, re-roll requests            song_job_deliveries re-roll execution, stem purge, Door-1 WAV export
                                        subscriptions       internal Door-1 dashboard (dashboard/, LAN only)
                                        song_credits
                                        job_feedback
```

Decisions locked 22 Sep:

1. **The Python pipeline is never copied into the web repo.** Separate by concern: web on Vercel, ML on the machine with the GPU.
2. **The internal Door-1 dashboard stays on the render PC** (option A). Henry reaches it over LAN or RustDesk. No public surface, no exposed FastAPI. The website does not host it.
3. **The Supabase contract is the only shared surface.** The website writes `song_jobs` rows with `pipeline_state='queued'` plus `song_job_assets`; the poller reads them and writes deliveries. This round extends the contract (re-rolls, feedback, purge stamps) but never bypasses it.
4. **Storage:** stems are downloaded to the render PC during the render and **deleted from Supabase on delivery**. The local copy under `work/website/<job_id>/` is kept 30 days for re-rolls, then purged. Supabase is transit, not archive. The AWS cold-standby VM will not have the stems; a re-roll on the standby fails loud with `stems_expired`. Accepted.
5. **Stripe in test mode on omega.** Live keys only when Henry promotes to lyricalglobal.com.
6. **Migrations are applied by driving the Supabase SQL editor in Henry's signed-in Chrome** (claude-in-chrome tools), one numbered file at a time, then verified over PostgREST. No tokens on disk.

## 3. Data model changes (Bot 0)

Live project `hikvjnpkvnxibfzdnpig`. Tables today: `enquiries, profiles, song_job_assets, song_job_deliveries, song_jobs, subscriptions, voice_models, voice_samples`. `supabase/schema.sql` in the repo is stale (no `subscriptions`, no `song_job_deliveries`, none of the automation columns). Bot 0 writes `supabase/migrations/NNN_*.sql` files AND appends the same DDL to `schema.sql` so the file is runnable again.

### 001_plans_and_credits.sql

```sql
-- Plans: subscriptions carry 'fan' | 'superfan'. 'single' is not a subscription, it is a credit.
alter table public.subscriptions drop constraint if exists subscriptions_tier_check;
alter table public.subscriptions add constraint subscriptions_tier_check
  check (tier in ('fan','superfan','starter','creator','pro'));  -- old values tolerated until the two test rows are migrated
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
  delta           integer not null,                 -- +1 purchase, -1 consume, +1 refund/grant
  reason          text not null check (reason in ('purchase_single','consume','refund','grant')),
  job_id          uuid references public.song_jobs (id) on delete set null,
  stripe_event_id text unique                        -- idempotency for purchases
);
create index if not exists song_credits_user_idx on public.song_credits (user_id, created_at desc);
alter table public.song_credits enable row level security;
create policy song_credits_self_select on public.song_credits for select using (auth.uid() = user_id);
-- No insert policy: only the service role writes credits.

create table if not exists public.stripe_events (
  id           text primary key,          -- Stripe event id
  type         text not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz
);
alter table public.stripe_events enable row level security;  -- service role only
```

### 002_feedback_and_rerolls.sql

```sql
create table if not exists public.job_feedback (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  job_id     uuid not null references public.song_jobs (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  rating     text not null check (rating in ('up','down')),
  note       text,
  tags       text[] not null default '{}',   -- optional: timing | pronunciation | voice | meaning | mix | other
  -- A thumbs-down must explain itself. 20 characters is the floor, the UI asks for much more.
  constraint job_feedback_down_needs_note check (rating <> 'down' or length(btrim(coalesce(note,''))) >= 20),
  unique (job_id, user_id)
);
alter table public.job_feedback enable row level security;
create policy job_feedback_self_select on public.job_feedback for select using (auth.uid() = user_id);
create policy job_feedback_self_insert on public.job_feedback for insert with check (auth.uid() = user_id);
create policy job_feedback_self_update on public.job_feedback for update using (auth.uid() = user_id);

alter table public.song_jobs add column if not exists parent_job_id uuid references public.song_jobs (id) on delete set null;
alter table public.song_jobs add column if not exists reroll_index smallint not null default 0;  -- 0 original, 1, 2
alter table public.song_jobs add column if not exists seed integer;                                -- render variation for re-rolls
alter table public.song_jobs add column if not exists licence_terms_version text;                  -- personal-use terms accepted at submit
alter table public.song_jobs add column if not exists delivery_profile text not null default 'door2'
  check (delivery_profile in ('door2','door1'));
create index if not exists song_jobs_parent_idx on public.song_jobs (parent_job_id);

alter table public.song_job_assets add column if not exists purged_at timestamptz;   -- set when the object is deleted from Storage
alter table public.song_job_deliveries add column if not exists watermark_id integer; -- 16-bit AudioSeal message
```

Customers can read `parent_job_id`, `reroll_index`, `licence_terms_version` (grant select on those columns to `authenticated`, matching how `status` is readable and `pipeline_state` is not). `seed`, `pipeline_error`, `purged_at`, `watermark_id` stay service-role only.

### 003_worker_heartbeat.sql

```sql
create table if not exists public.worker_heartbeat (
  worker   text primary key,              -- 'optiplex' | 'aws-standby'
  seen_at  timestamptz not null default now(),
  version  text
);
alter table public.worker_heartbeat enable row level security;
create policy worker_heartbeat_read on public.worker_heartbeat for select using (true);
```

The poller upserts its row every loop (Bot F). The studio shows "Renders are running" or "Renders are paused, your song will start when they resume" from it (Bot C, optional polish).

## 4. Plans and entitlement (Bot 0, used by A and C)

`lib/plans.ts` is the single source of truth. The old `ALLOWANCE` map in `self-serve-actions.ts` and the dashboard's `entitlement/tiers.ts` are replaced.

```ts
export type PlanId = 'single' | 'fan' | 'superfan'
export const PLANS = {
  single:   { name: 'Single',   kind: 'one_off',      tracks: 1,  foundingUsd: 9,  standardUsd: 12, rerolls: 2 },
  fan:      { name: 'Fan',      kind: 'subscription', tracks: 5,  foundingUsd: 19, standardUsd: 29, rerolls: 2 },
  superfan: { name: 'Superfan', kind: 'subscription', tracks: 15, foundingUsd: 39, standardUsd: 59, rerolls: 2 },
} as const
export const REROLLS_PER_TRACK = 2
export const FOUNDING_BETA = true   // flip when beta ends; checkout switches to standard prices, existing subs keep theirs
```

`lib/entitlement.ts` is pure (no I/O), fully unit tested:

```ts
type SubRow = { tier: string; status: string; current_period_start: string | null } | null
type Entitlement =
  | { ok: true;  source: 'subscription' | 'credit'; plan: PlanId | null; tracksLeft: number; renewsAt: string | null }
  | { ok: false; reason: 'no_plan' | 'period_exhausted' }
export function computeEntitlement(sub: SubRow, usedThisPeriod: number, creditBalance: number): Entitlement
```

Rules:
- An active/trialing subscription with `tracks - usedThisPeriod > 0` wins. `usedThisPeriod` counts `song_jobs` rows for the user with `reroll_index = 0` and `quota_consumed_at >= current_period_start`.
- Otherwise a positive credit balance (sum of `song_credits.delta`) allows one track and the submit action writes a `consume` row (`delta -1`, `job_id`).
- Re-rolls never consume anything (`quota_consumed_at` null, `reroll_index > 0`).
- Fail closed: no sub and no credits means no submit.

`submitSelfServeJob` (Bot A edits this one function) calls `computeEntitlement`, and when the source is `credit` inserts the consume row in the same code path as the job insert, deleting the job if the consume insert fails.

## 5. Payments (Bot A)

Stripe, test mode, Node SDK (`stripe` npm). The Stripe MCP connector is not required.

- **Products and prices** created by an idempotent script `scripts/stripe-setup.ts` keyed on `lookup_key`: `single_founding` ($9 one-time), `single_standard` ($12), `fan_founding` ($19/mo), `fan_standard` ($29/mo), `superfan_founding` ($39/mo), `superfan_standard` ($59/mo). The script prints the price ids; Henry puts them in Vercel env as `STRIPE_PRICE_SINGLE`, `STRIPE_PRICE_FAN`, `STRIPE_PRICE_SUPERFAN` (the founding ones while `FOUNDING_BETA`). Grandfathering is free: an existing subscription keeps its price object when checkout later points at the standard one.
- **Env:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, the three price ids. Add to `.env.example`. Henry adds real test values to the omega Vercel project himself; nobody types keys into files.
- **Checkout:** server action `startCheckout(plan: PlanId)` in `app/studio/billing/actions.ts`. Requires a signed-in user. Finds or creates the Stripe customer (stored on `profiles.stripe_customer_id`). `mode: 'payment'` for single, `'subscription'` for fan/superfan. `success_url = /studio?paid=1`, `cancel_url = /pricing`. Metadata carries `user_id` and `plan`.
- **Webhook:** `app/api/stripe/webhook/route.ts`. Verify the signature with the raw body. Insert `stripe_events(id, type)`; on conflict return 200 without processing (idempotent). Handle:
  - `checkout.session.completed`: mode payment → `song_credits` `+1 purchase_single` with `stripe_event_id`; mode subscription → upsert `subscriptions` (user from metadata, `stripe_customer_id`, `stripe_subscription_id`, tier from the price lookup_key, status, period start/end).
  - `customer.subscription.updated` / `.deleted`: update status, tier, period.
  - `invoice.paid`: refresh `current_period_start/end`.
  - Stamp `processed_at`. Unknown types: 200, ignored.
- **Portal:** `openBillingPortal()` creates a Billing Portal session (test-mode default configuration) and redirects.
- **`/studio/billing`:** the plan name, renews-on date, tracks used / left this period, credit balance, buttons: Change plan (portal), Buy a Single, Upgrade. With `?plan=<id>` in the URL it starts checkout immediately (this is how `/pricing` buttons work: `/studio/sign-in?next=/studio/billing?plan=fan`).
- **Studio gate:** `submitSelfServeJob` uses `computeEntitlement` (see §4). `/studio/new` redirects to `/pricing?why=plan` when the entitlement is not ok (Bot C renders the page-side message; Bot A owns the check helper `getEntitlementFor(userId)` in `lib/entitlement-db.ts`).
- **Testing:** unit tests for the webhook handler with constructed event payloads (signature verification mocked at the boundary), entitlement tests, a `stripe listen --forward-to localhost:3000/api/stripe/webhook` note for local runs, and the Stripe test card `4242 4242 4242 4242` walkthrough on omega with the webhook endpoint registered in the Stripe test dashboard by Henry (or by the bot in Henry's Chrome).

## 6. Door-2 studio (Bot C)

- **Studio home `/studio`:** a plan card at the top (plan, tracks left, renews on, link to `/studio/billing`; or "No plan yet" with a link to `/pricing`). Then the song list. Each delivered song shows the player, the download, the licence line ("Personal use only. Beta output."), and the feedback bar. Re-rolls render nested under their original as "Take 2", "Take 3", each with its own player and feedback bar.
- **Onboarding:** sign-in page copy reframed for the beta ("Sing your favorite song in any language. Founding beta."). After sign-in with no entitlement the studio shows the plan card in its empty state. `/studio/new` with no entitlement redirects to `/pricing?why=plan`.
- **Feedback bar** (`components/FeedbackBar.tsx`, client): thumbs-up and thumbs-down. Up: optional note. Down: a required textarea, minimum 20 characters, with guiding placeholder text ("Tell us exactly what is wrong: which line, what time in the song, is it timing, pronunciation, the voice, the meaning of the words?"), plus optional tag chips (timing, pronunciation, voice, meaning, mix, other). One rating per job per user; a second submit updates it. Server action `submitFeedback` uses the user's client so RLS applies. Schema in `lib/feedback-schema.ts` (zod), tested.
- **Re-roll:** after a thumbs-down is saved, the bar shows "Re-roll this track (N left)". Server action `requestReroll(jobId)` in `app/studio/reroll-actions.ts` (privileged): the job must be the user's, delivered, the family (original + children) must have fewer than `REROLLS_PER_TRACK` children, and a `down` rating with a note must exist on the job being re-rolled. It inserts a child `song_jobs` row: same title/artist/languages/lyrics/voice, `parent_job_id = original id` (always the original, not the child), `reroll_index = children + 1`, `seed = random int32`, `route='auto'`, `pipeline_state='queued'`, `status='approved'`, `quota_consumed_at = null`, `licence_terms_version` copied. No `song_job_assets` rows: the poller resolves stems from the parent. Copies nothing else.
- **Licence gate:** `lib/terms.ts` gains `LICENCE_TERMS_VERSION = '2026-09-22'` and `LICENCE_TERMS_POINTS` (personal, non-commercial use; no upload to streaming or sales platforms; no claim the recording is the artist's official release; lyrical may embed an inaudible provenance mark; beta output may contain errors and re-rolls are the remedy). A required checkbox on `/studio/new` in self-serve mode; the version is stamped on `song_jobs.licence_terms_version` by the submit action, and on `profiles.licence_terms_version` the first time. The delivered card shows the licence line.
- **Staff view:** `/queue?tab=feedback` (existing admin gate): newest first, job title, artist, languages, rating, tags, note, links to the job; CSV export at `/queue/export?tab=feedback`.
- **Failure copy:** customers cannot read `pipeline_error`, so the poller also sets `status='rejected'` on a `stems_expired` child (Bot F). A rejected child shows "The re-roll window for this song has closed. Make it again to start fresh."

## 7. Marketing and copy (Bot B)

Brand is locked (`CLAUDE.md`): cream, graphite, indigo, ember; Fraunces + Archivo; no gradients; lowercase `lyrical`; US spelling; banned phrases enforced by `tests/copy.test.ts`. No em dashes.

- **Landing `/`:** rewritten for two doors. Order: hero (fan-facing headline, "Sing your favorite song in any language", founding beta, primary CTA to `/pricing`, secondary "For artists" to `/artists`); Coffey Anderson before/after (an A/B player, original vs the new-language version, signed URLs minted server-side from a private bucket path Henry supplies; the section ships with the slots and copy ready and renders nothing if the files are absent); how it works (upload your stems, pick a language, get your MP3, rate it); pricing preview (three cards, link to `/pricing`); "Beta, honestly" (the rate / re-roll loop); the Door-1 block (30% royalty, $0 upfront, lossless, human QA, link to `/artists`); closing CTA. Existing section components are reused where they fit and left in place for `/about`.
- **`/pricing`:** the three plans with founding prices and struck standard prices, "Most fans" badge on Fan, "2 free re-rolls per track" on every card, the Controlla $2,000 per language anchor struck through with the wedge sentence, the cap table (what self-serve delivers vs Door 1), an FAQ (what do I upload, what do I get, can I release it, what is a re-roll, what does beta mean). Buttons link to `/studio/sign-in?next=/studio/billing?plan=<id>`.
- **`/investors`:** password gated with a new `lib/investor-auth.ts` (namespace `investor:`, env `INVESTOR_PASSWORD`, 4-hour session), same shape as `demo-auth`. Content rebuilt from the v6 vision (atom, two doors, Door 2 priced, beta, the cap is the funnel, Door 1 modelled with the $8,000/master figure labelled a placeholder, the flywheel, the valuation frame, the comps). `noindex`, disallowed in `robots.ts`, absent from the sitemap. No em dashes.
- **Nav:** Home, Pricing, For artists, Studio. Footer unchanged plus Pricing and For artists.
- **Copy deck:** Bot 0 writes `docs/v2/copy-deck.md` (headlines, plan names, the licence line, the beta line, the Door-1 sentence). Bots B, C, D take their strings from it so the site reads as one voice.

## 8. Door 1 on the website (Bot D)

`/artists`: the pitch (Door 1 terms, Coffey precedent, human in the loop, lossless stems, what lyrical does and does not touch), an earnings calculator, and an expression-of-interest form.

- **Calculator** (`components/EarningsCalculator.tsx`, client; a static worked example renders without JavaScript): inputs are monthly streams across platforms, number of songs, languages wanted (1 to 3), and a slider for "new-language audience as a share of your current one" (default 20%, labelled an assumption). Constants in `lib/earnings.ts`: blended net payout per stream $0.004 (labelled "industry blended average, 2026, estimate"). Output: estimated extra annual net receipts, the artist's 70%, lyrical's 30%, "$0 upfront". Every number carries the word estimate. Pure function, unit tested.
- **EOI form** (`components/ArtistEoiForm.tsx`): name, artist or act, email, role, catalog size, monthly streams band, languages, links, message. Writes to the existing `enquiries` table with `source = 'artist_eoi'` and reuses the enquiry email path, rate limit and Turnstile. Appears in `/leads` like any enquiry. Schema in `lib/eoi-schema.ts`, tested.

## 9. Pipeline (Bot F, repo `lyrical-studio`)

Developed on Henry's desktop copy, deployed to the OptiPlex by scp, then the `LyricalPoller` task restarted and a real omega job run.

- **Watermark + ID3:** `dashboard/service/website/media.py` gains `watermark_and_encode(src_wav, dst_mp3, *, watermark_id: int) -> Path`. AudioSeal (`pip install audioseal`, CPU torch 2.11 is enough) embeds a 16-bit message equal to `watermark_id` (random, stored on `song_job_deliveries.watermark_id`). Audio is resampled to 16 kHz for the generator; the watermark delta is resampled back and added to the full-rate mix so the deliverable stays 44.1 kHz. Then ffmpeg encodes 192k MP3 with ID3 `comment` ("Personal use only. lyrical beta. Job <id>") and `copyright`. `scripts/detect_watermark.py <file>` prints detection probability and the decoded message. **Acceptance:** detection ≥ 0.9 after the MP3 round trip, < 0.1 on an unmarked file. AudioSeal missing raises; nothing silently skips the mark.
- **Re-rolls:** the poller's `next_queued_job` also returns child jobs. For `parent_job_id` set: stems come from `work/website/<parent_job_id>/` (the existing download dir); if missing, `set_pipeline_state('failed', 'stems_expired')` AND set `status='rejected'` (the customer-visible signal), then stop. The child reuses the parent's paid prep stages (separate, align) and re-runs from the write (translate) stage with `seed`, then sing, restore, deliver. Delivery rows and the watermark are per child. Cost target ~$0.50.
- **Retention:** after `mark_delivered` on a `route='auto'` job, `WebsiteClient.delete_assets(job)` deletes every object under `submissions/<user>/<job>/` and stamps `song_job_assets.purged_at`. Failed jobs are left for 7 days for retry, then purged by the same code path. `scripts/purge_local_stems.py --days 30` removes `work/website/<job_id>/` older than 30 days; installed as a daily scheduled task on the OptiPlex.
- **Render-time entitlement:** `WebsiteClient.active_entitlement` still checks the old tiers (`starter/creator/pro`). It is updated to the §4 rules (fan/superfan active, or a positive credit balance, or a child job whose parent was delivered), otherwise every Single-credit job and every re-roll would be refused at the render PC.
- **Heartbeat:** the poller upserts `worker_heartbeat('optiplex', now(), git sha)` every loop.
- **Door-1 lossless export:** `dashboard/service/export_door1.py` writes `work/<song>/door1/vocal.wav`, `instrumental.wav`, `mix.wav` (24-bit, no watermark) from the pipeline's existing stems, and the staff Library's song detail gets an "Export Door-1 stems" button. Door-1 delivery to the artist stays manual.
- **Deploy notes** in the brief: venv `pip install audioseal` on the OptiPlex, scp the changed files, restart `LyricalPoller`, clear the desktop before a SynthV render (memory `synthv-recovery-false-positive`), one poller only.

## 10. Ops (Bot E)

- **Backfill purge:** `scripts/purge_supabase_backfill.py --dry-run` lists `submissions` objects for jobs with `pipeline_state in ('delivered','failed')` older than 30 days. Manual-funnel jobs (`pipeline_state is null`, the live site's real clients) are never candidates. Henry sees the dry-run list and says go before `--apply`. Today this purges almost nothing (the three delivered jobs are from 21 Sep); the tool exists for the steady state.
- **Supabase plan:** check in the Supabase dashboard (Henry's Chrome) whether the project is on Free or Pro. Usage on 22 Sep: 1.72 GB (submissions 1.33 GB, voice-training 0.36 GB, deliveries 18 MB, listen 16 MB) against the 1 GB free limit. Report, do not change billing.
- **Poller as a service:** the `LyricalPoller` scheduled task set to run at logon, restart on failure, with log rotation; a runbook `deploy/render-pc.md` in `lyrical-studio`.
- **Dead code:** remove the Vite customer mode from `lyrical-studio/dashboard/frontend` (`VITE_CUSTOMER_MODE`, `CustomerCreationPage`, `CustomerLibrary`, `CustomerSongDetail`, `api/submit.ts`, `dev-api.ts`, `entitlement/`, `mode.ts`) and their tests. The Next site is the only Door-2 front end; two quota gates is one too many.

## 11. Branches, ownership, order

Every bot: its own branch off `develop` (`feat/v2-<bot>`), PR into `develop`, `npm test && npm run build` green before the PR, no em dashes, no secrets in files. Omega deploys `develop` on merge.

| Bot | Branch | Owns (nobody else edits) |
|---|---|---|
| 0 Prep | `feat/v2-prep` | `supabase/migrations/**`, `supabase/schema.sql`, `lib/plans.ts`, `lib/entitlement.ts`, `tests/entitlement.test.ts`, `docs/v2/copy-deck.md`, `.env.example` |
| A Payments | `feat/v2-payments` | `app/api/stripe/**`, `app/studio/billing/**`, `lib/stripe.ts`, `lib/entitlement-db.ts`, `lib/credits.ts`, `scripts/stripe-setup.ts`, the entitlement block of `app/studio/self-serve-actions.ts`, `tests/stripe-*.test.ts` |
| B Marketing | `feat/v2-marketing` | `app/page.tsx`, `components/sections/**`, `app/pricing/**`, `app/investors/**`, `lib/investor-auth.ts`, `components/Nav.tsx`, `components/Footer.tsx`, `content/**`, `app/robots.ts`, `app/sitemap.ts`, `tests/copy.test.ts` |
| C Studio | `feat/v2-studio` | `app/studio/page.tsx`, `app/studio/new/page.tsx`, `app/studio/sign-in/**`, `app/studio/feedback-actions.ts`, `app/studio/reroll-actions.ts`, `components/FeedbackBar.tsx`, `components/CoverPlayer.tsx`, `components/SongSubmitForm.tsx`, `lib/terms.ts`, `lib/feedback-schema.ts`, `app/queue/FeedbackTab.tsx`, `app/queue/page.tsx`, `app/queue/export/route.ts`, `tests/feedback-*.test.ts` |
| D Artists | `feat/v2-artists` | `app/artists/**` (incl. the no-JS adapter `app/artists/eoi/route.ts`), `components/EarningsCalculator.tsx`, `components/ArtistEoiForm.tsx`, `lib/earnings.ts`, `lib/eoi-schema.ts`, `tests/earnings*.test.ts`, `tests/eoi*.test.ts`, plus one source-gated Turnstile block in `app/api/enquiry/route.ts` (JSON path, `source='artist_eoi'` only; `/contact` untouched) |
| F Pipeline | `lyrical-studio` `feat/v2-pipeline` | `dashboard/service/website/**`, `dashboard/service/export_door1.py`, `scripts/detect_watermark.py`, `scripts/purge_local_stems.py`, `requirements.txt`, the staff Library export button |
| E Ops | `lyrical-studio` `feat/v2-ops` + website docs | `scripts/purge_supabase_backfill.py`, `deploy/render-pc.md`, the Vite customer-mode removal |

Bot B adds `/artists` and `/pricing` to `app/sitemap.ts` and the nav; Bot D never edits those.

Shared-file rule: `app/studio/self-serve-actions.ts` is edited by A (entitlement) and C (licence version stamp, one field). A merges first; C rebases. `Nav.tsx` is B only; C's billing link lives inside the studio page.

Order: Bot 0 alone → A, B, C, D, F in parallel → merge in the order A, C, B, D → F deploys to the OptiPlex → E → the proof run.

**The proof run on omega** (done by whoever merges last, with Henry watching): sign in with a test account → `/pricing` → Fan → Stripe test card → webhook writes the subscription → studio shows 5 tracks left → submit a song with the licence box ticked → OptiPlex renders → MP3 delivered with the watermark and ID3 tag → `detect_watermark.py` finds it → thumbs-down with a note → re-roll → "Take 2" delivered → stems gone from Supabase, present on the OptiPlex.

## 12. Constraints every bot carries

- Never touch `main` of `lyrical-website`, the `lyrical-website` Vercel project, or lyricalglobal.com.
- No em dashes anywhere, code comments included.
- Secrets: never typed into files or pages. Henry adds env values in Vercel; scripts read gitignored files.
- The Supabase service key is the `sb_secret_...` format; `supabase-js` in the website handles it, hand-rolled parsers must strip the quotes in `.env` files.
- Windows Python: prefix `PYTHONUTF8=1 PYTHONIOENCODING=utf-8`.
- One poller only. The OptiPlex is primary; the AWS VM is a cold standby.
- Fail loud. No silent fallbacks (missing AudioSeal, missing stems, unknown plan id all raise or fail the job with a named error).
- Verify before claiming done: `npm test && npm run build` (web), `pytest` (pipeline), and one real job for anything that touches the render path.

## 13. Decision log

- **2026-09-21:** Door 2 = fan toy in beta, three plans (Single $9 / Fan $19 / Superfan $39 founding, grandfathered), no free tier, 2 free re-rolls per track, one-tap feedback, quality capped by format + licence + watermark, $2,000 is an anchor never a tier, self-serve royalty parked.
- **2026-09-22 (this session, Henry):** internal dashboard stays on the render PC (A); `/artists` = calculator + EOI; `/investors` gated; Stripe test mode on omega; stems download to the render PC then clear from Supabase; thumbs-down = mandatory detailed note then a Re-roll button (not automatic); all three small builds now; Coffey files to be supplied by Henry; migrations applied by driving the Supabase SQL editor in Henry's Chrome.
- **Measured 22 Sep:** Supabase 1.72 GB across four private buckets; 22 `song_jobs` (17 manual-funnel `submitted` from the live site, 4 delivered, 1 in progress); 2 test subscriptions on `pro`; OptiPlex C: 136 GB free, `work/` 0.68 GB, `LyricalPoller` task Ready.

- **2026-09-22 (morning review, Henry):** home page keeps the ORIGINAL seven-section flow and hero word for word, plus one two-doors section right before the closing ask; the word "beta" appears only in the licence terms and one founding-price sentence on /pricing; no side-by-side comparison tables anywhere (plan cards get a "good for" line and their own feature list, /artists describes Door 1 on its own terms); plan cards drop the struck standard prices; calculator shows GROSS new-language receipts only (no lyrical share), up to 8 languages, default audience share 80%; the studio adopts the local dashboard's look in full (sidebar tabs, animated wave mark, its tokens); /about gets a "For investors" button under the team.
- **2026-09-22 (overnight proof run):** two pipeline gaps found and fixed: self-serve jobs must carry lyrics (website #7); the website sends language codes and the pipeline wants names (lyrical-studio #3). The site offers Japanese but the pipeline has no Japanese pack: JA jobs fail loud. A job that fails at our end still consumes a track (open item).

- **2026-09-22 (proof run PASSED, ~02:46 AEST):** through the real omega form, a 75 s Callaita clip rendered on the OptiPlex and delivered (watermark probability 1.000, id 2266, ID3 tags, stems purged from Supabase, local stems + manifest kept); thumbs-down + note + Re-roll produced "Take 2" (own watermark id 43254, no asset rows, parent prep reused). Unproven: the Stripe checkout leg (no test keys). Morning revisions merged: #8 artists, #9 marketing, #10 studio shell. Plans renamed Plus / Pro (ids unchanged). Omega env now carries INVESTOR_PASSWORD, ADMIN_PASSWORD and GATE_SECRET (set through Henry's Chrome; the Vercel MCP token cannot write env vars). The /investors gate verified with a server-valid token; a hand-minted token failed only because the desktop clock runs two seconds ahead of Vercel.

- **2026-09-22 (second review, Henry):** nav becomes Home / Get started (/#doors) / Studio, "Pricing" and "For artists" links removed (pages stay, reached from the doors section); the home closing section S10Start goes and the two-doors section becomes the dark closer; Door 2 audience is "musicians", Door 1 is "artists", each door says who it is for; the enquiry CTA ("Tell us about it") lives in the Door 1 half; the 30% figure is removed from every public page (the gated investor page keeps it); "human in the loop" is removed, Door 1 benefits are streaming quality, proprietary voice models, and being involved in the process.

- **2026-09-22 (v3 session start, Henry):** turnaround promise CONFIRMED as one line for every plan,
  "usually within 1 hour" with "up to 3 hours at busy times" (busy cap tightened from the proposed
  24 h); the 24-hour rating-reminder email IS in scope for v3 (product email, opt-out, one product
  email per person per day). v3 build is five parallel bots (Auth+emails, Studio account, Website
  design, Admin CRM, Copyright); briefs under `docs/bots/v3/`.
- **2026-09-22 (fixes after the second review):** failed self-serve jobs are visible and refunded (pipeline #5, website #12); ID3 wording; pricing FAQ no longer says nobody listens; the poller service task is installed on the render PC. Coffey Anderson "Mr Red White and Blue" EN to ES rendered through the dashboard's service layer with the new `vocal_denoise=false` knob (pipeline #4), scorecard overall 0.81.

## 14. Open items Henry owns

1. Stripe test keys + webhook secret + price ids into the omega Vercel env (after Bot A's setup script prints the ids). Also RESEND_API_KEY + ENQUIRY_* so enquiry and EOI emails send from omega (rows save without them).
2. Coffey Anderson original + new-language files: the folder or bucket path.
3. DONE: `INVESTOR_PASSWORD` = lyrical on omega (also ADMIN_PASSWORD, GATE_SECRET).
4. Supabase plan confirmation (Bot E reports what the dashboard says).
5. A "go" on the backfill purge dry-run list, when there is one.
6. DONE 22 Sep: a job that fails at our end now gets `status='rejected'`, `quota_consumed_at=null` and a credit refund when credit-funded (lyrical-studio #5); the studio shows "Not made" with the not-counted line (website #12). ID3 comment reads "lyrical". Poller runs as the installed service task (restart on failure, log rotation; deploy/render-pc.md).
