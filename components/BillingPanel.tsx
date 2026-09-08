'use client'

import { useState } from 'react'
import type { QuotaStatus } from '@/lib/quota'
import { openBillingPortal } from '@/app/pricing/subscribe-actions'

/**
 * The billing summary at the top of the studio. Active plans see how many covers
 * remain this period and can open the Stripe Customer Portal to manage or cancel.
 * A signed-in visitor with no active plan is pointed at pricing. The count comes
 * from the server (service role); this component only renders it.
 */
export function BillingPanel({ quota }: { quota: QuotaStatus }) {
  const [busy, setBusy] = useState(false)

  if (!quota.active) {
    return (
      <div className="rounded-card border border-graphite/15 p-5">
        <p className="text-sm text-graphite/70">
          You do not have an active plan. Choose one to start making covers.
        </p>
        <a
          href="/pricing"
          className="nudge mt-3 inline-flex min-h-11 items-center rounded-card bg-ember px-6 text-cream"
        >
          Choose a plan
        </a>
      </div>
    )
  }

  async function manage() {
    setBusy(true)
    const res = await openBillingPortal()
    if (res.ok) window.location.assign(res.url)
    else setBusy(false)
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-graphite/15 p-5">
      <p className="text-sm text-graphite/75">
        <span className="font-brand text-lg">
          {quota.remaining} of {quota.allowance}
        </span>{' '}
        covers left this period.
      </p>
      <button
        type="button"
        onClick={manage}
        disabled={busy}
        className="nudge inline-flex min-h-11 items-center rounded-card border border-graphite/25 px-5 text-sm transition-colors hover:border-indigo hover:text-indigo disabled:opacity-50"
      >
        Manage plan
      </button>
    </div>
  )
}
