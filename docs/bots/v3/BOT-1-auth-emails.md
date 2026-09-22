# Bot 1: sign-in code + Google, the automatic emails, job hooks, rating reminder

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development or
> superpowers:executing-plans. Tests first, task by task. Steps use `- [ ]` for tracking.

**Paste this to start the session:**
> Read `docs/HANDOVER-v3-2026-09-22.md`, `docs/superpowers/specs/2026-09-22-two-doors-v2-design.md`,
> `docs/emails/README.md`, then `docs/bots/v3/BOT-1-auth-emails.md` in your worktree of
> `C:\Users\User\CascadeProjects\lyrical-website`. Work on branch `feat/v3-auth-emails` off
> `develop`. Never touch `main`. Execute the brief task by task, tests first. `npm test && npm run
> build` green before the PR. No em dashes. No secrets in any file.

**Goal:** Turn sign-in into a 6-digit email code plus a "Continue with Google" button, wire the four
job/plan automatic emails, add the 24-hour rating reminder, and put an HTML mock-up per email under
`docs/emails/mockups/`. The welcome email and the enquiry acknowledgement already exist (do not
rebuild them); this bot adds the code sign-in, Google, the delivered / re-roll-delivered /
not-made / rating-reminder emails, and the hook that fires the job emails.

## Current state (verified 22 Sep, do not rediscover)
- Sign-in is at **`app/(public)/studio/sign-in/`** (`page.tsx`, `actions.ts`), NOT `app/studio/sign-in`.
  `actions.ts` `requestSignInLink()` uses admin `generateLink({ type: 'magiclink' })`, builds its own
  `/auth/callback` link with `token_hash`, and sends it via `mailCustomer`.
- Callback is **`app/auth/callback/route.ts`**: `verifyOtp({ token_hash, type: 'magiclink' })`, and on
  first sign-in `claimFirstSignIn` upserts `profiles` and sends the welcome via `mailCustomer(...,'welcome')`.
- `lib/mailer.ts`: `mailCustomer(mail, label)`, `mailFounders(...)`, `founderRecipients()`; reads
  `RESEND_API_KEY`, `ENQUIRY_FROM_EMAIL`; **nothing throws**, every send returns boolean and logs.
- `lib/email-shell.ts`: `type EmailDoc = { preheader; eyebrow?; heading; blocks: EmailBlock[] }`,
  `renderEmailHtml(doc)`, `renderEmailText(doc)`, colour constants. Existing docs:
  `lib/sign-in-email.ts`, `lib/welcome-email.ts`, `lib/enquiry-email.ts` (the enquiry acknowledgement
  `confirmationSubject/Text/Html` already sends).
- `profiles` columns: `id, created_at, name, company, role, stripe_customer_id, licence_terms_version`.
  **No `welcomed_at`, no email-preference column, no `email_log`.** First-sign-in is currently detected
  by the `profiles` insert, not a timestamp.
- No `app/api/hooks/**` exists. `app/api/stripe/webhook/route.ts` exists (plan-confirmed email is its
  job, paused with Stripe: leave a TODO, do not build the Stripe leg).
- `song_jobs` uses column-level SELECT grants. `song_job_deliveries` carries `kind, path, filename`.

## Files this bot owns (nobody else edits)
`app/(public)/studio/sign-in/**`, `app/auth/callback/route.ts`, `lib/otp-email.ts`,
`lib/delivered-email.ts`, `lib/reroll-delivered-email.ts`, `lib/not-made-email.ts`,
`lib/rating-reminder-email.ts`, `lib/email-log.ts`, `app/api/hooks/song-job/route.ts`,
`app/api/hooks/rating-reminder/route.ts`, `supabase/migrations/004_email_prefs_and_log.sql`,
`docs/emails/mockups/**`, all `tests/v3-auth-*.test.ts` and `tests/v3-email-*.test.ts`.
Coordinate on `supabase/schema.sql` (append only) and `.env.example` (add names only).

## Constraints
- No em dashes. No secrets in files. The bot never handles the Resend or Google keys; Henry sets them.
- Product emails (`rating-reminder`) respect `profiles.product_emails`; transactional ones ignore it.
- Never more than one product email per person per day (check `email_log`).
- Fail loud on a real error path, but a missing `RESEND_API_KEY` in dev must not crash a page (mailer
  already returns false); the hooks log and return 200 so Supabase does not retry forever.

## Migration 004 (Henry applies in his Chrome; write the file and append to schema.sql)
```sql
alter table public.profiles add column if not exists welcomed_at timestamptz;
alter table public.profiles add column if not exists product_emails boolean not null default true;
alter table public.profiles add column if not exists rating_reminders boolean not null default true;

create table if not exists public.email_log (
  id         uuid primary key default gen_random_uuid(),
  sent_at    timestamptz not null default now(),
  user_id    uuid references auth.users (id) on delete set null,
  to_email   text not null,
  slug       text not null,          -- welcome | track-delivered | reroll-delivered | track-not-made | rating-reminder | eoi-received | enquiry-received | plan-confirmed
  job_id     uuid references public.song_jobs (id) on delete set null,
  provider_id text
);
create index if not exists email_log_user_idx on public.email_log (user_id, sent_at desc);
create index if not exists email_log_slug_idx on public.email_log (slug, sent_at desc);
alter table public.email_log enable row level security;   -- service role only, no policies
```

---

### Task 1: Branch + migration 004
- [ ] Branch `feat/v3-auth-emails` off `develop` in this worktree. `npm install`.
- [ ] Write `supabase/migrations/004_email_prefs_and_log.sql` (above) and append the same DDL to
      `supabase/schema.sql`. Add `email_log` to any schema-shape test if one exists. This file is
      applied by Henry, not by the bot.

### Task 2: 6-digit code sign-in (replace the magic link)
**Files:** `app/(public)/studio/sign-in/actions.ts`, its `page.tsx` / `SignInForm`, `app/auth/callback/route.ts`, `lib/otp-email.ts`, tests.
- [ ] Failing tests: `requestSignInCode(email)` calls Supabase `signInWithOtp({ email, options: { shouldCreateUser: true } })` (NO `emailRedirectTo`, so Supabase sends the token, not a link) and returns `{ ok }`; `verifySignInCode(email, token)` calls `verifyOtp({ email, token, type: 'email' })`, and on first success stamps `profiles.welcomed_at` + sends welcome once. Keep the same rate limit and Turnstile gate the link path had.
- [ ] Implement. The sign-in page keeps its state machine on one page: email step, then code step (6 numeric inputs / one `inputMode="numeric"` field), a "resend code" affordance, and error copy. Move the first-sign-in welcome from `claimFirstSignIn` to key off `profiles.welcomed_at is null` then stamp it (so the OTP and OAuth paths share one rule). `lib/otp-email.ts` is only needed if Henry cannot set the Supabase template; default path is Supabase sending the OTP via custom SMTP, so this file may just hold the copy Henry pastes into the template. Document that in the file header.
- [ ] The magic-link callback stays working for existing links in flight (keep the `token_hash` branch); add nothing that breaks it.

### Task 3: Continue with Google
**Files:** the sign-in page, `app/auth/callback/route.ts`, tests.
- [ ] Add a "Continue with Google" button that calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: <SITE_URL>/auth/callback } })` on the browser client. The callback already handles the `code` exchange; ensure the welcome-once rule (Task 2) also fires here. Rights and licence versions on `profiles` apply the same to either method (no change needed, just verify the welcome path).
- [ ] Test: the callback stamps `welcomed_at` and sends welcome exactly once across a code sign-in then a later Google sign-in for the same profile.

### Task 4: The three job emails + the hook
**Files:** `lib/delivered-email.ts`, `lib/reroll-delivered-email.ts`, `lib/not-made-email.ts`, `lib/email-log.ts`, `app/api/hooks/song-job/route.ts`, tests.
- [ ] `lib/email-log.ts`: `alreadySent(userId, slug, sinceMs?)` and `logSend(row)` over `email_log` (service role). `productEmailAllowedToday(userId)` (no product email if one was logged in the last 24 h).
- [ ] Three `EmailDoc` builders (subject/text/html) matching `docs/emails/README.md`: `track-delivered`
      (title + language, licence line, "Listen and rate", link `/studio`), `reroll-delivered`
      ("Take N is ready", re-rolls remaining, "Listen"), `track-not-made` (plain apology, it did not
      count, "Make it again"). Include the turnaround promise line in welcome/delivered where the deck
      says. Turnaround copy: **"usually within 1 hour", "up to 3 hours at busy times"** (confirmed).
- [ ] `app/api/hooks/song-job/route.ts`: POST with a shared-secret header (`x-hook-secret` compared to
      `SONG_JOB_HOOK_SECRET` env; if unset, 503, fail loud in prod). Body is the Supabase Database
      Webhook shape (`{ type:'UPDATE', record, old_record }`). Send only on a recognised transition:
      `status` becomes `delivered` (original `reroll_index=0` → delivered; child → reroll-delivered) or
      `rejected` (→ not-made). Idempotent via `email_log` (do not send twice for the same job+slug).
      Look up the owner email from `auth.users` via admin. Log every send. Return 200 even when it
      decides not to send, so Supabase does not retry.
- [ ] Tests: transition matrix (delivered original, delivered child, rejected, no-op transitions),
      idempotency, bad/missing secret, unknown user.
- [ ] In the PR body, give Henry the Supabase Database Webhook config: table `song_jobs`, event
      UPDATE, URL `<omega>/api/hooks/song-job`, header `x-hook-secret: <value he sets in both places>`.

### Task 5: The rating reminder (product email)
**Files:** `lib/rating-reminder-email.ts`, `app/api/hooks/rating-reminder/route.ts`, `vercel.json` (cron), tests.
- [ ] `EmailDoc` builder for `rating-reminder` (gentle nudge, why ratings help, "Rate your track", link `/studio`).
- [ ] Route: a Vercel Cron target (guarded by `CRON_SECRET` per Vercel's cron auth header). It finds
      deliveries 24 to ~48 h old whose `job_feedback` row is absent, whose owner has
      `product_emails` and `rating_reminders` true, and who has had no product email today, then sends
      one per eligible owner (cap one per person per run) and logs it. Add the cron entry to
      `vercel.json` (daily or hourly; propose hourly, Henry can widen). Fail loud on a missing secret.
- [ ] Tests: eligibility (unrated + old enough + opted in + not emailed today), opt-out respected,
      the daily cap, idempotency via `email_log`.

### Task 6: Email mock-ups
**Files:** `docs/emails/mockups/<slug>.html` for every row in `docs/emails/README.md` (welcome,
plan-confirmed, track-delivered, reroll-delivered, track-not-made, eoi-received, enquiry-received,
rating-reminder).
- [ ] A small script or test renders each `EmailDoc` through `renderEmailHtml` to a static file whose
      `<title>` is the subject line, so Henry can open the folder and see every email. Use realistic
      sample data. Do not inline secrets or real customer data.

### PR checklist
- [ ] `npm test && npm run build` green. No em dashes anywhere. No keys in any file.
- [ ] PR body: the migration 004 SQL for Henry, the Supabase Database Webhook settings, the Supabase
      Auth template change (`{{ .Token }}`) + custom SMTP note, the Google OAuth client steps, the two
      hook secrets and the cron entry. List exactly what Henry must set before live verification.
