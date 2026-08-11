import { cookies } from 'next/headers'
import { GATE_COOKIE, verifyGateSafe } from '@/lib/gate'
import { HomeInteractive } from '@/components/HomeInteractive'
import S01Hero from '@/components/sections/S01Hero'
import S02bAudience from '@/components/sections/S02bAudience'
import S04Fidelity from '@/components/sections/S04Fidelity'
import S05How from '@/components/sections/S05How'
import S09bNow from '@/components/sections/S09bNow'
import S09cTerms from '@/components/sections/S09cTerms'
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
export default async function Home() {
  // `cookies()` is async-only as of Next.js 16.
  const jar = await cookies()
  const requested = verifyGateSafe(jar.get(GATE_COOKIE)?.value)

  return (
    <>
      <S01Hero />
      <S02bAudience />
      <HomeInteractive initiallyRequested={requested} />
      <S04Fidelity />
      <S05How />
      <S09bNow />
      {/*
        Placed between the turn and the ask on purpose. The turn states the cost of doing
        nothing; this answers "what does trying cost me"; the form follows immediately. It is
        the last objection before the ask, so it sits directly before it.
      */}
      <S09cTerms />
      <S10Start />
    </>
  )
}
