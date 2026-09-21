import { PLANS, PLAN_IDS, priceFor } from '@/lib/plans'
import { FAQ } from '@/content/two-doors'

/** Only what the page shows: three offers at the visible price, five visible questions. Same rule as lib/structured-data.ts. */
export function pricingLd(origin: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'lyrical self-serve',
    description: 'Your song, re-sung in another language in the same voice. Personal use only.',
    brand: { '@id': `${origin}/#organization` },
    offers: PLAN_IDS.map((id) => ({ '@type': 'Offer', name: PLANS[id].name, price: priceFor(id), priceCurrency: 'USD', url: `${origin}/pricing` })),
  }
}

export function faqLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }
}
