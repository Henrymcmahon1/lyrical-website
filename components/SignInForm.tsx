'use client'

import { useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase-client'

/**
 * Magic link sign in.
 *
 * No password anywhere, deliberately. There is nothing to leak, nothing to reset, nothing for
 * a customer to reuse from another site, and no password field for a browser to autofill with
 * something that matters. On a product whose whole job is holding other people's unreleased
 * masters, the cheapest security win available is not storing a credential at all.
 *
 * The success state does NOT say whether the address is already registered. Signing in and
 * signing up look identical from here, which is what stops this page being used to find out
 * which labels have accounts.
 */
const field =
  'w-full rounded-card border border-graphite/20 bg-cream px-4 py-3 text-graphite outline-none transition-colors focus:border-indigo'

export function SignInForm({ next }: { next?: string }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState('sending')

    try {
      const redirect = new URL('/auth/callback', window.location.origin)
      if (next) redirect.searchParams.set('next', next)

      const { error } = await supabaseBrowser().auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirect.toString() },
      })

      if (error) {
        setState('error')
        setMessage(
          error.message.toLowerCase().includes('rate')
            ? 'Too many links requested. Wait a minute and try again.'
            : 'We could not send the link. Try again in a moment.',
        )
        return
      }
      setState('sent')
    } catch {
      setState('error')
      setMessage('We could not send the link. Try again in a moment.')
    }
  }

  if (state === 'sent') {
    return (
      <div aria-live="polite">
        <h2 className="font-brand text-2xl leading-snug tracking-tight">Check your email.</h2>
        <p className="mt-3 leading-relaxed text-graphite/75">
          If we can reach that address, a sign in link is on its way. It works once and
          expires within the hour.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
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
        {state === 'sending' ? 'Sending…' : 'Email me a sign in link'}
      </button>

      <p className="text-sm leading-relaxed text-graphite/55">
        No password. We send a link that signs you in and then stops working.
      </p>
    </form>
  )
}
