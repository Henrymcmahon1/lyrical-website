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
   * Throttle first. Best effort only, and measured as such.
   *
   * This limiter is per serverless instance, and a live test of six wrong passwords against
   * production was throttled ZERO times: Vercel spread the requests across instances and each
   * one saw its first attempt. So this is a speed bump against a single hot instance, not a
   * control anything should depend on.
   *
   * What actually protects this page is the password itself: 32 random characters from a
   * 58-character alphabet, about 187 bits, which is not brute-forceable at any request rate.
   * The delay below raises the cost further. If per-IP limiting ever needs to be real it has
   * to live somewhere shared, in Redis or in Postgres, rather than in a process that Vercel
   * may replace between two requests.
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
  if (!checkAdminPassword(supplied)) {
    /**
     * Deliberate delay on failure, and only on failure.
     *
     * Unlike the counter above this works regardless of which instance serves the request,
     * because it costs the attacker wall-clock time on every single attempt rather than
     * relying on shared state. Kept modest: a long delay would let an attacker run up the
     * serverless bill, so this is a cost multiplier rather than a wall.
     */
    await new Promise((resolve) => setTimeout(resolve, 500))
    redirect('/leads?error=1')
  }

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
