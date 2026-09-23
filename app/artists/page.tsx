import type { Metadata } from 'next'
import Link from 'next/link'
import { ArtistEoiForm } from '@/components/ArtistEoiForm'
import { EarningsCalculator } from '@/components/EarningsCalculator'
import { Reveal } from '@/components/Reveal'
import S02Coffey from '@/components/sections/S02Coffey'
import { WORKED_EXAMPLE } from '@/lib/earnings'
import { SITE_URL } from '@/lib/site'
import { ldJson } from '@/lib/structured-data'
import { turnstileSiteKey } from '@/lib/turnstile'

/**
 * Door 1: the artist pitch, the earnings estimate and the expression of interest.
 *
 * Every artist-facing string here is from docs/v2/copy-deck.md, verbatim. The calculator's
 * worked example renders on the server, so a visitor with JavaScript disabled still sees a
 * real, labelled estimate, and the EOI form posts natively to /artists/eoi, which sends the
 * visitor back here with `?eoi=sent` or `?eoi=error` for the form to render.
 *
 * `S02Coffey` slot, added here 2026-09-23: proof beats a form. It renders directly under the
 * hero, before "What you receive", so a visitor hears Coffey Anderson's before/after near the
 * top of the page rather than only reading claims. Same graceful contract as everywhere else it
 * is used: it needs both `COFFEY_ORIGINAL_PATH` and `COFFEY_COVER_PATH` set and resolves to
 * `null` otherwise, so with no env this section renders nothing (never fake audio) and the page
 * is exactly what it was before. Because it can be `null`, this page must stay async, same as
 * the home page.
 *
 * It is deliberately placed AFTER the hero's own "Register your interest" call to action, never
 * before it: the hero keeps its position and its CTA stays the first thing on the page, so nothing
 * this adds pushes it down.
 */

const TITLE = 'For artists: your songs in every language, in your voice'
const DESCRIPTION =
  'Door 1 at lyrical. Your songs, released in new languages with us, in your own voice. No upfront cost, ' +
  'streaming quality, proprietary voice models built for you, and you keep control of what is released.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/artists' },
  robots: { index: true, follow: true },
  openGraph: { title: `${TITLE} | lyrical`, description: DESCRIPTION, url: '/artists', type: 'website' },
}

/** JSON-LD scoped to what the page visibly says, the lib/structured-data.ts rule: no offers, no ratings. */
function artistsPageLd(origin: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${origin}/artists#webpage`,
    url: `${origin}/artists`,
    name: TITLE,
    description: DESCRIPTION,
    isPartOf: { '@id': `${origin}/#website` },
    about: { '@id': `${origin}/#organization` },
    inLanguage: 'en',
  }
}

/**
 * The three Door 1 benefits, in the copy deck's order and wording. Since Henry's second review
 * on 2026-09-22 there is no human-review claim here and no royalty figure anywhere on the
 * page: the 30% lives on the gated investor page only.
 */
const RECEIVES = [
  {
    h: 'Streaming quality',
    p: '24-bit WAV stems, no watermark, with a commercial license, ready for your distributor.',
  },
  {
    h: 'Proprietary voice models built for you',
    p: 'Built from your stems, singing only the songs and languages you have authorized.',
  },
  {
    h: 'You can be as involved in the process as you like',
    p: 'Hear every version first and send it back, or leave the production to us and approve the release. Your call, song by song.',
  },
]

const eyebrow = 'font-mono text-xs tracking-[0.18em] text-graphite/45'
const h2 = 'mt-5 font-brand text-3xl leading-snug tracking-tight text-balance sm:text-4xl'

export default async function ArtistsPage({
  searchParams,
}: {
  searchParams: Promise<{ eoi?: string }>
}) {
  const { eoi } = await searchParams
  const initialState = eoi === 'sent' ? 'sent' : eoi === 'error' ? 'error' : undefined
  const coffey = await S02Coffey()

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldJson(artistsPageLd(SITE_URL)) }}
      />

      <section className="mx-auto max-w-3xl px-6 pt-20 sm:pt-28">
        <span className={eyebrow}>For artists</span>
        <h1 className="mt-5 font-brand text-5xl leading-tight tracking-tight text-balance sm:text-6xl">
          Your songs, in every language, in your voice.
        </h1>
        <p className="mt-8 text-lg leading-relaxed text-graphite/75">
          Your songs, released in new languages with us, in your own voice. No upfront cost. You
          keep control of what is released.
        </p>
        <p className="mt-4 text-lg leading-relaxed text-graphite/75">
          Our first signed artist is Coffey Anderson.
        </p>
        <p className="mt-6 text-sm leading-relaxed text-graphite/55">
          What lyrical touches: the vocal, re-sung in your voice in the new language. What lyrical
          never touches: your instrumental, your melody, your release decisions. Every version is
          authorized before it is made.
        </p>
        <Link
          href="#eoi"
          className="nudge mt-8 inline-flex min-h-11 items-center gap-1.5 rounded-card bg-ember px-7 text-cream"
        >
          Register your interest <span className="shift-arrow">&rarr;</span>
        </Link>
      </section>

      {/*
        The hero-style proof moment: only renders once Henry supplies both Coffey paths. It sits
        in its own section, aria-labelled since `S02Coffey` itself carries none (it is written as
        a slot for embedding, not a standalone section), between the hero and "What you receive"
        so proof lands before the pitch is elaborated on.
      */}
      {coffey && (
        <section aria-label="Coffey Anderson, before and after" className="mx-auto max-w-4xl px-6 pt-4 sm:pt-6">
          {coffey}
        </section>
      )}

      <section className="mx-auto max-w-3xl px-6 py-20">
        <span className={eyebrow}>Door 1</span>
        <h2 className={h2}>What you receive.</h2>
        <p className="mt-6 leading-relaxed text-graphite/75">
          Door 1 is for artists with a catalog and a career. Your finished song is re-sung in your
          own voice in a new language, over your untouched instrumental, and delivered as a new
          master you can release.
        </p>
        <Reveal delay={80}>
          <ul className="mt-8 grid gap-6 sm:grid-cols-3">
            {RECEIVES.map((r) => (
              <li key={r.h} className="rounded-card border border-graphite/15 p-6">
                <h3 className="font-brand text-xl">{r.h}</h3>
                <p className="mt-2 text-sm leading-relaxed text-graphite/75">{r.p}</p>
              </li>
            ))}
          </ul>
        </Reveal>
        <p className="mt-8 leading-relaxed text-graphite/75">
          The precedent is Coffey Anderson, our first signed artist, on these same terms. Send
          your stems, hear it before anyone else does, and release it when you are ready.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20" aria-labelledby="calc">
        <span className={eyebrow}>Calculator</span>
        <h2 id="calc" className={h2}>
          What could a new language earn you?
        </h2>
        <p className="mt-4 max-w-2xl leading-relaxed text-graphite/75">
          The worked example below is 8,000 monthly streams per song, 12 songs, two languages and
          an 80% new-language audience. Change the inputs to your own. Every result is an
          estimate.
        </p>
        <Reveal delay={80}>
          <div className="mt-10">
            <EarningsCalculator initial={WORKED_EXAMPLE} />
          </div>
        </Reveal>
      </section>

      <section id="eoi" className="mx-auto max-w-xl px-6 py-20 sm:py-28">
        <span className={eyebrow}>Door 1</span>
        <h2 className={h2}>Register your interest</h2>
        <p className="mt-6 leading-relaxed text-graphite/75">
          Tell us who you are and where your songs are. A person reads every one of these and
          replies within one working day.
        </p>
        <div className="mt-10">
          <ArtistEoiForm siteKey={turnstileSiteKey()} initialState={initialState} />
        </div>
      </section>
    </>
  )
}
