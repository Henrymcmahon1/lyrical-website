/**
 * The token types a sign in link can carry, shared by the code that mints a link
 * (`app/studio/sign-in/actions.ts`) and the code that verifies it (`app/auth/callback/route.ts`).
 *
 * There are two because `generateLink({ type: 'magiclink' })` does not always mint a magic link.
 * For an address Supabase has never seen, it quietly creates the account and returns a SIGNUP
 * token instead (`verification_type: 'signup'`, see `internal/api/mail.go` in supabase/auth).
 * The two live in different places: a signup token only verifies as `signup`, and verifying it as
 * `magiclink` finds nothing and reports "invalid or has expired". Issue #384 was exactly that:
 * every brand new account's first link read as expired.
 *
 * Kept outside the server action file because a `'use server'` module may only export async
 * functions.
 */
export const SIGN_IN_LINK_TYPES = ['magiclink', 'signup'] as const

export type SignInLinkType = (typeof SIGN_IN_LINK_TYPES)[number]

export function isSignInLinkType(raw: unknown): raw is SignInLinkType {
  return typeof raw === 'string' && (SIGN_IN_LINK_TYPES as readonly string[]).includes(raw)
}
