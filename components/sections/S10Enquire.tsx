import { EnquiryForm } from '../EnquiryForm'

/**
 * The ask. Two ways in, because the two audiences convert differently: an artist or
 * manager usually wants to hear it first, a label wants to start a conversation.
 */
export default function S10Enquire() {
  return (
    <section id="enquire" className="bg-graphite py-24 text-cream sm:py-28">
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center">
          <h2 className="font-brand text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
            One song, or a whole catalogue.
          </h2>
          <p className="mx-auto mt-6 max-w-xl leading-relaxed text-cream/75">
            Tell us what you have and where you want it to reach. We&rsquo;ll come back with
            what a first release would look like: what it takes, what you&rsquo;d receive,
            and how long it runs.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a
              href="#hear"
              className="nudge rounded-card border border-cream/35 px-7 py-4 text-cream transition-colors hover:border-cream"
            >
              Hear an example
            </a>
            <a
              href="#enquiry-form"
              className="nudge rounded-card bg-ember px-7 py-4 text-cream"
            >
              Let&rsquo;s get started <span className="shift-arrow">&rarr;</span>
            </a>
          </div>
        </div>

        <div
          id="enquiry-form"
          className="mx-auto mt-16 max-w-xl border-t border-cream/15 pt-12"
        >
          <EnquiryForm source="footer" tone="dark" />
          <p className="mt-8 text-sm text-cream/55">
            Or email us directly: henry.jamcmahon@gmail.com
          </p>
        </div>
      </div>
    </section>
  )
}
