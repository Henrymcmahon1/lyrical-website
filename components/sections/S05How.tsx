import { PinnedStepper, type Step } from '../PinnedStepper'

/**
 * The commercial section: what the buyer does, and what lands in their inbox.
 *
 * Three steps, down from five. The two that went were "we rewrite the lyric" and "we sing it
 * in the voice", which describe our work rather than theirs. That work is now the whole of
 * the section above, so keeping it here said the same thing twice and made a five step
 * process out of what is, for the customer, a three step one: you permit it, you send it,
 * you receive it.
 *
 * "What you receive" used to be a fourth pinned section. It is folded into the last step
 * instead. The deliverables are the end of this journey, not a separate topic, and a pinned
 * section of its own was two screens of scrolling to say what a sentence says.
 *
 * Numbering is legitimate here: this is a real sequence. Permission is step 00 rather than a
 * footnote, because for a rights holder authorisation is not a disclaimer at the bottom of a
 * page, it is the precondition for everything after it. Putting it first is the difference
 * between reassuring them and reminding them to worry.
 */
const STEPS: Step[] = [
  {
    h: 'It starts with permission',
    p: 'Nothing is made without the artist’s or rights holder’s approval, and voice models are built only from catalogues we are allowed to use. Authorisation comes first, before any work begins.',
  },
  {
    h: 'You send one song',
    p: 'The finished master, and the languages you want it in. One song is the usual first step, and nothing commits you to a second. A catalogue programme runs the same way, at scale.',
  },
  {
    h: 'You get the assets',
    p: 'A finished mix matched to the original vocal balance, a dry vocal stem for your own engineer, reference versions to A/B against the original, and a per-song report of what was covered and where. Studio ready, and yours to mix.',
  },
]

export default function S05How() {
  return (
    <section id="how">
      <PinnedStepper
        title="How it works"
        intro="It begins with your permission, and ends with your approval. You authorise it and you sign it off. Everything in between is ours."
        steps={STEPS}
        startAt={0}
      />

      {/* Moved here with the deliverables it describes. It qualified "what you receive" and
          was orphaned when that section was folded into the step above. */}
      <div className="mx-auto max-w-6xl px-6 pb-16">
        <div className="flex flex-wrap gap-x-10 gap-y-3 font-mono text-xs tracking-[0.14em] text-graphite/50 tabular-nums">
          <span>48.0 kHz</span>
          <span>24 bit</span>
          <span>08 languages</span>
          <span>Reviewed by ear</span>
        </div>
      </div>
    </section>
  )
}
