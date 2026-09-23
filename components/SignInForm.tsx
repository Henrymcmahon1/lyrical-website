'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { requestSignInCode, verifySignInCode } from '@/app/(public)/studio/sign-in/actions'
import { Turnstile } from '@/components/Turnstile'
import { SITE_URL } from '@/lib/site'
import { supabaseBrowser } from '@/lib/supabase-client'
import { turnstileSiteKey } from '@/lib/turnstile'

/**
 * Sign in with a 6-digit email code, or Google. No password anywhere, deliberately: see
 * `app/(public)/studio/sign-in/actions.ts` for why a code replaced the old magic link.
 *
 * One page, two steps kept in this component's own state: email, then the code. "Send a fresh
 * code" does not drop back to the first step or lose the typed email, since the person has
 * already proven they can reach that inbox once.
 *
 * The success state does NOT say whether the address is already registered, same as the old
 * link form: signing in and signing up look identical from here.
 */
const field =
  'w-full rounded-card border border-graphite/20 bg-cream px-4 py-3 text-graphite outline-none transition-colors focus:border-indigo'

/** Same-origin, absolute path, never `//host`, which a browser reads as a URL. */
function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/studio'
  return next
}

/**
 * `google` defaults to true, so `/studio/sign-in` is unchanged. `/admin/sign-in` passes false:
 * the admin console is entered by the email code only (Henry's call, 24 Sep 2026).
 */
export function SignInForm({ next, google = true }: { next?: string; google?: boolean }) {
  const router = useRouter()
  const siteKey = turnstileSiteKey()

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [token, setToken] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [state, setState] = useState<'idle' | 'sending' | 'verifying' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function sendCode(): Promise<boolean> {
    // Widget shown but not solved yet: wait rather than send a request the server will reject.
    if (siteKey && !token) {
      setState('error')
      setMessage('Give the check a moment to finish, then try again.')
      return false
    }
    setState('sending')
    try {
      const result = await requestSignInCode(email, token || undefined)
      if (!result.ok) {
        setState('error')
        setMessage(result.error ?? 'We could not send the code. Try again in a moment.')
        return false
      }
      return true
    } catch {
      setState('error')
      setMessage('We could not send the code. Try again in a moment.')
      return false
    }
  }

  async function submitEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (await sendCode()) {
      setState('idle')
      setMessage('')
      setStep('code')
    }
  }

  async function resendCode() {
    if (await sendCode()) {
      setState('idle')
      setMessage('A fresh code is on its way.')
    }
  }

  async function submitCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState('verifying')
    try {
      const result = await verifySignInCode(email, code)
      if (!result.ok) {
        setState('error')
        setMessage(result.error ?? 'That code did not work. Try again.')
        return
      }
      router.push(safeNext(next))
      router.refresh()
    } catch {
      setState('error')
      setMessage('That code did not work. Try again.')
    }
  }

  async function continueWithGoogle() {
    // SITE_URL, not window.location.origin: the same fix the old link's host got, for the same
    // reason. A dev server or preview deployment must not silently mint a production callback.
    const redirectTo = `${SITE_URL}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ''}`
    await supabaseBrowser().auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
  }

  if (step === 'code') {
    return (
      <div>
        <h2 className="font-brand text-2xl leading-snug tracking-tight">Check your email.</h2>
        <p className="mt-3 leading-relaxed text-graphite/75">
          We sent a 6-digit code to {email}. It works once and expires in 10 minutes.
        </p>

        <form onSubmit={submitCode} className="mt-6 flex flex-col gap-4" noValidate>
          <label className="flex flex-col gap-2">
            <span className="text-sm">6-digit code</span>
            <input
              name="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className={`${field} text-center text-2xl tracking-[0.5em]`}
            />
          </label>

          {state === 'error' && (
            <p role="alert" className="text-sm text-graphite/75">
              {message}
            </p>
          )}
          {state !== 'error' && message && (
            <p role="status" className="text-sm text-graphite/55">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={state === 'verifying' || code.length !== 6}
            className="nudge rounded-card bg-ember px-7 py-4 text-cream disabled:opacity-60"
          >
            {state === 'verifying' ? 'Checking…' : 'Sign in'}
          </button>

          <button
            type="button"
            onClick={resendCode}
            disabled={state === 'sending'}
            className="text-sm text-graphite/55 underline underline-offset-2"
          >
            Send a fresh code
          </button>
        </form>
      </div>
    )
  }

  return (
    <form onSubmit={submitEmail} className="flex flex-col gap-4" noValidate>
      <label className="flex flex-col gap-2">
        <span className="text-sm">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={field}
        />
      </label>

      {/* Renders nothing when Turnstile is not configured, so this is inert until the keys land. */}
      <Turnstile
        siteKey={siteKey}
        action="sign-in"
        onVerify={setToken}
        onExpire={() => setToken('')}
      />

      {state === 'error' && (
        <p role="alert" className="text-sm text-graphite/75">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={state === 'sending'}
        className="nudge rounded-card bg-ember px-7 py-4 text-cream disabled:opacity-60"
      >
        {state === 'sending' ? 'Sending…' : 'Email me a code'}
      </button>

      <p className="text-sm leading-relaxed text-graphite/55">
        No password. We send a 6-digit code that works once and then stops working.
      </p>

      {google && (
        <>
          <div className="my-1 flex items-center gap-3 text-xs text-graphite/40">
            <span className="h-px flex-1 bg-graphite/15" />
            or
            <span className="h-px flex-1 bg-graphite/15" />
          </div>

          <button
            type="button"
            onClick={continueWithGoogle}
            className="rounded-card border border-graphite/20 bg-cream px-7 py-4 text-graphite transition-colors hover:border-graphite/40"
          >
            Continue with Google
          </button>
        </>
      )}
    </form>
  )
}
