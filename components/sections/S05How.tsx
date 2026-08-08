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
 * The "48.0 kHz / 24 bit / 08 languages / Reviewed by ear" strip that used to sit under this
 * section is gone. It qualified "what you receive" back when that was its own section, and
 * once the deliverables moved into step 02 it read as four disconnected numbers floating in
 * empty space with nothing to attach to. Sample rate and bit depth are table stakes to an
 * engineer and meaningless to everybody else, so nothing was lost by removing it.
 *
 * Numbering is legitimate here: this is a real sequence. Permission is step 00 rather than a
 * footnote, because for a rights holder authorization is not a disclaimer at the bottom of a
 * page, it is the precondition for everything after it. Putting it first is the difference
 * between reassuring them and reminding them to worry.
 */
const STEPS: Step[] = [
  {
    h: 'It starts with permission',
    p: 'Nothing is made without the artist’s or rights holder’s approval, and voice models are built only from catalogs we are allowed to use. Authorization comes first, before any work begins.',
  },
  {
    h: 'You send one song',
    p: 'The finished master, and the languages you want it in. One song is the usual first step, and nothing commits you to a second. A catalog program runs the same way, at scale.',
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
        intro="It begins with your permission and ends with your approval. Everything in between is ours."
        steps={STEPS}
      />
    </section>
  )
}
