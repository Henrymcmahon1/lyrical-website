import { cookies } from 'next/headers'
import { GATE_COOKIE, verifyGateSafe } from '@/lib/gate'
import { HomeInteractive } from '@/components/HomeInteractive'
import { Divider } from '@/components/Divider'
import S01Hero from '@/components/sections/S01Hero'
import S02Border from '@/components/sections/S02Border'
import S04Fidelity from '@/components/sections/S04Fidelity'
import S05How from '@/components/sections/S05How'
import S06Receive from '@/components/sections/S06Receive'
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
      <S02Border />
      <HomeInteractive initiallyUnlocked={unlocked} />
      <Divider />
      <S04Fidelity />
      <Divider />
      <S05How />
      <S06Receive />
      <Divider />
      <S07Doors />
      <S08Rights />
      <S09Team />
      <S10Enquire />
    </>
  )
}
