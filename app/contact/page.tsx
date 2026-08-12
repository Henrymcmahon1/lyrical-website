import type { Metadata } from 'next'
import Link from 'next/link'
import { EnquiryForm } from '@/components/EnquiryForm'
import { CONTACT_EMAIL } from '@/lib/enquiry-email'

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
 *
 * ## Redesigned 2026-08-12, and the reasoning is worth keeping
 *
 * This page shipped with the form inside `S10Enquire`, a full-bleed graphite band inherited
 * from when the form closed a long marketing page. As a whole page it measured 960px of dark
 * to hold a 326px form: 246px of empty black under the button. Worse, it stepped through three
 * alignments in one column, centred heading to centred subheading to left-aligned form, and it
 * introduced itself twice, once on cream and again on the dark.
 *
 * Now it is cream and left-aligned, which is not a style preference but a category decision.
 * **Every other form in this product is on cream**: sign in, the studio, the upload form. The
 * dark treatment is reserved for listening sections, and a contact form is not one. Left
 * alignment matches `/studio` for the same reason: this is a working page somebody fills in,
 * not a page they read.
 *
 * One heading, one column, one alignment. `S10Enquire` was deleted rather than left unused.
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
    <section className="mx-auto max-w-xl px-6 py-20 sm:py-28">
      <span className="font-mono text-xs tracking-[0.18em] text-graphite/45">Contact</span>

      <h1 className="mt-5 font-brand text-4xl leading-[1.08] tracking-tight text-balance sm:text-5xl">
        Tell us what you have.
      </h1>

      <p className="mt-6 leading-relaxed text-graphite/75">
        A catalog, a question, or a release you are planning. We work with the people who own
        the recordings: artists, managers, labels, publishers and distributors. Tell us what
        you own and where you want it to reach, and we&rsquo;ll come back with what a first
        release would look like.
      </p>

      <div className="mt-12">
        <EnquiryForm source="contact" />
      </div>

      {/*
        The faster path, offered after the form rather than before it. Somebody who arrived
        here with one song in mind should not fill in a form and wait for a human, but putting
        that above the form talks a visitor out of the thing they came to do.
      */}
      <div className="mt-14 border-t border-graphite/15 pt-8">
        {/*
          The link is its OWN line, not a phrase inside a sentence, and that is a tap-target
          decision rather than a stylistic one.

          Inline, it measured 17px tall and the responsive audit failed it: a 44px minimum is
          the rule, and a link that is hard to hit is worse than the plain text it replaced.
          But the obvious fix, `inline-flex min-h-11`, makes the link an unbreakable box in the
          middle of a wrapping paragraph, which is exactly what left "and skip this form"
          orphaned on its own centred line on a phone in the previous design.

          Own line solves both: a real 44px target, and nothing to orphan.
        */}
        <p className="leading-relaxed text-graphite/75">Just have one song?</p>
        <Link
          href="/studio"
          className="nudge inline-flex min-h-11 items-center gap-1.5 text-indigo underline decoration-indigo/30 underline-offset-4 transition-colors hover:decoration-indigo"
        >
          Send it through the studio instead <span className="shift-arrow">&rarr;</span>
        </Link>

        {/*
          Read from CONTACT_EMAIL rather than written out. This line held a hardcoded personal
          address that survived a rename of every other copy of it, precisely because it was a
          literal and nothing pointed at it.
        */}
        <p className="mt-4 text-sm text-graphite/60">
          Or email us directly:{' '}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="nudge inline-flex min-h-11 items-center gap-1.5 text-indigo underline decoration-indigo/30 underline-offset-4 transition-colors hover:decoration-indigo"
          >
            {CONTACT_EMAIL}
          </a>
        </p>

        <p className="mt-6 text-sm leading-relaxed text-graphite/55">
          Every version is authorized before it is made. Voice models are built only from
          catalogs we have permission to use.
        </p>
      </div>
    </section>
  )
}
