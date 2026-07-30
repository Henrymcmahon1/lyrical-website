import { PinnedStepper, type Step } from '../PinnedStepper'

/**
 * Numbering is legitimate here: this is a real sequence, not decoration.
 *
 * Permission is step 00 rather than a footnote. For a rights holder, authorisation is not
 * a disclaimer at the bottom of a page, it is the precondition for everything after it,
 * and putting it first is the difference between reassuring them and reminding them to
 * worry.
 */
const STEPS: Step[] = [
  {
    h: 'It starts with permission',
    p: 'Nothing is made without the artist’s or rights holder’s approval, and voice models are built only from catalogues we are allowed to use.',
  },
  { h: 'You send the song', p: 'The finished master, and the languages you want it in.' },
  { h: 'We rewrite the lyric', p: 'To sing naturally on the original melody, syllable by syllable.' },
  { h: 'We sing it in the voice', p: 'Performed in the artist’s own voice, in the new language.' },
  { h: 'You get the assets', p: 'A finished mix and a dry vocal stem, checked by ear.' },
]

export default function S05How() {
  return (
    <section id="how">
      <PinnedStepper
        eyebrow="How it works"
        title="It begins with your permission, and ends with your approval."
        intro="You authorise it and you sign it off. Everything between is ours."
        steps={STEPS}
        startAt={0}
      />
    </section>
  )
}
