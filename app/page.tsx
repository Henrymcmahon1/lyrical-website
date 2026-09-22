import S01Hero from '@/components/sections/S01Hero'
import S02bAudience from '@/components/sections/S02bAudience'
import S02Coffey from '@/components/sections/S02Coffey'
import S03Wheels from '@/components/sections/S03Wheels'
import S04Fidelity from '@/components/sections/S04Fidelity'
import S05How from '@/components/sections/S05How'
import S09bNow from '@/components/sections/S09bNow'
import S09cDoors from '@/components/sections/S09cDoors'

/**
 * The funnel, deliberately short: hero, the audience turn, the proof, what we do to the
 * record, how it works for you, the turn, the two doors.
 *
 * This is the original seven-section flow, restored on 2026-09-22 on Henry's instruction
 * after he reviewed the v2 two-doors landing. The v2 sections (`S03Steps`, `S04Plans`,
 * `S05Beta`, `S06Artists`, `S07Close`) stay on disk and off this page. The one addition is
 * `S09cDoors`, which offers the musician door (/pricing) and the artist door (/artists) as
 * equals. Since Henry's second review the same day it is also the CLOSER: `S10Start` came off
 * this page (it still closes /about and /ai-music-translation), the doors moved onto the dark
 * ground, and its enquiry link lives in the artist door.
 *
 * `S02Coffey` is no longer an unused standalone section: since 2026-09-22 it is a slot
 * embedded inside `S02bAudience`, the audience section, resolved here (its signed URLs need
 * `supabaseAdmin`, server-only) and passed down as a prop, because `S02bAudience` is a client
 * component. It renders nothing until Henry supplies `COFFEY_ORIGINAL_PATH` and
 * `COFFEY_COVER_PATH`, same contract as before.
 *
 * Two pinned sections, not three. They split cleanly: `S04Fidelity` is the product, what
 * happens to the record, and `S05How` is the commercial story, what the buyer does and what
 * they receive. "What you receive" used to be a third pinned section and is folded into the
 * last step of `S05How`, where it reads as the end of a journey rather than a topic.
 *
 * The thesis, the artist/label split, the rights position and the team all live on
 * /about now. They are the depth a visitor goes looking for once they are interested,
 * not the path to becoming interested.
 */
export default async function Home() {
  const coffey = await S02Coffey()
  return (
    <>
      <S01Hero />
      <S02bAudience coffey={coffey} />
      <S03Wheels />
      <S04Fidelity />
      <S05How />
      <S09bNow />
      {/*
        `S09cTerms` used to sit here, between the turn and the ask: three headings saying no
        upfront cost, you stay in control, nothing is released without your approval. Removed
        2026-08-11 on Henry's instruction, because all three sentences were already on the
        page. The slot now holds the two doors, which say something the page did not already
        say: that there are two ways in, and which one is yours.
      */}
      <S09cDoors />
    </>
  )
}
