import Link from 'next/link'
import { EnquiryForm } from '../EnquiryForm'
import { Reveal } from '../Reveal'
import { CONTACT_EMAIL } from '@/lib/enquiry-email'

/**
 * The enquiry, which since 2026-08-11 lives on `/contact` and nowhere else.
 *
 * It used to close every public route. It was replaced there by `S10Start`, which sends people
 * to the studio, because Henry's decision was that submitting a song is the primary conversion
 * and the enquiry is the secondary path.
 *
 * ⚠️ Do not delete this. A label with five thousand tracks will never upload WAVs one at a
 * time, and the studio is a terrible shape for that conversation. This is the funnel for the
 * buyer who needs to talk before they hand anything over, and the copy below is now written for
 * that person specifically rather than for everybody.
 *
 * ⚠️ `scripts/audit-enquiry.mjs` drives this form and asserts the 503 degradation path. It
 * points at `/contact`. If this section moves again, move the audit with it, or it fails for
 * a reason that has nothing to do with what it is testing.
 */
export default function S10Enquire() {
  return (
    <section id="enquire" className="bg-graphite py-24 text-cream sm:py-28">
      <div className="mx-auto max-w-5xl px-6">
        {/*
          A modest heading, not a second hero.

          `/contact` already opens with an h1 saying what the page is for. This section used to
          carry a 6xl headline of its own, and stacked under that one it read as the same
          sentence said twice in two type sizes. The page states the ask; this states what the
          form is.
        */}
        <div className="text-center">
          <Reveal>
            <h2 className="font-brand text-3xl leading-snug tracking-tight text-balance sm:text-4xl">
              Send us a message.
            </h2>
          </Reveal>

          <Reveal delay={120}>
            <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-cream/60">
              Tell us what you own and where you want it to reach, and we&rsquo;ll come back
              with what a first release would look like: what it takes, what you&rsquo;d
              receive, and how long it runs.
            </p>
          </Reveal>

          <Reveal delay={180}>
            {/*
              The faster path, offered rather than hidden. Somebody with one song in mind should
              not fill in a form and wait for a human when they could have the thing itself.
            */}
            <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-cream/45">
              Just have one song?{' '}
              <Link
                href="/studio"
                className="nudge inline-flex min-h-11 items-center text-cream underline decoration-cream/30 underline-offset-4 transition-colors hover:decoration-cream"
              >
                Send it to us directly
              </Link>{' '}
              and skip this form.
            </p>
          </Reveal>
        </div>

        {/*
          The two buttons that used to sit here are gone.

          One scrolled UP to the listening section, sending somebody who had reached the ask
          back to a section with no audio in it. The other scrolled DOWN to this form, which
          is already on screen by the time you can read the button, so its entire job was
          "look slightly lower". What replaces both is the form itself, which now opens by
          asking what the person actually wants.
        */}
        <div
          id="enquiry-form"
          className="mx-auto mt-12 max-w-xl border-t border-cream/15 pt-12"
        >
          <EnquiryForm source="footer" tone="dark" />
          <p className="mt-8 text-sm leading-relaxed text-cream/55">
            Every version is authorized before it is made. Voice models are built only from
            catalogs we have permission to use.
          </p>
          {/*
            Read from CONTACT_EMAIL rather than written out. This line held a hardcoded
            personal address that survived a rename of every other copy of it, precisely
            because it was a literal and nothing pointed at it.

            A link, not plain text: on a phone an address you cannot tap is a instruction to
            go and type it somewhere else, which is the opposite of "directly".
          */}
          <p className="mt-3 text-sm text-cream/55">
            Or email us directly:{' '}
            {/*
              `min-h-11` is 44px. Making this a link without it produced a 15px tap target on
              every route at phone widths, which the responsive audit caught. A link that is
              hard to hit is worse than the plain text it replaced.
            */}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="nudge inline-flex min-h-11 items-center text-cream underline decoration-cream/30 underline-offset-4 transition-colors hover:decoration-cream"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}
