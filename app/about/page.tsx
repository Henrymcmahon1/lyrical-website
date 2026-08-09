import { Fold } from '@/components/Fold'
import { FoldBody } from '@/components/FoldBody'
import { ABOUT_FOLDS } from '@/content/about-folds'
import S08Rights from '@/components/sections/S08Rights'
import S09Team from '@/components/sections/S09Team'
import S10Enquire from '@/components/sections/S10Enquire'

export const metadata = {
  title: 'About',
  description:
    'Lyrical expands catalogs that already work, with authorized, artist-approved versions for audiences that could not hear them properly before.',
  alternates: { canonical: '/about' },
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
 *
 * The folds render from `content/about-folds.ts` through one body component. They previously
 * wrapped four standalone section components, which each brought their own width, alignment
 * and heading scale into a container narrower than any of them.
 */
export default function About() {
  return (
    <>
      <section className="mx-auto max-w-3xl px-6 pt-20 sm:pt-28">
        <h1 className="font-brand text-5xl leading-tight tracking-tight text-balance sm:text-6xl">
          A song shouldn&rsquo;t stop at a border.
        </h1>

        <p className="mt-10 text-lg leading-relaxed text-graphite/75">
          Lyrical exists because the catalog that already works in one language is the
          safest place to start in another. We don&rsquo;t manufacture demand for unknown
          songs. We take records that have already proven they connect, and make an
          authorized version for an audience that couldn&rsquo;t hear them properly before.
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
          {ABOUT_FOLDS.map((fold) => (
            <Fold key={fold.label} label={fold.label} summary={fold.summary}>
              <FoldBody fold={fold} />
            </Fold>
          ))}
        </div>
      </div>

      <S09Team detail />
      <S08Rights />
      <S10Enquire />
    </>
  )
}
