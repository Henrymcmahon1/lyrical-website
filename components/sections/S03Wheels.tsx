import Link from 'next/link'
import { DriftingPairs } from '../DriftingPairs'

/**
 * The languages section.
 *
 * ## What was here, and why it is gone
 *
 * Until 2026-08-11 this section ended with a "Send me before and afters" button that opened a
 * form, collected an address, and promised a personal email with examples in it. Henry removed
 * it: samples, when they exist, will live in the studio rather than being posted out one
 * request at a time.
 *
 * The whole machine behind that button went with it, deliberately and in one go: the overlay
 * form, the signed cookie that remembered who had asked, the "Ask to hear this pair" link on
 * the unpublished player, and the "I'd like to hear examples" option on the contact form.
 * Removing only the button would have left the same promise standing in three other places,
 * which is how a site ends up offering something nobody meant to offer.
 *
 * ⚠️ Do not reintroduce a listening CTA until there is audio to listen to. That promise has
 * been made and withdrawn twice on this site now.
 *
 * No longer a client component: with the button gone there is no state and no handler here.
 * `DriftingPairs` is pure presentation and this section renders on the server.
 */
export default function S03Wheels() {
  return (
    <section id="hear" className="bg-dark-ground py-24 text-dark-ink sm:py-28">
      <div className="mx-auto flex max-w-4xl flex-col items-center px-6 text-center">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-dark-ink/50">
          Eight languages
        </span>

        <h2 className="mt-5 font-brand text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
          There are no borders on your catalog.
        </h2>

        <p className="mt-6 max-w-xl leading-relaxed text-dark-ink/70">
          The melody, the phrasing and the backing stay exactly as they are. Only the
          language changes, and it is still the artist singing it.
        </p>

        <div className="mt-14 w-full">
          <DriftingPairs />
        </div>

        {/*
          One ask, and it is the same ask as every other section: the studio. `dark-accent`
          rather than ember, because this is the dark ground, where indigo fails contrast and
          the accent is the sanctioned action colour.
        */}
        <Link
          href="/studio"
          className="nudge mt-14 rounded-card bg-dark-accent px-8 py-4 text-dark-ground"
        >
          Make your song multilingual <span className="shift-arrow">&rarr;</span>
        </Link>
      </div>
    </section>
  )
}
