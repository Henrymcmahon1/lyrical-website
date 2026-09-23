import Link from 'next/link'
import { Fold } from '@/components/Fold'
import { FoldBody } from '@/components/FoldBody'
import { ABOUT_FOLDS } from '@/content/about-folds'
import S08Rights from '@/components/sections/S08Rights'
import S09Team from '@/components/sections/S09Team'
import S10Start from '@/components/sections/S10Start'

export const metadata = {
  title: 'About',
  description:
    'lyrical expands catalogs that already work, with authorized, artist-approved versions for audiences that could not hear them properly before.',
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
 *
 * ## Refreshed 2026-09-23 to lead with the mission, then the current business
 *
 * Henry's instruction: open with the mission and the founders' story (a full version of the
 * story is still one fold down, in "Origin"), then say plainly what that belief has become,
 * the two doors as they stand today. Door one is signed artists and labels, with Coffey
 * Anderson as the proof it works; door two is the self-serve studio, live now for musicians
 * working on their own songs or songs they hold the rights to, built on proprietary voice
 * models trained in the artist's own voice. Both write to the same studio and the same inbox.
 */
export default function About() {
  return (
    <>
      <section className="mx-auto max-w-3xl px-6 pt-20 sm:pt-28">
        <h1 className="font-brand text-5xl leading-tight tracking-tight text-balance sm:text-6xl">
          A song shouldn&rsquo;t stop at a border.
        </h1>

        <p className="mt-10 text-lg leading-relaxed text-graphite/75">
          lyrical exists because a song&rsquo;s audience should be decided by whether it
          moves them, not by which language they speak. That belief did not start as a
          music company. Jordan and Henry were building technology together when a
          reinterpretation of a song Jordan loved showed how differently the same song can
          land in a different voice, and Henry watched a stadium sing along to an artist
          performing in a language most of the crowd did not speak. The audience was
          already there. Only the words were missing.
        </p>

        <p className="mt-6 text-lg leading-relaxed text-graphite/75">
          Everything is built around one rule: the artist&rsquo;s performance is the source
          of truth. We transfer a performance. We don&rsquo;t invent one. The melody comes
          from the artist&rsquo;s own take, the vocal carries their own timbre, and the
          instrumental they recorded is the instrumental you get back.
        </p>

        <p className="mt-6 text-lg leading-relaxed text-graphite/75">
          That belief now runs two doors. The first is signed artists and labels: an
          authorized release in a new language, delivered ready to put out, the way it
          worked for Coffey Anderson. The second is the self-serve studio, live now for
          musicians working on their own songs or songs they hold the rights to, built on
          proprietary voice models trained in the artist&rsquo;s own voice. Both doors write
          to the same studio and the same inbox.
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

      {/*
        The investor door, added 2026-09-22 on Henry's instruction. Quiet on purpose: the same
        outline button the rest of the site uses for its secondary action, under the team and
        before the rights position, because the people it is for have just read who they would
        be backing. /investors itself is password-gated and off the sitemap; this is the one
        place the site points at it.
      */}
      <div className="mx-auto max-w-3xl px-6 pb-8 text-center">
        <Link
          href="/investors"
          className="nudge inline-flex min-h-11 items-center rounded-card border border-graphite/30 px-7 py-4 transition-colors hover:border-indigo hover:text-indigo"
        >
          For investors
        </Link>
      </div>

      <S08Rights />
      <S10Start />
    </>
  )
}
