import { MarkUnlock } from '../MarkUnlock'

export default function S01Hero() {
  return (
    <section className="mx-auto flex min-h-[84vh] max-w-6xl flex-col items-center justify-center px-6 py-20 text-center">
      <div className="text-indigo">
        <MarkUnlock size={156} />
      </div>

      <h1 className="mt-10 font-brand text-5xl leading-[1.02] tracking-tight text-balance sm:text-6xl lg:text-7xl">
        One song. Any language.
        <br />
        Same soul.
      </h1>

      <p className="mt-8 max-w-xl text-lg leading-relaxed text-graphite/75">
        We recreate a finished record in another language so it sounds like the artist
        genuinely recorded it that way &mdash; the melody, the rhythm and the feel kept
        intact, sung in the artist&rsquo;s own voice, over the untouched original backing.
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <a
          href="#hear"
          className="bg-ember px-7 py-4 text-cream transition-opacity hover:opacity-90"
        >
          Hear a before and after
        </a>
        <a
          href="#enquire"
          className="border border-graphite/30 px-7 py-4 transition-colors hover:border-indigo hover:text-indigo"
        >
          Start a conversation
        </a>
      </div>
    </section>
  )
}
