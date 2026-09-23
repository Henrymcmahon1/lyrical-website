import type { AdminCheck } from './admin-session'

/**
 * Who may open `/admin`. Pure, env-driven, and every function FAILS CLOSED.
 *
 * Since the Door 1 round (24 Sep 2026) the admin console is gated by a real Supabase identity,
 * signed in with the same 6-digit email code as `/studio`, and then checked against an
 * allowlist held in the environment. The shared `ADMIN_PASSWORD` survives only as a break-glass
 * path that is OFF unless explicitly switched on.
 *
 * Environment (set by Henry on the Vercel project, never in a file):
 *
 * | Variable            | Value                        | Effect                                  |
 * |---------------------|------------------------------|-----------------------------------------|
 * | `ADMIN_EMAILS`      | `info@lyricalglobal.com`     | Comma list of admin emails. Unset = nobody. |
 * | `ADMIN_REQUIRE_MFA` | `on` (later)                 | Demands a TOTP-verified session (AAL2). |
 * | `ADMIN_BREAK_GLASS` | `on` (emergencies only)      | Re-enables the old password form.       |
 * | `ADMIN_PASSWORD`    | a long random string         | The break-glass password. Needs the flag. |
 */

/** The allowlist: trimmed, lower-cased, empties dropped. Unset or empty means nobody. */
export function adminAllowlist(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? ''
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0)
}

/**
 * Exact, case-insensitive match against the allowlist, and only for a CONFIRMED email.
 *
 * The confirmation stamp is required because an unconfirmed address is only a claim: somebody
 * typed it, nobody proved they can read its inbox. Pass the server-verified user's
 * `email_confirmed_at`, never anything the browser sent.
 */
export function isAllowlisted(
  email: string | null | undefined,
  emailConfirmedAt: string | null | undefined,
): boolean {
  if (!email || !emailConfirmedAt) return false
  const address = email.trim().toLowerCase()
  if (!address) return false
  return adminAllowlist().includes(address)
}

export type Aal = 'aal1' | 'aal2'

/**
 * The assurance level an admin session must reach. `aal2` (a TOTP factor verified this session)
 * only when `ADMIN_REQUIRE_MFA=on`; the hook for switching on 2FA later without rework.
 */
export function requiredAal(): Aal {
  return process.env.ADMIN_REQUIRE_MFA === 'on' ? 'aal2' : 'aal1'
}

/**
 * Whether the old shared-password path is live. Needs BOTH `ADMIN_BREAK_GLASS=on` and a
 * non-empty `ADMIN_PASSWORD`. When false the password form is never drawn, the login action
 * refuses, and an old `lyr_admin` cookie is ignored.
 */
export function breakGlassEnabled(): boolean {
  return process.env.ADMIN_BREAK_GLASS === 'on' && Boolean(process.env.ADMIN_PASSWORD)
}

/** The email to stamp on CRM `author`/`owner` fields, or undefined for a break-glass session. */
export function adminEmail(check: AdminCheck): string | undefined {
  return check.ok && check.via === 'identity' ? check.user.email : undefined
}
