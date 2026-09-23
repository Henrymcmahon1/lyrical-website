import { cookies } from 'next/headers'
import { ADMIN_COOKIE, verifyAdminSession } from './admin-auth'
import { breakGlassEnabled, isAllowlisted, requiredAal } from './admin-identity'
import { currentUser, supabaseServer } from './supabase-server'

/**
 * The ONE gate for every admin surface: the page, every server action and both route handlers.
 *
 * Each of those is independently reachable (a server action is a POST endpoint, a route is a
 * GET), so each has to check, and they must not check in subtly different ways. Call this on
 * the first line, before any read or write.
 *
 * ## Identity path (the normal one)
 * `currentUser()` is `getUser()`, which verifies the token with Supabase. Never `getSession()`,
 * which trusts the cookie. The verified email must be confirmed and on `ADMIN_EMAILS`. When
 * `ADMIN_REQUIRE_MFA=on` the session must also be AAL2 (a TOTP factor verified this session).
 *
 * ## Break-glass path
 * The old `ADMIN_PASSWORD` HMAC cookie, honoured ONLY when `breakGlassEnabled()`. Otherwise the
 * cookie is ignored completely, however valid. Every use is logged with `console.warn` so it
 * shows in the Vercel logs. Break-glass has no Supabase identity, so `user` is null: anything
 * that needs an auth uid (a Door 1 job's `user_id`) must refuse a break-glass session.
 */
export type AdminUser = { id: string; email: string }

export type AdminRefusal = 'no-session' | 'not-allowlisted' | 'mfa-required'

export type AdminCheck =
  | { ok: true; via: 'identity'; user: AdminUser }
  | { ok: true; via: 'break-glass'; user: null }
  | { ok: false; reason: AdminRefusal }

async function breakGlassSession(): Promise<boolean> {
  if (!breakGlassEnabled()) return false
  const jar = await cookies()
  // The clock is read here rather than in a component body: `Date.now()` during render is
  // impure, and React's lint rules correctly object to it.
  return verifyAdminSession(jar.get(ADMIN_COOKIE)?.value, Date.now())
}

async function meetsAal(): Promise<boolean> {
  if (requiredAal() === 'aal1') return true
  const supabase = await supabaseServer()
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  // Fail closed: an unreadable level is not a verified second factor.
  if (error || !data) return false
  return data.currentLevel === 'aal2'
}

export async function requireAdmin(): Promise<AdminCheck> {
  const user = await currentUser()

  let refusal: AdminRefusal = 'no-session'
  if (user) {
    if (isAllowlisted(user.email, user.email_confirmed_at)) {
      if (await meetsAal()) {
        return {
          ok: true,
          via: 'identity',
          user: { id: user.id, email: (user.email ?? '').trim().toLowerCase() },
        }
      }
      refusal = 'mfa-required'
    } else {
      refusal = 'not-allowlisted'
    }
  }

  if (await breakGlassSession()) {
    console.warn('[admin] BREAK-GLASS session used: ADMIN_BREAK_GLASS is on')
    return { ok: true, via: 'break-glass', user: null }
  }

  return { ok: false, reason: refusal }
}
