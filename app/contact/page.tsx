import type { Metadata } from 'next'
import S10Enquire from '@/components/sections/S10Enquire'

/**
 * Where the enquiry form lives, as of 2026-08-11.
 *
 * It used to close the home page and three others. Henry's decision moved the primary
 * conversion to the studio, and this page is what the enquiry became: the second funnel, for
 * the buyer who has a catalog rather than a song and needs a conversation before they hand
 * anything over.
 *
 * A real page rather than an anchor, for two reasons that both cost something when it was an
 * anchor. A link to `/#enquire` from an email or a search result lands somebody at the bottom
 * of a long page with no context for what they are looking at. And there was no URL anybody
 * could give out that meant "contact us", which is the single most linked page on most sites.
 */
export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Talk to lyrical about a catalog. Tell us what you own and where you want it to reach, ' +
    'and we will come back with what a first release would look like.',
  alternates: { canonical: '/contact' },
}

export default function Contact() {
  return (
    <>
      <section className="mx-auto max-w-3xl px-6 pt-20 pb-2 text-center sm:pt-28">
        <span className="font-mono text-xs tracking-[0.18em] text-graphite/45">Contact</span>
        <h1 className="mt-5 font-brand text-5xl leading-[1.05] tracking-tight text-balance sm:text-6xl">
          Tell us what you have.
        </h1>
        <p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-graphite/75">
          A catalog, a question, or a release you are planning. We work with the people who
          own the recordings: artists, managers, labels, publishers and distributors. Whatever
          you own, the question is the same one, and it is worth asking before anything is
          made.
        </p>
      </section>

      <S10Enquire />
    </>
  )
}
