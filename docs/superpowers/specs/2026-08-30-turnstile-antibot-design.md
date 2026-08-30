# Anti-bot: Cloudflare Turnstile on the studio

**Date:** 2026-08-30 · Approved by Henry. Ships to `main`. Config-gated so it deploys dark and
activates when the keys are set.

## Why

The studio has two bot-exposed entry points:

- **Sign-in** (`requestSignInLink`) is the unauthenticated front door. A loop can fire magic-link
  emails at arbitrary addresses (email-bombing through our Resend, hurting deliverability) and
  auto-create accounts. Today it has only an in-memory rate limit, measured as ineffective on
  Vercel.
- **Submit** (`submitSongJob`) creates a job, keeps uploaded files, and emails both founders.

The enquiry form already uses a honeypot + timing + rate limit. Henry chose a stronger control
for the studio: **Cloudflare Turnstile**, a mostly-invisible challenge.

## Design

**A widget on both studio forms, verified server-side.**

| Piece | Detail |
|---|---|
| Site key | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, public by design (embedded in the widget) |
| Secret key | `TURNSTILE_SECRET_KEY`, server-only, used to verify |
| Client | `components/Turnstile.tsx` renders the widget, hands a token to the form |
| Server | `lib/turnstile.ts` `verifyTurnstile(token)` POSTs to Cloudflare `siteverify` before a link is sent or a job is saved |

**Config-gated (the safety property).** `verifyTurnstile` returns `{ ok: true, skipped: true }`
when `TURNSTILE_SECRET_KEY` is unset, and the client renders no widget when the site key is unset.
So with no keys the forms behave exactly as today, the code ships dark, and it activates the moment
both keys are in Vercel. Same shape as `canEmailStrangers`.

**Placement rationale.** Verification for submit runs in the `submitSongJob` action, after the
browser-direct upload. That does not itself stop the raw storage write, but it does not need to:
uploading requires an authenticated session, and account creation is gated by the sign-in
Turnstile, so a bot cannot obtain a session to upload with in the first place. Submit-side
Turnstile is defense-in-depth on top of that.

**Failure policy (Henry's call): fail-open on infrastructure error.** If `siteverify` is
unreachable or errors, `verifyTurnstile` returns `{ ok: true, skipped: true }` and logs, so a
Cloudflare outage cannot lock real customers out. An explicit bot verdict (`success: false`) or a
missing token when the feature is configured returns `{ ok: false }` and the form is rejected.

**Token freshness on submit.** Turnstile tokens last ~300s. The widget is configured to
auto-refresh so a long upload does not submit a stale token; if one still expires, the server
rejects and the customer retries.

## Files

| File | Change |
|---|---|
| `lib/turnstile.ts` | New. `turnstileSiteKey()`, `verifyTurnstile()`, siteverify call, fail-open |
| `components/Turnstile.tsx` | New. Loads the CF script once, renders the widget, emits a token |
| `components/SignInForm.tsx` | Render widget, pass token to the action |
| `app/studio/sign-in/actions.ts` | Verify token before minting/sending a link |
| `components/SongSubmitForm.tsx` | Render widget, pass token to the action |
| `app/studio/submit-actions.ts` | Verify token before saving the job |
| `next.config.ts` | CSP: allow `https://challenges.cloudflare.com` in script-src, a new frame-src, and connect-src |
| `tests/copy.test.ts` | Add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` to the public-var allowlist, with a comment |
| `tests/turnstile.test.ts` | New. skipped-when-unconfigured, missing token, success, bot verdict, fail-open on error |

Local tests use Cloudflare's official test keys (always-pass / always-block), so they need no real
account.

## Constraints honored

- Turnstile requires JS. Both studio forms are already JS-only (sign-in uses an onSubmit handler,
  submit does browser-direct uploads), so no JS-disabled path regresses. The public enquiry form
  is untouched.
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is public and safe; the allowlist test is widened deliberately,
  not deleted.

## Setup (Henry, when ready)

1. Cloudflare dashboard → Turnstile → add a widget for `lyricalglobal.com` (I can do this in your
   Chrome). Copy the **site key** and **secret key**.
2. Vercel → env vars: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (public, I can set) and
   `TURNSTILE_SECRET_KEY` (secret, Henry pastes). Both environments.
3. Redeploy so `NEXT_PUBLIC_` inlines. Feature is then live.

## Verify

`npm test`, `npx tsc --noEmit`, `npx eslint .`, `npm run build`, `npm audit --omit=dev` (0). After
activation, read the live sign-in page back: the widget renders, and a request with no/invalid
token is rejected.
