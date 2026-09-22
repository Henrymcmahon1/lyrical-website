import { renderEmailHtml, renderEmailText, type EmailDoc } from './email-shell'
import { SITE_URL } from './site'

/**
 * `plan-confirmed`: fires from the Stripe webhook (`checkout.session.completed`), PAUSED along
 * with the rest of Stripe (`docs/HANDOVER-v3-2026-09-22.md` §14.1, spec §14 J). Bot A owns
 * `app/api/stripe/webhook/route.ts` and its TODO for wiring this in once Henry supplies test
 * keys; this file exists now purely so `docs/emails/mockups/plan-confirmed.html` can be built
 * alongside the other seven emails in `docs/emails/README.md`.
 *
 * Says the plan name, how many tracks it includes, and when it renews. The receipt itself is
 * Stripe's, not ours, so this says so rather than duplicating numbers Stripe already sent.
 */

export type PlanConfirmedEmailFields = {
  planName: string
  tracksIncluded: number
  renewsOn: string
}

function planConfirmedDoc(d: PlanConfirmedEmailFields): EmailDoc {
  return {
    preheader: `${d.planName} is active: ${d.tracksIncluded} tracks a month, renews ${d.renewsOn}.`,
    eyebrow: 'Plan confirmed',
    heading: `${d.planName} is active.`,
    blocks: [
      {
        type: 'rows',
        rows: [
          ['Plan', d.planName],
          ['Tracks included', `${d.tracksIncluded} a month`],
          ['Renews on', d.renewsOn],
        ],
      },
      {
        type: 'paragraph',
        text: 'Your receipt is on its way separately from Stripe, our payment processor.',
      },
      { type: 'cta', label: 'Open the studio', href: `${SITE_URL}/studio` },
    ],
  }
}

export function planConfirmedSubject(d: PlanConfirmedEmailFields): string {
  return `lyrical: ${d.planName} is confirmed`
}

export function planConfirmedText(d: PlanConfirmedEmailFields): string {
  return renderEmailText(planConfirmedDoc(d))
}

export function planConfirmedHtml(d: PlanConfirmedEmailFields): string {
  return renderEmailHtml(planConfirmedDoc(d))
}
