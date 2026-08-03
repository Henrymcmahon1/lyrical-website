import { EnquiryForm } from '../EnquiryForm'
import { Reveal } from '../Reveal'
import { CONTACT_EMAIL } from '@/lib/enquiry-email'

/**
 * The ask. Two ways in, because the two audiences convert differently: an artist or
 * manager usually wants to hear it first, a label wants to start a conversation.
 *
 * The headline asks for the smallest possible commitment on purpose. "Send us one song"
 * is a request somebody can say yes to without a meeting, and the scale ambition is
 * demoted to a line underneath rather than being the opening demand.
 */
export default function S10Enquire() {
  return (
    <section id="enquire" className="bg-graphite py-24 text-cream sm:py-28">
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center">
          <Reveal>
            <h2 className="font-brand text-5xl leading-[1.05] tracking-tight text-balance sm:text-6xl">
              Send us one song.
              <br />
              We&rsquo;ll show you.
            </h2>
          </Reveal>

          <Reveal delay={120}>
            <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-cream/60">
              One song, or a whole catalogue. Tell us what you have and where you want it to
              reach, and we&rsquo;ll come back with what a first release would look like:
              what it takes, what you&rsquo;d receive, and how long it runs.
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
            Every version is authorised before it is made. Voice models are built only from
            catalogues we have permission to use.
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
