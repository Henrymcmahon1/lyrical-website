import type { Metadata } from 'next'
import Link from 'next/link'
import { EnquiryForm } from '@/components/EnquiryForm'
import { CONTACT_EMAIL } from '@/lib/enquiry-email'

/**
 * Door 1: the big-artist partnership application.
 *
 * This is the front door for an established artist or rights holder who wants the
 * hand-perfected, no-upfront-cost, revenue-share route rather than the self-serve
 * subscription. It reuses the enquiry pipeline (storage, founder email, the /queue
 * console) with its own source tag `door1-application`, so applications land beside
 * enquiries and Henry triages them. Distinct page, distinct framing: this is a
 * conversation about a catalog, not a checkout.
 */
export const metadata: Metadata = {
  title: 'Artist partnerships',
  description:
    'Work with lyrical on a revenue-share basis: no upfront cost, we hand-perfect every ' +
    'release in your voice. Tell us about your catalog and we will be in touch.',
  alternates: { canonical: '/apply' },
}

export default function Apply() {
  return (
    <section className="mx-auto max-w-xl px-6 py-20 sm:py-28">
      <span className="font-mono text-xs tracking-[0.18em] text-graphite/45">
        Artist partnerships
      </span>

      <h1 className="mt-5 font-brand text-4xl leading-[1.08] tracking-tight text-balance sm:text-5xl">
        Take your catalog worldwide.
      </h1>

      <p className="mt-6 leading-relaxed text-graphite/75">
        For established artists and rights holders. No upfront cost: we recreate your records
        in other languages, in your own voice, and hand-finish every release with you before it
        goes out. We work on a revenue share, so we only do well when you do. Tell us about your
        catalog and what you want it to reach.
      </p>

      <div className="mt-12">
        <EnquiryForm source="door1-application" />
      </div>

      <div className="mt-14 border-t border-graphite/15 pt-8">
        <p className="leading-relaxed text-graphite/75">Just have one song?</p>
        <Link
          href="/studio"
          className="nudge inline-flex min-h-11 items-center gap-1.5 text-indigo underline decoration-indigo/30 underline-offset-4 transition-colors hover:decoration-indigo"
        >
          Send it through the studio instead <span className="shift-arrow">&rarr;</span>
        </Link>

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
