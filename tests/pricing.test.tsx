import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { PLANS, PLAN_IDS, priceFor } from '@/lib/plans'
import { checkoutHref } from '@/components/sections/PlanCards'
import { pricingLd } from '@/app/pricing/structured-data'
import Pricing from '@/app/pricing/page'

const html = renderToStaticMarkup(<Pricing />)

describe('/pricing', () => {
  it('shows every founding price from priceFor and strikes the standard one', () => {
    for (const id of PLAN_IDS) {
      expect(html).toContain(`$${priceFor(id)}`)
      expect(html).toContain(`<s>$${PLANS[id].standardUsd}</s>`)
    }
  })
  it('badges Fan, promises re-rolls on every card, strikes the anchor', () => {
    expect(html).toContain('Most fans')
    expect(html.match(/2 free re-rolls/g)?.length).toBeGreaterThanOrEqual(3)
    expect(html).toContain('<s>$2,000</s>')
    expect(html).toContain('We never charge that for automated output')
  })
  it('sends every button to sign-in with the billing plan carried through', () => {
    expect(checkoutHref('fan')).toBe('/studio/sign-in?next=%2Fstudio%2Fbilling%3Fplan%3Dfan')
    for (const id of PLAN_IDS) expect(html).toContain(`href="${checkoutHref(id)}"`)
  })
  it('carries the cap table and the five FAQ questions', () => {
    for (const s of ['24-bit WAV stems', 'What do I upload?', 'What do I get?', 'Can I release it?', 'What is a re-roll?', 'What does beta mean?']) expect(html).toContain(s)
  })
  it('never types a plan price in the page or the cards', () => {
    const src = ['app/pricing/page.tsx', 'components/sections/PlanCards.tsx'].map((f) => readFileSync(f, 'utf8')).join('\n')
    for (const id of PLAN_IDS) for (const n of [PLANS[id].foundingUsd, PLANS[id].standardUsd]) expect(src).not.toMatch(new RegExp(`\\$${n}\\b`))
  })
  it('JSON-LD offers match the visible prices', () => {
    const ld = pricingLd('https://example.test') as { offers: { price: number }[] }
    expect(ld.offers.map((o) => o.price)).toEqual(PLAN_IDS.map((id) => priceFor(id)))
  })
})
