'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { ADMIN_COOKIE, ADMIN_MAX_AGE_MS, checkAdminPassword, signAdminSession } from '@/lib/admin-auth'
import { hasAdminSession } from '@/lib/admin-session'
import { clientKey, consume } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * Scoped to `/leads`, so the session cookie is never sent with a request for the marketing
 * site. Nothing else on the domain has any use for it.
 */
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/leads',
  secure: process.env.NODE_ENV === 'production',
}

/** Five attempts per ten minutes per IP. Generous for a human, useless for a script. */
const LOGIN_ATTEMPTS = 5
const LOGIN_WINDOW_MS = 10 * 60 * 1000

export async function login(formData: FormData) {
  /**
   * Throttle before checking the password.
   *
   * One shared password with unlimited guesses is the weakest thing on this site: given
   * enough attempts, the strength of the passphrase stops mattering. Rate limiting is what
   * makes it matter again. Counted per IP and per attempt, whether the guess is right or
   * wrong, so a correct guess cannot be used to reset the counter.
   */
  const limit = consume(
    clientKey(await headers(), 'leads-login'),
    LOGIN_ATTEMPTS,
    LOGIN_WINDOW_MS,
    Date.now(),
  )
  if (!limit.allowed) redirect('/leads?error=rate')

  const supplied = String(formData.get('password') ?? '')

  // `checkAdminPassword` fails closed when ADMIN_PASSWORD is unset, so an unconfigured
  // deployment refuses everybody rather than admitting everybody.
  if (!checkAdminPassword(supplied)) redirect('/leads?error=1')

  const jar = await cookies()
  jar.set(ADMIN_COOKIE, signAdminSession(Date.now()), {
    ...COOKIE_OPTIONS,
    maxAge: Math.floor(ADMIN_MAX_AGE_MS / 1000),
  })
  redirect('/leads')
}

export async function logout() {
  const jar = await cookies()
  jar.set(ADMIN_COOKIE, '', { ...COOKIE_OPTIONS, maxAge: 0 })
  redirect('/leads')
}

export async function setHandled(formData: FormData) {
  // Re-checked here, not just in the page. A server action is a POST endpoint like any
  // other, and reaching it does not require having rendered the page first.
  if (!(await hasAdminSession())) redirect('/leads')

  const id = String(formData.get('id') ?? '')
  if (!id) return

  const handled = formData.get('handled') === 'true'
  await supabaseAdmin()
    .from('enquiries')
    .update({ handled, handled_at: handled ? new Date().toISOString() : null })
    .eq('id', id)

  revalidatePath('/leads')
}
