import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PLANS } from '@/lib/plans'

/**
 * `components/studio/PlanCard.tsx`: the prominent "how many songs do I have left" card, moved
 * onto /studio/new (Create) from the studio home. Pure presentational: it takes an already-
 * fetched Entitlement (lib/entitlement.ts) and draws it, so it needs no mocks of its own.
 */
const { PlanCard } = await import('@/components/studio/PlanCard')

describe('PlanCard', () => {
  it('shows a big, obvious tracks-left number, the plan name and the renewal date, linking to billing', () => {
    const html = renderToStaticMarkup(
      <PlanCard entitlement={{ ok: true, source: 'subscription', plan: 'fan', tracksLeft: 3, renewsAt: '2026-10-01T00:00:00Z' }} />,
    )
    expect(html).toContain('3 tracks left')
    expect(html).toContain(PLANS.fan.name)
    expect(html).toContain('Oct 1')
    expect(html).toContain('href="/studio/billing"')
  })

  it('singularises "1 track left"', () => {
    const html = renderToStaticMarkup(
      <PlanCard entitlement={{ ok: true, source: 'credit', plan: 'single', tracksLeft: 1, renewsAt: null }} />,
    )
    expect(html).toContain('1 track left')
    expect(html).not.toContain('1 tracks left')
  })

  it('shows "No tracks left" with a link to pricing when the period is exhausted', () => {
    const html = renderToStaticMarkup(<PlanCard entitlement={{ ok: false, reason: 'period_exhausted' }} />)
    expect(html).toContain('No tracks left')
    expect(html).toContain('href="/pricing"')
  })

  it('shows the no-plan empty state with a link to pricing', () => {
    const html = renderToStaticMarkup(<PlanCard entitlement={{ ok: false, reason: 'no_plan' }} />)
    expect(html).toContain('No tracks left')
    expect(html).toContain('href="/pricing"')
    expect(html).not.toContain('href="/studio/billing"')
  })
})
