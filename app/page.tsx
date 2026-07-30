import { cookies } from 'next/headers'
import { GATE_COOKIE, verifyGateSafe } from '@/lib/gate'
import { HomeInteractive } from '@/components/HomeInteractive'
import S01Hero from '@/components/sections/S01Hero'
import S02bAudience from '@/components/sections/S02bAudience'
import S04Fidelity from '@/components/sections/S04Fidelity'
import S05How from '@/components/sections/S05How'
import S06Receive from '@/components/sections/S06Receive'
import S09bNow from '@/components/sections/S09bNow'
import S10Enquire from '@/components/sections/S10Enquire'

/**
 * The funnel, deliberately short: hero, the audience turn, the proof, what stays the
 * same, how it works, what you get, the turn, the ask.
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
      <S06Receive />
      <S09bNow />
      <S10Enquire />
    </>
  )
}
