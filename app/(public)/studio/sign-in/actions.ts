'use server'

import { headers } from 'next/headers'
import { claimWelcomeOnce } from '@/lib/claim-welcome'
import { clientKey, consume } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { supabaseServer } from '@/lib/supabase-server'
import { verifyTurnstile } from '@/lib/turnstile'

/**
 * Sign in with a 6-digit email code, replacing the magic link this used to send (see git
 * history and the deleted `lib/sign-in-email.ts` for that version).
 *
 * The reasons for building our own delivery in the first place do not apply to the code the same
 * way. A link had to be branded and had to work in whatever browser opened it, which meant
 * minting it ourselves and sending it through `lib/mailer.ts`. A code is typed back in by hand,
 * in the SAME browser that asked for it, so the "wrong browser" problem the old PKCE link had
 * cannot happen, and Supabase is the only thing that ever knows the actual 6 digits: `signInWithOtp`
 * generates and emails it server-side, and there is no admin API that hands the raw code back to
 * us to send ourselves. Branding still matters, so the SUPABASE template is edited instead: see
 * `lib/otp-email.ts` for the copy and the custom-SMTP note.
 *
 * `requestSignInCode` sending with NO `emailRedirectTo` is what tells Supabase to send a code
 * rather than a link (docs: https://supabase.com/docs/guides/auth/auth-email-passwordless).
 */

/** Three codes per ten minutes per IP. A person needs one, maybe two; a script wants thousands. */
const CODE_ATTEMPTS = 3
const CODE_WINDOW_MS = 10 * 60 * 1000

/** A 6-digit code has a million values; eight tries per window makes guessing it impractical
 * without also making a real person who fat-fingers their code feel locked out. */
const VERIFY_ATTEMPTS = 8
const VERIFY_WINDOW_MS = 10 * 60 * 1000

export type SignInResult = { ok: boolean; error?: string }
export type VerifyResult = { ok: boolean; error?: string }

function normalizeEmail(raw: string): string | null {
  const address = raw.trim().toLowerCase()
  if (!address || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) return null
  return address
}

export async function requestSignInCode(email: string, turnstileToken?: string): Promise<SignInResult> {
  const address = normalizeEmail(email)
  if (!address) return { ok: false, error: 'That does not look like an email address.' }

  const requestHeaders = await headers()

  // Best effort and per instance, same honestly-labelled limitation as the old link's limiter.
  const limit = consume(clientKey(requestHeaders, 'sign-in-code'), CODE_ATTEMPTS, CODE_WINDOW_MS, Date.now())
  if (!limit.allowed) {
    return { ok: false, error: 'Too many codes requested. Wait a few minutes and try again.' }
  }

  const challenge = await verifyTurnstile(turnstileToken ?? '', {
    remoteip: requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim(),
  })
  if (!challenge.ok) {
    return { ok: false, error: 'That did not look human. Refresh the page and try again.' }
  }

  // shouldCreateUser: true makes this double as sign up, same as the old generateLink/createUser
  // fallback. No emailRedirectTo: that absence is what makes Supabase send a 6-digit code
  // instead of a confirmation link.
  const { error } = await supabaseAdmin().auth.signInWithOtp({
    email: address,
    options: { shouldCreateUser: true },
  })

  if (error) {
    console.error('[sign-in] could not send a code', error)
    return { ok: false, error: 'We could not send the code just now. Try again in a moment.' }
  }
  return { ok: true }
}

export async function verifySignInCode(email: string, token: string): Promise<VerifyResult> {
  const address = normalizeEmail(email)
  if (!address) return { ok: false, error: 'That does not look like an email address.' }

  const code = token.trim()
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, error: 'Enter the 6-digit code from your email.' }
  }

  const requestHeaders = await headers()
  const limit = consume(clientKey(requestHeaders, 'sign-in-verify'), VERIFY_ATTEMPTS, VERIFY_WINDOW_MS, Date.now())
  if (!limit.allowed) {
    return { ok: false, error: 'Too many attempts. Ask for a fresh code and wait a few minutes.' }
  }

  const supabase = await supabaseServer()
  const { data, error } = await supabase.auth.verifyOtp({ email: address, token: code, type: 'email' })

  if (error) {
    // Most often expired, already used, or mistyped. The raw Supabase message is developer
    // language ("Token has expired or is invalid"); this says the same thing in plain words.
    return { ok: false, error: 'That code is wrong or has expired. Ask for a fresh one.' }
  }

  const user = data.user
  if (user) {
    // Shared with app/auth/callback/route.ts (Google, and any magic link still in flight), so
    // whichever path a person signs in through first is the one and only welcome they get.
    await claimWelcomeOnce(supabase, user.id, user.email ?? null)
  }

  return { ok: true }
}
