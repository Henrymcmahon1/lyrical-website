import type { Metadata } from 'next'
import { PlanCards } from '@/components/sections/PlanCards'
import { ANCHOR_WEDGE, FAQ, FOUNDING_LINE, REROLL_LINE } from '@/content/two-doors'
import { ldJson } from '@/lib/structured-data'
import { SITE_URL } from '@/lib/site'
import { REROLLS_PER_TRACK, priceFor } from '@/lib/plans'
import { TURNAROUND_BUSY, TURNAROUND_PROMISE } from '@/lib/turnaround'
import { Reveal } from '@/components/Reveal'
import { faqLd, pricingLd } from './structured-data'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Founding prices for lyrical self-serve: Single, Plus and Pro. Two free re-rolls on every track. Personal use only.',
  alternates: { canonical: '/pricing' },
}

/**
 * The reassurance strip under the cards, since 2026-09-23: the four things true of every plan,
 * said once as a strip rather than left to be pieced together from three repeated lists. Worded
 * differently from `PLAN_FEATURES` on purpose (`tests/pricing.test.tsx` pins that list to
 * exactly one occurrence per card, so this strip cannot reuse the same strings without pushing
 * that count to four).
 */
const INCLUDED = [
  `${REROLLS_PER_TRACK} free re-rolls on every track`,
  'A licence for personal use',
  'Made in your own voice',
  `${TURNAROUND_PROMISE}, ${TURNAROUND_BUSY}`,
]

/**
 * Three cards, the comparison, the reassurance strip, the questions.
 *
 * Enriched on 2026-09-23: the page used to go straight from the cards to a large blank cream
 * expanse before the FAQ, on desktop where the three cards never grow tall enough to fill the
 * width they are given. Two things fill it, both pulled from copy that already existed on the
 * page rather than invented: the anchor line ("a human singer costs $2,000 a language"), which
 * used to be a small footnote under the cards and is now a real two-sided comparison ABOVE
 * them, and a reassurance strip listing what every plan includes, which used to only be visible
 * by reading all three cards. The self-serve-against-signed-artist TABLE that used to sit here
 * stays removed (Henry's 2026-09-22 instruction); the table itself still serves /investors.
 */
export default function Pricing() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(pricingLd(SITE_URL), faqLd()) }} />
      <section className="mx-auto max-w-5xl px-6 py-20 sm:py-28">
        <span className="font-mono text-xs tracking-[0.18em] text-graphite/45">Pricing</span>
        <h1 className="mt-5 font-brand text-4xl leading-[1.08] tracking-tight text-balance sm:text-5xl">{FOUNDING_LINE}</h1>
        <p className="mt-6 max-w-xl leading-relaxed text-graphite/75">{REROLL_LINE}</p>

        {/*
          The anchor, pulled up from a footnote into a real comparison, struck price on the
          left, our starting price on the right. Divs, not a <table>: the ruled-out comparison
          is plan-vs-plan, and this is old-way-vs-lyrical, one row, never tabular data.
        */}
        <Reveal delay={80}>
          <div className="mt-10 overflow-hidden rounded-card border border-graphite/15 sm:grid sm:grid-cols-2">
            <div className="p-8 sm:p-10">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite/45">The old way</span>
              <p className="mt-4 font-brand text-4xl tracking-tight text-graphite/40"><s>$2,000</s></p>
              <p className="mt-2 text-sm leading-relaxed text-graphite/55">a language, booking a singer, a studio and the weeks that takes.</p>
            </div>
            <div className="border-t border-graphite/15 p-8 sm:border-l sm:border-t-0 sm:p-10">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-indigo">With lyrical</span>
              <p className="mt-4 font-brand text-4xl tracking-tight">from ${priceFor('single')}</p>
              <p className="mt-2 text-sm leading-relaxed text-graphite/55">{ANCHOR_WEDGE}</p>
            </div>
          </div>
        </Reveal>

        <div className="mt-14"><PlanCards /></div>

        <Reveal delay={80}>
          <div className="mt-14 rounded-card border border-graphite/15 p-8 sm:p-10">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite/45">Every plan includes</span>
            <ul className="mt-6 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
              {INCLUDED.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed text-graphite/75">
                  <span aria-hidden="true" className="mt-[0.5em] h-1.5 w-1.5 shrink-0 rounded-full bg-indigo" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </section>
      <section className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
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
