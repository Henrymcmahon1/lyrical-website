import type { Metadata } from 'next'
import Link from 'next/link'
import { ArtistEoiForm } from '@/components/ArtistEoiForm'
import { EarningsCalculator } from '@/components/EarningsCalculator'
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
 */

const TITLE = 'For artists: your songs in every language, in your voice'
const DESCRIPTION =
  'Door 1 at lyrical. 30% of net streaming receipts on the new-language masters, perpetual and exclusive, ' +
  '$0 upfront. Lossless stems, a human in the loop, and nothing released without your approval.'

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

const STEPS = [
  {
    h: 'Send stems',
    p: 'Your finished master, the instrumental and the dry vocal stem. Nothing else is required.',
  },
  {
    h: 'We produce',
    p: 'The song is re-sung in your voice in the new language over your untouched backing. A person listens before anything moves.',
  },
  {
    h: 'You approve',
    p: 'You hear it first. Nothing is released without your sign-off, and you can send it back.',
  },
  {
    h: 'We release',
    p: 'You get 24-bit WAV stems, no watermark, with a commercial license, ready for your distributor.',
  },
  {
    h: 'Royalties flow',
    p: 'The new-language masters earn wherever they are released, and your share comes back to you on the terms above, forever.',
  },
]

const RECEIVES = [
  {
    h: 'Lossless stems',
    p: '24-bit WAV, no watermark, ready for your distributor.',
  },
  {
    h: 'A human on every version',
    p: 'A person listens to every version by ear before it reaches you. Nothing is delivered unheard.',
  },
  {
    h: 'Full commercial release rights',
    p: 'Every new-language master carries a commercial license. Release it wherever you release your music.',
  },
  {
    h: 'Your own trained voice',
    p: 'Built from your stems, singing only the songs and languages you have authorized.',
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
          30% of net streaming receipts on the new-language masters, perpetual and exclusive, $0
          upfront. You get lossless stems and a human in the loop.
        </p>
        <p className="mt-4 text-lg leading-relaxed text-graphite/75">
          Our first signed artist is Coffey Anderson.
        </p>
        <p className="mt-6 text-sm leading-relaxed text-graphite/55">
          What lyrical touches: the vocal, re-sung in your voice in the new language. What lyrical
          never touches: your instrumental, your melody, your release decisions. Every version is
          authorized before it is made and reviewed by ear before it is delivered.
        </p>
        <Link
          href="#eoi"
          className="nudge mt-8 inline-flex min-h-11 items-center gap-1.5 rounded-card bg-ember px-7 text-cream"
        >
          Register your interest <span className="shift-arrow">&rarr;</span>
        </Link>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-20">
        <span className={eyebrow}>Door 1</span>
        <h2 className={h2}>What you receive.</h2>
        <p className="mt-6 leading-relaxed text-graphite/75">
          Door 1 is for artists with a catalog and a career. Your finished song is re-sung in your
          own voice in a new language, over your untouched instrumental, and delivered as a new
          master you can release.
        </p>
        <ul className="mt-8 grid gap-6 sm:grid-cols-2">
          {RECEIVES.map((r) => (
            <li key={r.h} className="rounded-card border border-graphite/15 p-5">
              <h3 className="font-brand text-xl">{r.h}</h3>
              <p className="mt-2 text-sm leading-relaxed text-graphite/75">{r.p}</p>
            </li>
          ))}
        </ul>
        <p className="mt-8 leading-relaxed text-graphite/75">
          The precedent is Coffey Anderson, our first signed artist, on these same terms.
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-20">
        <span className={eyebrow}>How it works</span>
        <h2 className={h2}>Five steps, and you hold the approval at every one.</h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-2">
          {STEPS.map((s, i) => (
            <li key={s.h} className="rounded-card border border-graphite/15 p-5">
              <span className="font-mono text-[11px] tracking-[0.18em] text-graphite/45">
                0{i + 1}
              </span>
              <h3 className="mt-2 font-brand text-xl">{s.h}</h3>
              <p className="mt-2 text-sm leading-relaxed text-graphite/75">{s.p}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20" aria-labelledby="calc">
        <span className={eyebrow}>Calculator</span>
        <h2 id="calc" className={h2}>
          What could a new language earn you?
        </h2>
        <p className="mt-4 max-w-2xl leading-relaxed text-graphite/75">
          The worked example below is 100,000 monthly streams, 12 songs, two languages and an 80%
          new-language audience. Change the inputs to your own. Every result is an estimate.
        </p>
        <div className="mt-10">
          <EarningsCalculator initial={WORKED_EXAMPLE} />
        </div>
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
