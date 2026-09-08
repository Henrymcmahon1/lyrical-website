import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PricingTiers } from '@/components/PricingTiers'

vi.mock('@/app/pricing/subscribe-actions', () => ({
  startCheckout: vi.fn(),
}))

const html = () => renderToStaticMarkup(<PricingTiers />)

describe('PricingTiers', () => {
  it('renders the three tiers with prices and cover counts', () => {
    const out = html()
    expect(out).toContain('Starter')
    expect(out).toContain('Creator')
    expect(out).toContain('Pro')
    expect(out).toContain('$199')
    expect(out).toContain('3 covers a month')
    expect(out).toContain('40 covers a month')
    expect((out.match(/Subscribe/g) ?? []).length).toBe(3)
  })

  it('uses no em dash and never says AI-generated', () => {
    const out = html()
    expect(out).not.toContain('—')
    expect(out).not.toMatch(/AI-generated/)
  })
})
