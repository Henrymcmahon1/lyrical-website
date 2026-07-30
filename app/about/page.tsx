import S09Team from '@/components/sections/S09Team'
import S08Rights from '@/components/sections/S08Rights'
import S10Enquire from '@/components/sections/S10Enquire'
import { Origin, Beliefs } from '@/components/sections/Origin'

export const metadata = {
  title: 'About',
  description:
    'Lyrical expands catalogues that already work, with authorised, artist-approved versions for audiences that could not hear them properly before.',
}

export default function About() {
  return (
    <>
      <section className="mx-auto max-w-3xl px-6 pt-20 sm:pt-28">
        <h1 className="font-brand text-5xl leading-tight tracking-tight text-balance sm:text-6xl">
          A song shouldn&rsquo;t stop at a border.
        </h1>

        <p className="mt-10 text-lg leading-relaxed text-graphite/75">
          Lyrical exists because the catalogue that already works in one language is the
          safest place to start in another. We don&rsquo;t manufacture demand for unknown
          songs. We take records that have already proven they connect, and make an
          authorised version for an audience that couldn&rsquo;t hear them properly before.
        </p>

        <p className="mt-6 text-lg leading-relaxed text-graphite/75">
          Everything is built around one rule: the artist&rsquo;s performance is the source
          of truth. We transfer a performance. We don&rsquo;t invent one. The melody comes
          from the artist&rsquo;s own take, the vocal carries their own timbre, and the
          instrumental they recorded is the instrumental you get back.
        </p>

        <p className="mt-6 text-lg leading-relaxed text-graphite/75">
          Nothing ships that hasn&rsquo;t been listened to. Measurements guide the work;
          ears approve it.
        </p>
      </section>

      <Origin />
      <Beliefs />
      <S09Team detail />
      <S08Rights />
      <S10Enquire />
    </>
  )
}
