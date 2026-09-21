import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { PLANS, PLAN_IDS, priceFor } from '@/lib/plans'
import { checkoutHref } from '@/components/sections/PlanCards'
import { pricingLd } from '@/app/pricing/structured-data'
import { FOUNDING_LINE, GOOD_FOR, PLAN_FEATURES } from '@/content/two-doors'
import Pricing from '@/app/pricing/page'

const html = renderToStaticMarkup(<Pricing />)

describe('/pricing', () => {
  it('shows every founding price from priceFor and never the struck standard one', () => {
    for (const id of PLAN_IDS) {
      expect(html).toContain(`$${priceFor(id)}`)
      expect(html).not.toContain(`<s>$${PLANS[id].standardUsd}</s>`)
    }
    expect(html).not.toContain('Standard price')
  })
  it('names the plans Single, Plus and Pro, and never a fan', () => {
    for (const id of PLAN_IDS) expect(html).toContain(`Choose ${PLANS[id].name}`)
    expect(html).toContain('Most popular')
    expect(html).not.toMatch(/\bfans?\b/i)
    expect(html).not.toContain('Superfan')
  })
  it('gives every card a "Good for" line and its own feature list', () => {
    for (const id of PLAN_IDS) expect(html).toContain(GOOD_FOR[id])
    for (const f of PLAN_FEATURES) expect(html.match(new RegExp(f, 'g'))?.length).toBe(PLAN_IDS.length)
    expect(html.match(/2 free re-rolls/g)?.length).toBeGreaterThanOrEqual(3)
  })
  it('keeps the founding sentence once and the struck anchor', () => {
    expect(FOUNDING_LINE).toBe('Founding prices for early sign-ups, kept for life.')
    expect(html.match(/Founding prices for early sign-ups, kept for life\./g)?.length).toBe(1)
    expect(html).toContain('<s>$2,000</s>')
    expect(html).toContain('We never charge that for automated output')
  })
  it('sends every button to sign-in with the billing plan carried through', () => {
    expect(checkoutHref('fan')).toBe('/studio/sign-in?next=%2Fstudio%2Fbilling%3Fplan%3Dfan')
    for (const id of PLAN_IDS) expect(html).toContain(`href="${checkoutHref(id)}"`)
  })
  it('carries the five FAQ questions and no comparison table', () => {
    for (const s of ['What do I upload?', 'What do I get?', 'Can I release it?', 'What is a re-roll?', 'Will the price go up?']) expect(html).toContain(s)
    expect(html).not.toContain('<table')
    expect(html).not.toContain('24-bit WAV stems')
    expect(html).not.toContain('Signed artist')
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
