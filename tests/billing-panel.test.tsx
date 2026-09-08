import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { BillingPanel } from '@/components/BillingPanel'
import type { QuotaStatus } from '@/lib/quota'

vi.mock('@/app/pricing/subscribe-actions', () => ({
  openBillingPortal: vi.fn(),
}))

const q = (over: Partial<QuotaStatus>): QuotaStatus => ({
  entitled: false,
  active: false,
  tier: null,
  allowance: 0,
  used: 0,
  remaining: 0,
  periodEnd: null,
  hasCustomer: false,
  ...over,
})

const html = (quota: QuotaStatus) => renderToStaticMarkup(<BillingPanel quota={quota} />)

describe('BillingPanel', () => {
  it('shows remaining covers for an active plan', () => {
    const out = html(q({ entitled: true, active: true, tier: 'starter', allowance: 3, used: 1, remaining: 2 }))
    expect(out).toContain('2 of 3')
    expect(out).toContain('Manage plan')
  })

  it('prompts to choose a plan when inactive, linking pricing', () => {
    const out = html(q({}))
    expect(out).toContain('href="/pricing"')
    expect(out).toContain('Choose a plan')
  })

  it('has no em dash in its copy', () => {
    const out = html(q({ active: true, tier: 'pro', allowance: 40, remaining: 40 }))
    expect(out).not.toContain('—')
  })
})
