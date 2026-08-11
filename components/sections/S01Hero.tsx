import Link from 'next/link'
import { MarkUnlock } from '../MarkUnlock'
import { Parallax } from '../Parallax'
import { ScrollCue } from '../ScrollCue'

export default function S01Hero() {
  return (
    // `relative` so the scroll cue has something to position against. The hero is 84vh, so
    // the fold lands inside it and nothing else says the page continues.
    <section className="relative mx-auto flex min-h-[84vh] max-w-6xl flex-col items-center justify-center px-6 py-20 text-center">
      <Parallax speed={0.06}>
        <div className="text-indigo">
          <MarkUnlock size={156} />
        </div>
      </Parallax>

      <h1 className="mt-10 font-brand text-5xl leading-[1.02] tracking-tight text-balance sm:text-6xl lg:text-7xl">
        Every song. Any language.
        <br />
        Same soul.
      </h1>

      {/*
        Product first, technology nowhere.

        This paragraph opened "lyrical is AI music translation for rights holders" for a few
        hours on 2026-08-09 and was changed back the same day: Jordan read it as a technology
        company explaining itself rather than a product for people who own recordings. The
        searchable half of the phrase, "music translation", survives in the page title and on
        `/ai-music-translation`, which is a different job on a different page.
      */}
      <p className="mt-8 max-w-xl text-lg leading-relaxed text-graphite/75">
        Turn the music you already own into music for audiences around the world. We recreate
        a finished record in another language so it sounds like the artist genuinely recorded
        it that way. The melody, the rhythm and the feel are kept intact, sung in the
        artist&rsquo;s own voice, over the untouched original backing.
      </p>

      {/*
        The three terms, stated before the reader has to ask.

        "No risk" was in the draft and is not here on purpose: handing over a master and a
        voice likeness carries risk, and an absolute like that reads to a lawyer as either
        naive or evasive. "Nothing is released without your approval" is the stronger line
        because it is specific, true today, and the thing they actually want to know.
      */}
      <p className="mt-7 max-w-xl text-sm leading-relaxed text-graphite/60">
        No upfront cost. You stay in control. Nothing is released without your approval.
      </p>

      {/*
        The ember button was "Hear a before and after" pointing at `#hear`, a section with
        nothing to play. It was raised three times across three sessions and never actioned,
        because the honest fix was not a copy change: the button promised the one thing the
        site cannot do. Henry settled it on 2026-08-11 by making the studio the primary
        conversion, so the most prominent button on the site now offers the thing that actually
        exists. Put a listening button back the day real audio publishes, and not before.
      */}
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        {/*
          "Make your song multilingual", not "Make a song". Henry's wording, 2026-08-11, and
          the distinction is load bearing rather than fussy: the object of the verb is a song
          the visitor already owns, which is why this cannot be read as offering to generate
          music. "Make a song" would say the opposite of everything else on the page, and
          `tests/copy.test.ts` exists because that reading is the one a rights holder's lawyer
          reaches for first.
        */}
        <Link
          href="/studio"
          className="nudge rounded-card bg-ember px-7 py-4 text-cream"
        >
          Make your song multilingual <span className="shift-arrow">&rarr;</span>
        </Link>
        <Link
          href="/contact"
          className="nudge rounded-card border border-graphite/30 px-7 py-4 transition-colors hover:border-indigo hover:text-indigo"
        >
          Talk to us
        </Link>
      </div>

      {/* Self managing: the hero has no step state, so the cue retires on the first scroll. */}
      <ScrollCue />
    </section>
  )
}
