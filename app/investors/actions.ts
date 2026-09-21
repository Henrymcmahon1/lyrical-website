'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { INVESTOR_COOKIE, INVESTOR_MAX_AGE_MS, checkInvestorPassword, signInvestorSession } from '@/lib/investor-auth'
import { clientKey, consume } from '@/lib/rate-limit'

/** Scoped to /investors so the cookie never rides along to /listen, /leads or the studio. */
const COOKIE_OPTIONS = { httpOnly: true, sameSite: 'lax' as const, path: '/investors', secure: process.env.NODE_ENV === 'production' }

export async function unlock(formData: FormData) {
  const limit = consume(clientKey(await headers(), 'investor'), 5, 10 * 60 * 1000, Date.now())
  if (!limit.allowed) redirect('/investors?error=rate')
  if (!checkInvestorPassword(String(formData.get('password') ?? ''))) {
    await new Promise((resolve) => setTimeout(resolve, 500))
    redirect('/investors?error=1')
  }
  const jar = await cookies()
  jar.set(INVESTOR_COOKIE, signInvestorSession(Date.now()), { ...COOKIE_OPTIONS, maxAge: Math.floor(INVESTOR_MAX_AGE_MS / 1000) })
  redirect('/investors')
}

export async function lock() {
  const jar = await cookies()
  jar.set(INVESTOR_COOKIE, '', { ...COOKIE_OPTIONS, maxAge: 0 })
  redirect('/investors')
}
