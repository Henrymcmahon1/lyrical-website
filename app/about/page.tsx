import { Fold } from '@/components/Fold'
import S06bMaster from '@/components/sections/S06bMaster'
import S07Doors from '@/components/sections/S07Doors'
import S08Rights from '@/components/sections/S08Rights'
import S09Team from '@/components/sections/S09Team'
import S10Enquire from '@/components/sections/S10Enquire'
import { Origin, Beliefs } from '@/components/sections/Origin'

export const metadata = {
  title: 'About',
  description:
    'Lyrical expands catalogues that already work, with authorised, artist-approved versions for audiences that could not hear them properly before.',
}

/**
 * The depth, folded.
 *
 * This page ran to roughly fourteen screens of continuous prose, which is a lot to put in
 * front of somebody who arrived looking for one specific reassurance. The four background
 * sections now collapse, so the page reads as a short contents list that a visitor opens only
 * where they actually have a question.
 *
 * What stays open is what a buyer came for: who they are dealing with, the rights position,
 * and the way to start a conversation. The folds are native `<details>`, so none of this
 * depends on JavaScript and find-in-page still reaches inside them.
 */
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

      <div className="mx-auto mt-20 max-w-3xl px-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite/45">
          More, if you want it
        </p>

        <div className="mt-6">
          <Fold
            label="Why it matters"
            summary="What a master recording actually is, and why it is the safest place to start."
          >
            <S06bMaster />
          </Fold>

          <Fold label="Origin" summary="How Lyrical started, and the song that started it.">
            <Origin />
          </Fold>

          <Fold label="Beliefs" summary="The rules we hold ourselves to, in writing.">
            <Beliefs />
          </Fold>

          <Fold
            label="Ways in"
            summary="One flagship release, or catalogue infrastructure. They are different jobs."
          >
            <S07Doors />
          </Fold>
        </div>
      </div>

      <S09Team detail />
      <S08Rights />
      <S10Enquire />
    </>
  )
}
