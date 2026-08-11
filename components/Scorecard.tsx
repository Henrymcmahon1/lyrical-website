import { SCORECARD_CRITERIA } from '@/content/scorecard'

/**
 * How a delivery is judged, explained to the customer inside the studio.
 *
 * It sits under their songs because that is where the question occurs to them: they have handed
 * over a master and want to know what "good" will mean when it comes back. Answering it before
 * they ask is most of the trust this page has to earn.
 *
 * ## It shows no numbers, deliberately
 *
 * The scorecard is in build and produces nothing yet. A section with scores in it would be
 * describing a measurement that does not run, which is a worse failure than saying nothing,
 * because it is checkable. Henry's instruction on 2026-08-11 was to explain the method and
 * claim no result, and this component is the shape of that instruction.
 *
 * ⚠️ When the numbers do exist, do NOT delete this text and drop a table in. The comparison is
 * the argument; the numbers are only evidence for it. A table with no explanation of what it is
 * relative to reads as a boast, which is exactly what a rights holder discounts.
 */
export function Scorecard() {
  return (
    <section
      aria-labelledby="scorecard-heading"
      className="mt-20 border-t border-graphite/15 pt-14"
    >
      <span className="font-mono text-xs tracking-[0.18em] text-graphite/45">
        How we measure it
      </span>

      <h2
        id="scorecard-heading"
        className="mt-5 max-w-xl font-brand text-3xl leading-snug tracking-tight text-balance"
      >
        Every version is scored against the artist&rsquo;s own recording.
      </h2>

      <div className="mt-6 max-w-xl space-y-4 leading-relaxed text-graphite/75">
        <p>
          A score on its own tells you nothing. Speech recognition struggles with a fast track
          even when you feed it the real record, sung by the real artist, so a number for our
          version only means something next to the number the original gets on the same test.
        </p>
        <p>
          So that is how all of it works. The original recording is the reference and the
          ceiling, and every measurement below is a comparison with it rather than a mark out
          of ten.
        </p>
      </div>

      <dl className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2">
        {SCORECARD_CRITERIA.map((c) => (
          <div key={c.name}>
            <dt className="font-brand text-lg leading-snug tracking-tight text-indigo">
              {c.name}
            </dt>
            <dd className="mt-2 leading-relaxed text-graphite/70">{c.how}</dd>
          </div>
        ))}
      </dl>

      {/*
        The honest state of it, stated rather than left to be discovered.

        A customer who reads seven criteria and then sees no scores will conclude either that
        the measurement failed or that we are hiding it. Saying "not yet" is cheaper than both,
        and it is the sentence that gets deleted on the day there is something to show.
      */}
      <p className="mt-12 max-w-xl rounded-card border-l-[3px] border-indigo bg-indigo/5 px-5 py-4 leading-relaxed text-graphite/80">
        We are building this into every delivery now. Your songs will not show scores yet, and
        we would rather say so than show you a number we cannot stand behind.
      </p>
    </section>
  )
}
