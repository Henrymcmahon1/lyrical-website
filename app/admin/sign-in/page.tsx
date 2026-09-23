import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { SignInForm } from '@/components/SignInForm'
import { requireAdmin } from '@/lib/admin-session'
import { MfaRequired, NotAuthorized } from '../Refused'

/**
 * Admin sign-in. The SAME 6-digit email-code flow as `/studio/sign-in`: the same `SignInForm`
 * component calling the same `requestSignInCode` / `verifySignInCode` server actions in
 * `app/(public)/studio/sign-in/actions.ts`. No OTP logic is forked here. After verify the form
 * sends the browser to `/admin`, where `requireAdmin()` decides.
 *
 * Signing in here creates or reuses an ordinary Supabase user, exactly as the studio does. Being
 * signed in is not being an admin: only a confirmed email on `ADMIN_EMAILS` is. A signed-in
 * customer who is not on the list sees "Not authorized" and keeps their studio session.
 *
 * Google is left off on purpose: one way in for the console, the email code.
 */
export const metadata: Metadata = {
  title: 'Admin sign-in',
  robots: { index: false, follow: false, nocache: true },
}

export const dynamic = 'force-dynamic'

export default async function AdminSignIn() {
  const admin = await requireAdmin()

  if (admin.ok) redirect('/admin')
  if (admin.reason === 'not-allowlisted') return <NotAuthorized />
  if (admin.reason === 'mfa-required') return <MfaRequired />

  return (
    <section className="mx-auto w-full max-w-4xl px-6 py-24">
      <h1 className="font-brand text-4xl tracking-tight">Admin</h1>
      <p className="mt-4 max-w-md text-graphite/70">
        Sign in with your staff email. We send a 6-digit code that works once. This console shows
        other people&rsquo;s contact details, accounts and recordings, so only listed staff
        addresses get in.
      </p>
      <div className="mt-10 max-w-sm">
        <SignInForm next="/admin" google={false} />
      </div>
    </section>
  )
}
