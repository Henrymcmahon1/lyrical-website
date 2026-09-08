'use client'

import { useState } from 'react'
import { TIERS, type TierId } from '@/lib/pricing'
import { startCheckout } from '@/app/pricing/subscribe-actions'

/**
 * The three plan cards. Each subscribe button asks the server to open a Stripe
 * Checkout session and then sends the browser there. Errors (signed out, or
 * payments not connected yet) render inline under the card that was clicked.
 */
export function PricingTiers() {
  const [busy, setBusy] = useState<TierId | null>(null)
  const [error, setError] = useState<{ id: TierId; message: string } | null>(null)

  async function subscribe(id: TierId) {
    setBusy(id)
    setError(null)
    const res = await startCheckout(id)
    if (res.ok) {
      window.location.assign(res.url)
      return
    }
    setError({ id, message: res.error })
    setBusy(null)
  }

  return (
    <div className="grid gap-6 sm:grid-cols-3">
      {TIERS.map((t) => (
        <div key={t.id} className="flex flex-col rounded-card border border-graphite/15 p-6">
          <span className="font-brand text-2xl tracking-tight">{t.name}</span>
          <span className="mt-2 font-brand text-4xl">{t.priceDisplay}</span>
          <span className="text-sm text-graphite/55">per month</span>
          <p className="mt-4 text-sm text-graphite/70">{t.blurb}</p>
          <p className="mt-4 text-sm text-graphite/75">{t.covers} covers a month</p>
          <button
            type="button"
            onClick={() => subscribe(t.id)}
            disabled={busy === t.id}
            className="nudge mt-6 inline-flex min-h-11 items-center justify-center rounded-card bg-ember px-6 text-cream disabled:opacity-50"
          >
            Subscribe
          </button>
          {error?.id === t.id && (
            <p role="alert" className="mt-3 text-sm text-ember">
              {error.message}{' '}
              {error.message.includes('Sign in') && (
                <a className="underline" href="/studio/sign-in?next=/pricing">
                  Sign in
                </a>
              )}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
