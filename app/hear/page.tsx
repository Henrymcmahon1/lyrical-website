import { cookies } from 'next/headers'
import { GATE_COOKIE, verifyGateSafe } from '@/lib/gate'
import { HomeInteractive } from '@/components/HomeInteractive'
import S10Enquire from '@/components/sections/S10Enquire'

export const metadata = {
  title: 'Hear it',
  description:
    'Choose a language pair and hear an original recording against the recreated version.',
}

export default async function Hear() {
  const jar = await cookies()
  const requested = verifyGateSafe(jar.get(GATE_COOKIE)?.value)

  return (
    <>
      <section className="mx-auto max-w-3xl px-6 pt-20 pb-4 text-center sm:pt-28">
        <h1 className="font-brand text-5xl leading-tight tracking-tight text-balance sm:text-6xl">
          The same performance, twice.
        </h1>
        <p className="mt-8 text-lg leading-relaxed text-graphite/75">
          Choose a language pair and hear the original against the recreated version. The
          melody, the phrasing and the backing are identical. Only the language
          changes.
        </p>
      </section>

      <div className="mt-12">
        <HomeInteractive initiallyRequested={requested} />
      </div>

      <S10Enquire />
    </>
  )
}
