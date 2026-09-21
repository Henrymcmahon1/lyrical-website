import S01Hero from '@/components/sections/S01Hero'
import S02Coffey from '@/components/sections/S02Coffey'
import S03Steps from '@/components/sections/S03Steps'
import S04Plans from '@/components/sections/S04Plans'
import S05Beta from '@/components/sections/S05Beta'
import S06Artists from '@/components/sections/S06Artists'
import S07Close from '@/components/sections/S07Close'

/**
 * Two doors, fan door first (2026-09-22, spec §7): hero, Coffey before/after (null until the
 * files are in the bucket), how it works, plan preview, beta honesty, the artist door, close.
 * S02bAudience, S03Wheels, S04Fidelity, S05How and S09bNow left this page and stay on disk
 * (/hear uses S03Wheels; /about carries the rights-holder story).
 *
 * force-dynamic: S02Coffey signs storage URLs per request; a prerender would bake in the empty
 * state. It is awaited here and placed as a node, not written as <S02Coffey />, because the
 * render test does renderToStaticMarkup(await Home()) and that cannot render a nested async
 * component.
 */
export const dynamic = 'force-dynamic'

export default async function Home() {
  const coffey = await S02Coffey()
  return (
    <>
      <S01Hero />
      {coffey}
      <S03Steps />
      <S04Plans />
      <S05Beta />
      <S06Artists />
      <S07Close />
    </>
  )
}
