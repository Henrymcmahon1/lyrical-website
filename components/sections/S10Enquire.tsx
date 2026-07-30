import { EnquiryForm } from '../EnquiryForm'

export default function S10Enquire() {
  return (
    <section id="enquire" className="bg-graphite py-24 text-cream sm:py-28">
      <div className="mx-auto grid max-w-5xl gap-12 px-6 md:grid-cols-2 md:gap-16">
        <div>
          <h2 className="font-brand text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
            One song, or a whole catalogue.
          </h2>
          <p className="mt-6 leading-relaxed text-cream/75">
            Tell us what you have and where you want it to reach. We&rsquo;ll come back with
            what a first release would look like: what it takes, what you&rsquo;d
            receive, and how long it runs.
          </p>

          <p className="mt-10 font-mono text-xs tracking-[0.18em] text-cream/45">
            english &#8776; espa&#241;ol
          </p>
          <p className="mt-3 text-sm text-cream/55">
            Or email us directly: henry.jamcmahon@gmail.com
          </p>
        </div>

        <div>
          <EnquiryForm source="footer" tone="dark" />
        </div>
      </div>
    </section>
  )
}
