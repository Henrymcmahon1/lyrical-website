# v3 bot briefs (auth, account, design, admin, copyright), 22 Sep 2026

Handover: `docs/HANDOVER-v3-2026-09-22.md`. Spec (architecture, data model, decision log):
`docs/superpowers/specs/2026-09-22-two-doors-v2-design.md`. Emails: `docs/emails/`.

Each brief stands alone. Open a fresh Claude session per bot and paste the "Paste this to start"
block from the top of its file. Every bot works in its OWN git worktree on its OWN branch off
`develop`, opens a PR into `develop`, and never touches `main` of `lyrical-website` or
lyricalglobal.com.

| Order | Bot | File | Branch | Runs |
|---|---|---|---|---|
| 1 | 1 Auth + emails | `BOT-1-auth-emails.md` | `feat/v3-auth-emails` | once the Resend key is on omega (code is buildable now) |
| 2 | 2 Studio account | `BOT-2-studio-account.md` | `feat/v3-studio-account` | parallel from the start |
| 2 | 3 Website design | `BOT-3-website-design.md` | `feat/v3-website-design` | parallel from the start |
| 2 | 4 Admin CRM | `BOT-4-admin-crm.md` | `feat/v3-admin-crm` | parallel from the start |
| 1 | 5 Copyright | `BOT-5-copyright.md` | `feat/v3-copyright` | research now, build once the ACRCloud trial exists |

Bots 2, 3, 4 are independent and run from the start. Bot 1's live sending waits on the Resend key,
but its code (OTP, Google, hooks, mockups, rating reminder) is written and unit-tested now. Bot 5
writes its research doc immediately and builds the upload check once Henry has an ACRCloud trial.

## Migrations (Henry-gated)
Applied by driving the Supabase SQL editor in Henry's signed-in Chrome, one numbered file at a time,
then verified over PostgREST (spec decision 6). Existing files: `001`, `002`, `003`. New:
- `004_email_prefs_and_log.sql` (Bot 1): `profiles.welcomed_at`, `profiles.product_emails`,
  `profiles.rating_reminders`, table `email_log`.
- `005_crm.sql` (Bot 4): `crm_notes`, `crm_tasks`, `crm_issues`.
- `006_copyright.sql` (Bot 5): `song_jobs.copyright_check jsonb`.

Every migration file also appends the same DDL to `supabase/schema.sql` so the file stays runnable.
Schema drift to respect: `route`, `pipeline_state`, `pipeline_error`, `quota_consumed_at` exist in
the live DB but not in develop's `schema.sql`; new files are defensive (`if not exists`) and never
assume those columns are declared.

## What Henry owns (prerequisites)
1. `RESEND_API_KEY`, `ENQUIRY_FROM_EMAIL` (verified domain), `ENQUIRY_TO_EMAIL` on omega Vercel env (Bot 1).
2. Supabase custom SMTP (Resend) + the OTP email template rendering `{{ .Token }}` (Bot 1).
3. A Google OAuth client (id + secret) pasted into Supabase Auth (Bot 1).
4. An ACRCloud trial account; the real per-request price from their console (Bot 5).
5. `INVESTOR_VIDEO_ID` (YouTube unlisted) when the recording exists; the pitch deck PDF path and the
   Coffey before/after files (Bot 3).
6. Apply each migration in the Supabase SQL editor, on his say-so.

## Rules every bot carries
Never `main` of lyrical-website or lyricalglobal.com. No em dashes anywhere (code, comments, copy,
commit messages). No secrets typed into files or pages; Henry sets env in Vercel. `npm test && npm
run build` green before a PR. `song_jobs` has column-level SELECT grants: never `select *` on a
customer path, and any new customer-readable column must be added to the grant. Plan display names
differ from ids (`fan` shows "Plus", `superfan` shows "Pro"). Fail loud, no silent fallbacks.
