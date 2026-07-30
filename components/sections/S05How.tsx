import { PinnedStepper, type Step } from '../PinnedStepper'

/** Numbering is legitimate here: this is a real sequence, not decoration. */
const STEPS: Step[] = [
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
        title="Four steps, and none of them are yours."
        intro="You send a master and approve the result. Everything between is ours."
        steps={STEPS}
      />
    </section>
  )
}
