'use server'

import { headers } from 'next/headers'
import { mailCustomer } from '@/lib/mailer'
import { clientKey, consume } from '@/lib/rate-limit'
import { signInHtml, signInSubject, signInText } from '@/lib/sign-in-email'
import { SITE_URL } from '@/lib/site'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * Ask for a sign in link.
 *
 * Replaces the browser calling `signInWithOtp` directly. Three problems went with it, all
 * argued in `lib/sign-in-email.ts`: Supabase's template cannot be branded, its mailer is rate
 * limited and meant for testing, and its PKCE link only worked in the browser that requested
 * it.
 *
 * ⚠️ **THE LINK HOST COMES FROM `SITE_URL`, NEVER FROM THE BROWSER.** This is the fix for the
 * failure of 2026-08-11, when a link was requested from a dev server left running on
 * localhost:3000 and the email therefore pointed at localhost. The old code built the redirect
 * from `window.location.origin`, which is correct on production and silently wrong anywhere
 * else. Deciding it on the server makes that class of mistake impossible rather than unlikely,
 * and it also means a preview deployment cannot mint links into production.
 */

/** Three links per ten minutes per IP. A person needs one; a script wants thousands. */
const LINK_ATTEMPTS = 3
const LINK_WINDOW_MS = 10 * 60 * 1000

export type SignInResult = { ok: boolean; error?: string }

/**
 * Where the link lands.
 *
 * `next` is validated to a same-origin path for the usual reason, and it matters more than
 * usual here because this URL arrives BY EMAIL carrying our domain in front of it, which is
 * exactly the shape a phishing link wants.
 */
function safeNext(raw: string | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/studio'
  return raw
}

export async function requestSignInLink(
  email: string,
  next?: string,
): Promise<SignInResult> {
  const address = email.trim().toLowerCase()
  if (!address || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) {
    return { ok: false, error: 'That does not look like an email address.' }
  }

  /**
   * Throttled, and honestly labelled. This limiter is per serverless instance and Vercel may
   * put the next request on a different one, so it is a speed bump rather than a control. It
   * is worth having anyway: sending mail costs money and reputation, and the cheap abuse here
   * is a loop, which tends to hit one warm instance.
   */
  const limit = consume(
    clientKey(await headers(), 'sign-in-link'),
    LINK_ATTEMPTS,
    LINK_WINDOW_MS,
    Date.now(),
  )
  if (!limit.allowed) {
    return { ok: false, error: 'Too many links requested. Wait a few minutes and try again.' }
  }

  const db = supabaseAdmin()

  /**
   * Mint the link, creating the account on first sight.
   *
   * `generateLink` with type `magiclink` only works for somebody who already exists, and the
   * `signup` type wants a password, which is the one thing this product deliberately does not
   * have. So: try the magic link, and if there is no such user, create one and try again.
   *
   * `email_confirm: true` is correct rather than lax. The account is unusable until somebody
   * opens the link that has just been mailed to that address, so opening it IS the proof of
   * ownership. Leaving it false would mean a second confirmation email for the same fact.
   */
  let created = false
  let hashedToken = ''

  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await db.auth.admin.generateLink({
      type: 'magiclink',
      email: address,
    })

    if (!error && data?.properties?.hashed_token) {
      hashedToken = data.properties.hashed_token
      break
    }

    if (attempt === 1) {
      console.error('[sign-in] could not generate a link', error)
      return { ok: false, error: 'We could not send a link just now. Try again in a moment.' }
    }

    const { error: createError } = await db.auth.admin.createUser({
      email: address,
      email_confirm: true,
    })
    if (createError) {
      console.error('[sign-in] could not create the account', createError)
      return { ok: false, error: 'We could not send a link just now. Try again in a moment.' }
    }
    created = true
  }

  /**
   * Our own callback URL, carrying the token hash rather than Supabase's `action_link`.
   *
   * `action_link` points at Supabase's `/verify` endpoint, which 302s onward. Handing the hash
   * to our own route instead means one hop, our own domain in the visible link, and a
   * verification that works in any browser rather than only the one that asked.
   */
  const url = new URL('/auth/callback', SITE_URL)
  url.searchParams.set('token_hash', hashedToken)
  url.searchParams.set('type', 'magiclink')
  url.searchParams.set('next', safeNext(next))
  const link = url.toString()

  const sent = await mailCustomer(
    {
      to: address,
      subject: signInSubject(),
      text: signInText(link, created),
      html: signInHtml(link, created),
    },
    'sign-in-link',
  )

  if (!sent) {
    /**
     * Without a mailer there is no way in at all, so development gets the link on the server
     * console. Gated on NODE_ENV: a production log line containing a working credential is a
     * credential in a log aggregator, which is exactly the reason no email here carries one.
     */
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[sign-in] mail is not configured. Link for ${address}:\n${link}`)
      return { ok: true }
    }
    return { ok: false, error: 'We could not send the email. Try again in a moment.' }
  }

  return { ok: true }
}
