import Link from 'next/link'
import { Reveal } from '../Reveal'
import { TURNAROUND_HOURS } from '@/lib/language-pairs'

/**
 * The closing ask, and since 2026-08-11 it asks for a song rather than a message.
 *
 * Henry's decision: the primary conversion is signing up and submitting a song. This section
 * replaced `S10Enquire` on every public route, and the enquiry form moved to `/contact`.
 *
 * The reasoning, so a later session does not quietly undo it. A form asks somebody to describe
 * what they want and then wait for a human to reply, which is two delays and a stranger's
 * judgement in between. The studio asks them to hand over one song and get it back sung in
 * another language, which is the thing they actually came to find out. The enquiry still exists
 * because it is the right shape for a label with five thousand tracks, who will never upload
 * WAVs one at a time. Two funnels, two buyers, and this one is the default.
 *
 * ## The 48 hours is stated here, and it is the only speed claim allowed anywhere
 *
 * It counts FROM ACCEPTANCE, never from submission, because a human approves every job. Saying
 * it any other way promises a clock that starts while nobody is looking at it. Henry rejected
 * "instantly" as untrue and that has not changed: this is a specific commitment with a named
 * starting gun, not a vague one.
 */
export default function S10Start() {
  return (
    <section id="start" className="bg-graphite py-24 text-cream sm:py-28">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <Reveal>
          <h2 className="font-brand text-5xl leading-[1.05] tracking-tight text-balance sm:text-6xl">
            Send us one song.
            <br />
            Hear it come back.
          </h2>
        </Reveal>

        <Reveal delay={120}>
          <p className="mx-auto mt-7 max-w-xl leading-relaxed text-cream/70">
            Upload the stems, or the full mix if that is what you have. We confirm we can take
            it on, and from that moment you have it within {TURNAROUND_HOURS} hours, sung in
            the artist&rsquo;s own voice over your untouched original backing.
          </p>
        </Reveal>

        <Reveal delay={200}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/studio"
              className="nudge rounded-card bg-ember px-8 py-4 text-lg text-cream"
            >
              Send a song <span className="shift-arrow">&rarr;</span>
            </Link>
            <Link
              href="/contact"
              className="nudge inline-flex min-h-11 items-center rounded-card border border-cream/30 px-7 py-4 transition-colors hover:border-cream"
            >
              Talk to us first
            </Link>
          </div>
        </Reveal>

        <Reveal delay={280}>
          {/*
            The three terms restated at the point of commitment, in one line rather than three
            headings. `S09cTerms` argues them; by the time somebody reaches the button they need
            reminding, not persuading.
          */}
          <p className="mx-auto mt-9 max-w-lg text-sm leading-relaxed text-cream/55">
            No upfront cost. Nothing is released without your approval, and every version is
            authorized before it is made.
          </p>
        </Reveal>

        <Reveal delay={340}>
          <p className="mt-6 text-sm text-cream/45">
            Have a catalog rather than a song?{' '}
            <Link
              href="/contact"
              className="nudge inline-flex min-h-11 items-center text-cream underline decoration-cream/30 underline-offset-4 transition-colors hover:decoration-cream"
            >
              Tell us about it
            </Link>
          </p>
        </Reveal>
      </div>
    </section>
  )
}
