# Bot A: admin auth upgrade (allowlisted Supabase identity)

**Paste this to start:** "You are Bot A. Read `docs/bots/door1/README.md` then this brief
(`docs/bots/door1/BOT-A-admin-auth.md`) in `C:\Users\User\CascadeProjects\lyrical-website`. Work in a
new worktree `C:\Users\User\CascadeProjects\wt\door1-admin-auth` on branch `feat/door1-admin-auth` off
`develop`. TDD. Commit on your branch only; do NOT push any branch (a push triggers a preview build on the live lyrical-website Vercel project). The orchestrator reviews the branch diff as the PR. Do not merge or deploy."

## Goal
Replace the shared `ADMIN_PASSWORD` cookie gate on `/admin` with a real Supabase identity restricted
to an email allowlist. This gates the existing CRM and the Door 1 console Bot B builds next.

## Today
- `lib/admin-auth.ts` (HMAC cookie, `checkAdminPassword`) and `lib/admin-session.ts`
  (`hasAdminSession()`), used by `app/admin/page.tsx`, `app/admin/*actions.ts`,
  `app/admin/audio/route.ts`, `app/admin/export/route.ts`.
- Customers already sign in with Supabase (6-digit email code + Google): see `lib/supabase-server.ts`
  (`supabaseServer()`, `currentUser()`), `lib/otp-email.ts`, and the `/studio` sign-in flow.

## Build
1. `lib/admin-identity.ts` (pure, unit-tested):
   - `adminAllowlist()`: reads `ADMIN_EMAILS` (comma list, trimmed, lower-cased). FAILS CLOSED: unset
     or empty means nobody. Document `henry@lyricalglobal.com` as the value Henry sets.
   - `isAllowlisted(email)`: exact, case-insensitive match; requires a confirmed email.
   - `requiredAal()`: `'aal2'` when `ADMIN_REQUIRE_MFA=on`, else `'aal1'`. The TOTP hook for later.
2. `lib/admin-session.ts`: replace `hasAdminSession()` with `requireAdmin()` returning
   `{ ok: true, user: { id, email }, via: 'identity' | 'break-glass' } | { ok: false, reason }`.
   - Identity path: `currentUser()` (server-verified `getUser()`, never `getSession()`), allowlisted,
     and when `requiredAal()` is aal2, check `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`.
   - Break-glass path: the OLD cookie is accepted ONLY when `ADMIN_BREAK_GLASS=on` AND
     `ADMIN_PASSWORD` is set. Otherwise the password form does not render and the cookie is ignored.
     Log a `console.warn` on every break-glass use.
   - Keep a thin `hasAdminSession()` wrapper only if it keeps call sites simple; every call site must
     go through the same function.
3. `/admin/sign-in`: an admin sign-in page using the SAME email-code flow as `/studio` (reuse the
   existing action, do not fork OTP logic). After verify, redirect to `/admin`. A signed-in but
   non-allowlisted user sees a plain "Not authorised" page, never CRM data, and is NOT signed out of
   their customer session. Admin pages keep the admin look, not the studio shell.
4. Gate EVERY admin surface server-side with `requireAdmin()`: `app/admin/page.tsx`, every server
   action in `app/admin/*actions.ts` (check first line, before any read or write), both route
   handlers. Add a test per surface that an unauthenticated / non-allowlisted request is refused.
5. CRM `author`/`owner` free-text fields: default them to the admin's email where they are written.
6. Break-glass sign-in form stays at `/admin` only when enabled; otherwise `/admin` redirects to
   `/admin/sign-in`.

## Watch-outs
- info@ signing in creates a normal Supabase user and profile (the `handle_new_user` trigger and
  welcome email may fire). Acceptable; note it in the PR. Do not special-case the trigger.
- `/studio` customer auth must be byte-for-byte unchanged in behaviour. Run its tests.
- Never trust a client-sent email or role; only `getUser()` on the server.
- The old namespaced-HMAC test (a gate token is not an admin session) must still pass for break-glass.

## Done when
- Tests: allowlist parsing (unset, empty, mixed case, spaces), aal gate on/off, break-glass off by
  default, every admin surface refuses non-admins.
- `npm test && npm run build` green. PR into `develop` lists the env Henry sets on omega:
  `ADMIN_EMAILS=henry@lyricalglobal.com`, optional `ADMIN_BREAK_GLASS=on`, later `ADMIN_REQUIRE_MFA=on`.
