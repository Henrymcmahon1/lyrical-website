import type { Metadata } from 'next'
import { PlanCards } from '@/components/sections/PlanCards'
import { ANCHOR_WEDGE, FAQ, FOUNDING_LINE, REROLL_LINE } from '@/content/two-doors'
import { ldJson } from '@/lib/structured-data'
import { SITE_URL } from '@/lib/site'
import { faqLd, pricingLd } from './structured-data'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Founding prices for lyrical self-serve: Single, Plus and Pro. Two free re-rolls on every track. Personal use only.',
  alternates: { canonical: '/pricing' },
}

/**
 * Three cards, the anchor line, the questions. The self-serve-against-signed-artist table that
 * sat between the cards and the FAQ was removed on 2026-09-22 on Henry's instruction: no
 * side-by-side comparison on this page. The table itself still serves /investors.
 */
export default function Pricing() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(pricingLd(SITE_URL), faqLd()) }} />
      <section className="mx-auto max-w-5xl px-6 py-20 sm:py-28">
        <span className="font-mono text-xs tracking-[0.18em] text-graphite/45">Pricing</span>
        <h1 className="mt-5 font-brand text-4xl leading-[1.08] tracking-tight text-balance sm:text-5xl">{FOUNDING_LINE}</h1>
        <p className="mt-6 max-w-xl leading-relaxed text-graphite/75">{REROLL_LINE}</p>
        <div className="mt-14"><PlanCards /></div>
        {/* The deck's anchor line with its figure struck; the figure is typed once, here. */}
        <p className="mt-10 max-w-xl text-sm leading-relaxed text-graphite/60">A human singer costs <s>$2,000</s> a language. {ANCHOR_WEDGE}</p>
      </section>
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="font-brand text-3xl tracking-tight">Questions</h2>
        <dl className="mt-8 flex flex-col gap-8">
          {FAQ.map((f) => (
            <div key={f.q}>
              <dt className="font-brand text-xl tracking-tight">{f.q}</dt>
              <dd className="mt-2 leading-relaxed text-graphite/75">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  )
}
