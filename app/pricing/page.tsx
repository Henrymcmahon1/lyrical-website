import { PricingTiers } from '@/components/PricingTiers'

export const metadata = {
  title: 'Pricing',
  description: 'Subscribe to make your songs multilingual with lyrical.',
}

/**
 * The Door 2 pricing page. Public and indexable: it is a funnel entry. The tier
 * numbers come from lib/pricing.ts (the same source Stripe products are keyed to),
 * so this page and the checkout can never disagree about a price.
 */
export default function Pricing() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-24 sm:py-28">
      <span className="font-mono text-xs tracking-[0.18em] text-graphite/45">Pricing</span>
      <h1 className="mt-5 font-brand text-4xl leading-[1.1] tracking-tight text-balance">
        Pick a plan, send your songs.
      </h1>
      <p className="mt-4 max-w-2xl text-graphite/75">
        Every plan covers a set number of songs a month, re-sung in the language you choose and
        delivered to your studio. Change or cancel any time.
      </p>
      <div className="mt-12">
        <PricingTiers />
      </div>
    </section>
  )
}
