import type { AdminCheck } from '@/lib/admin-session'

/**
 * Canned `requireAdmin()` results for the admin surface tests. Not a test file itself (no
 * `.test.` in the name), so vitest does not collect it.
 */
export const ADMIN_OK: AdminCheck = {
  ok: true,
  via: 'identity',
  user: { id: '00000000-0000-4000-8000-00000000000a', email: 'info@lyricalglobal.com' },
}

export const BREAK_GLASS_OK: AdminCheck = { ok: true, via: 'break-glass', user: null }

/** Nobody signed in. */
export const NO_SESSION: AdminCheck = { ok: false, reason: 'no-session' }

/** A signed-in CUSTOMER whose email is not on ADMIN_EMAILS. */
export const NOT_ALLOWLISTED: AdminCheck = { ok: false, reason: 'not-allowlisted' }

/** Allowlisted, but ADMIN_REQUIRE_MFA=on and the session is only aal1. */
export const MFA_REQUIRED: AdminCheck = { ok: false, reason: 'mfa-required' }

/** Every way a request can be refused. Each admin surface is tested against all of them. */
export const REFUSALS: Array<[string, AdminCheck]> = [
  ['nobody signed in', NO_SESSION],
  ['a signed-in customer not on the allowlist', NOT_ALLOWLISTED],
  ['an allowlisted user short of the required AAL', MFA_REQUIRED],
]
