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

      <p className="mt-8 max-w-xl text-lg leading-relaxed text-graphite/75">
        We recreate a finished record in another language so it sounds like the artist
        genuinely recorded it that way. The melody, the rhythm and the feel are kept
        intact, sung in the artist&rsquo;s own voice, over the untouched original backing.
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <a
          href="#hear"
          className="nudge rounded-card bg-ember px-7 py-4 text-cream"
        >
          Hear a before and after <span className="shift-arrow">&rarr;</span>
        </a>
        <a
          href="#enquire"
          className="nudge rounded-card border border-graphite/30 px-7 py-4 transition-colors hover:border-indigo hover:text-indigo"
        >
          Start a conversation
        </a>
      </div>

      {/* Self managing: the hero has no step state, so the cue retires on the first scroll. */}
      <ScrollCue />
    </section>
  )
}
