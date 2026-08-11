import S01Hero from '@/components/sections/S01Hero'
import S02bAudience from '@/components/sections/S02bAudience'
import S03Wheels from '@/components/sections/S03Wheels'
import S04Fidelity from '@/components/sections/S04Fidelity'
import S05How from '@/components/sections/S05How'
import S09bNow from '@/components/sections/S09bNow'
import S10Start from '@/components/sections/S10Start'

/**
 * The funnel, deliberately short: hero, the audience turn, the proof, what we do to the
 * record, how it works for you, the turn, the ask.
 *
 * Two pinned sections, not three. They now split cleanly: `S04Fidelity` is the product,
 * what happens to the record, and `S05How` is the commercial story, what the buyer does and
 * what they receive. "What you receive" used to be a third pinned section and is folded into
 * the last step of `S05How`, where it reads as the end of a journey rather than a topic.
 *
 * The thesis, the artist/label split, the rights position and the team all live on
 * /about now. They are the depth a visitor goes looking for once they are interested,
 * not the path to becoming interested.
 */
export default function Home() {
  return (
    <>
      <S01Hero />
      <S02bAudience />
      <S03Wheels />
      <S04Fidelity />
      <S05How />
      <S09bNow />
      {/*
        `S09cTerms` used to sit here, between the turn and the ask: three headings saying no
        upfront cost, you stay in control, nothing is released without your approval. Removed
        2026-08-11 on Henry's instruction, and it cost the page almost nothing, because all
        three sentences were already on it. The hero states them in its third paragraph, the
        closing section restates them under the button, `S05How` carries the permission promise
        in step one and now the cost in step two, and `S08Rights` argues the rights position at
        length on /about. A whole screen to repeat what the page has already said twice is a
        screen between a reader and the ask.
      */}
      <S10Start />
    </>
  )
}
