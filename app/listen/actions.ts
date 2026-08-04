'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { DEMO_COOKIE, DEMO_MAX_AGE_MS, checkDemoPassword, signDemoSession } from '@/lib/demo-auth'
import { clientKey, consume } from '@/lib/rate-limit'

/**
 * Scoped to `/listen`, so this cookie is never sent with a request for the marketing site or
 * for /leads. Nothing else on the domain has any use for it.
 */
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/listen',
  secure: process.env.NODE_ENV === 'production',
}

const ATTEMPTS = 5
const WINDOW_MS = 10 * 60 * 1000

export async function unlock(formData: FormData) {
  /**
   * Throttle first, and understand what it is worth.
   *
   * This limiter is per serverless instance. A live test against production of six wrong
   * admin passwords was throttled ZERO times, because Vercel spread the requests across
   * instances and each saw its first attempt. It is a speed bump on one warm instance, not a
   * control. What protects this page is the password strength plus the delay below.
   *
   * That matters more here than on /leads, because this password is deliberately human
   * memorable so it can be read out in a conversation. A memorable password with no working
   * rate limit is the weakest thing on the site, which is exactly why this page holds nothing
   * but audio and why the session is four hours rather than twelve.
   */
  const limit = consume(clientKey(await headers(), 'listen'), ATTEMPTS, WINDOW_MS, Date.now())
  if (!limit.allowed) redirect('/listen?error=rate')

  if (!checkDemoPassword(String(formData.get('password') ?? ''))) {
    // Costs wall-clock time on every attempt regardless of which instance serves it, which
    // is the half of the throttling that actually works here.
    await new Promise((resolve) => setTimeout(resolve, 500))
    redirect('/listen?error=1')
  }

  const jar = await cookies()
  jar.set(DEMO_COOKIE, signDemoSession(Date.now()), {
    ...COOKIE_OPTIONS,
    maxAge: Math.floor(DEMO_MAX_AGE_MS / 1000),
  })
  redirect('/listen')
}

export async function lock() {
  const jar = await cookies()
  jar.set(DEMO_COOKIE, '', { ...COOKIE_OPTIONS, maxAge: 0 })
  redirect('/listen')
}
