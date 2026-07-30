import { cookies } from 'next/headers'
import { GATE_COOKIE, verifyGateSafe } from '@/lib/gate'
import { HomeInteractive } from '@/components/HomeInteractive'
import { ZoomThroughMark } from '@/components/ZoomThroughMark'
import S01Hero from '@/components/sections/S01Hero'
import S02BorderDetail, { S02BorderStatement } from '@/components/sections/S02Border'
import S02bAudience from '@/components/sections/S02bAudience'
import S04Fidelity from '@/components/sections/S04Fidelity'
import S05How from '@/components/sections/S05How'
import S06Receive from '@/components/sections/S06Receive'
import S06bMaster from '@/components/sections/S06bMaster'
import S07Doors from '@/components/sections/S07Doors'
import S08Rights from '@/components/sections/S08Rights'
import S09Team from '@/components/sections/S09Team'
import S10Enquire from '@/components/sections/S10Enquire'

export default async function Home() {
  // `cookies()` is async-only as of Next.js 16.
  const jar = await cookies()
  const unlocked = verifyGateSafe(jar.get(GATE_COOKIE)?.value)

  return (
    <>
      <S01Hero />

      {/* Signature moment one: fall through the mark onto the statement. */}
      <ZoomThroughMark>
        <S02BorderStatement />
      </ZoomThroughMark>
      <S02BorderDetail />

      {/* Signature moment two: the pause becomes the mark, one language becomes eight. */}
      <S02bAudience />

      <HomeInteractive initiallyUnlocked={unlocked} />
      <S04Fidelity />
      <S05How />
      <S06Receive />
      <S06bMaster />
      <S07Doors />
      <S08Rights />
      <S09Team />
      <S10Enquire />
    </>
  )
}
