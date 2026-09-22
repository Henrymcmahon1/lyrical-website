import { describe, expect, it } from 'vitest'
import {
  planConfirmedHtml,
  planConfirmedSubject,
  planConfirmedText,
  type PlanConfirmedEmailFields,
} from '@/lib/plan-confirmed-email'

/**
 * `plan-confirmed`: fires from the Stripe webhook on `checkout.session.completed`, PAUSED with
 * Stripe (HANDOVER §14.1, spec §14.6 "Stripe: paused"). This builder exists now so
 * `docs/emails/mockups/plan-confirmed.html` can be generated for Henry alongside the other seven;
 * the webhook wiring itself is Bot A's, left as a TODO in `app/api/stripe/webhook/route.ts`.
 */

const FIELDS: PlanConfirmedEmailFields = {
  planName: 'Plus',
  tracksIncluded: 5,
  renewsOn: '22 October 2026',
}

describe('subject', () => {
  it('names the plan', () => {
    expect(planConfirmedSubject(FIELDS)).toBe('lyrical: Plus is confirmed')
  })
})

describe('body', () => {
  it('names the plan and how many tracks it includes', () => {
    const text = planConfirmedText(FIELDS)
    expect(text).toContain('Plus')
    expect(text).toMatch(/5/)
  })

  it('says when it renews', () => {
    expect(planConfirmedText(FIELDS)).toContain('22 October 2026')
  })

  it('says the receipt comes from Stripe, not from us', () => {
    expect(planConfirmedText(FIELDS)).toMatch(/receipt.*Stripe|Stripe.*receipt/i)
  })

  it('has an Open the studio call to action', () => {
    const html = planConfirmedHtml(FIELDS)
    expect(html).toMatch(/Open the studio/i)
    expect(html).toContain('/studio')
  })

  it('never uses an em dash', () => {
    expect(planConfirmedText(FIELDS)).not.toContain('—')
    expect(planConfirmedHtml(FIELDS)).not.toContain('—')
  })
})
