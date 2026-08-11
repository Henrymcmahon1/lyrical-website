import S10Start from '@/components/sections/S10Start'
import { LANGUAGES } from '@/lib/languages'

/**
 * The search landing page, added 2026-08-09 on Henry's instruction.
 *
 * This page exists because of a reversed decision, and that is worth stating here rather than
 * only in the handover. The copy rules ban the hyphenated phrase pairing "AI" with the word
 * for machine-made, because a rights holder's lawyer reads these pages and it implies the
 * recording is fabricated. The rules do NOT ban the word "AI" alone, and every phrase a buyer
 * actually searches contains it.
 *
 * So the line drawn is narrow and deliberate: **"AI" appears as a category label, describing
 * the kind of service this is. The banned pairing appears nowhere, and `tests/copy.test.ts`
 * still fails the build if it ever does.** Nothing on this page claims the output is
 * synthetic, and every claim about rights, deliverables and languages is copied from what the
 * rest of the site already says.
 *
 * It is a real page, not a doorway. If it ever gets thinned out to chase a ranking it should
 * be deleted instead, because a thin page drags on how the whole domain is judged and this
 * site has only three others to carry it.
 */
export const metadata = {
  title: 'AI music translation',
  description:
    'AI music translation for rights holders. We re-sing a finished record in another language, in the artist’s own voice, over the untouched original backing. Authorized before it is made.',
  alternates: { canonical: '/ai-music-translation' },
}

const SECTIONS = [
  {
    h: 'What music language translation actually involves',
    p: [
      'Music language translation is not a subtitle and it is not a lyric sheet. The words have to be rewritten so they scan against the melody that already exists, syllable for syllable, and then performed against the original backing.',
      'A literal translation almost never fits a tune. Stress lands in the wrong place, lines run long, and the hook stops being a hook. The work is closer to transcreation than to translation, which is why it is done by ear and reviewed by ear.',
    ],
  },
  {
    h: 'Voice language translation, without replacing the singer',
    p: [
      'Voice language translation keeps the identity of the performance. The aim is not a new vocalist who sounds similar to the old one. It is the same artist, singing the same song, in a language they did not record it in.',
      'The melody, the rhythm and the phrasing are kept intact. The original instrumental is untouched. What changes is the language, and nothing else changes with it.',
    ],
  },
  {
    h: 'How to convert a song from one language to another',
    p: [
      'You provide the finished master and the approval. We adapt the lyric to the melody, perform it, and return a finished mix plus a dry vocal stem, so your own team can mix it if they would rather.',
      'One song is the usual first step, and nothing commits you to a second. A catalog program runs the same way, at scale.',
    ],
  },
  {
    h: 'Authorization comes first, before any work begins',
    p: [
      'An artist’s voice is used only with the artist’s or rights holder’s permission. Every version is authorized before it is made, and reviewed by ear before it is delivered. Voice models are built only from catalogs we have permission to use.',
      'This is the part that tends to get skipped elsewhere, and it is the reason this is a service for people who own or control a recording rather than a tool anyone can point at somebody else’s record.',
    ],
  },
]

export default function AiMusicTranslation() {
  return (
    <>
      <section className="mx-auto max-w-3xl px-6 pt-20 pb-4 sm:pt-28">
        <span className="font-mono text-xs tracking-[0.18em] text-graphite/45">
          AI music translation
        </span>

        <h1 className="mt-5 font-brand text-4xl leading-[1.1] tracking-tight text-balance sm:text-5xl">
          AI music translation, authorized by the rights holder.
        </h1>

        <p className="mt-8 text-lg leading-relaxed text-graphite/75">
          lyrical provides AI music language translation for artists, managers, labels,
          publishers and distributors who own or control a recording. We take a finished
          master and re-sing it in another language, in the artist&rsquo;s own voice, over the
          untouched original backing.
        </p>
      </section>

      <div className="mx-auto max-w-3xl px-6 pb-20">
        {SECTIONS.map((s) => (
          <section key={s.h} className="mt-14 border-t border-graphite/12 pt-10">
            <h2 className="font-brand text-2xl leading-snug tracking-tight text-balance sm:text-3xl">
              {s.h}
            </h2>
            {s.p.map((para) => (
              <p key={para} className="mt-5 leading-relaxed text-graphite/75">
                {para}
              </p>
            ))}
          </section>
        ))}

        <section className="mt-14 border-t border-graphite/12 pt-10">
          <h2 className="font-brand text-2xl leading-snug tracking-tight text-balance sm:text-3xl">
            Languages
          </h2>
          {/*
            Read from `lib/languages.ts`, never written out here. A second hardcoded list is
            how the site ends up claiming one set of languages on one page and a different set
            on another, and a test already pins that list to exactly eight.
          */}
          <p className="mt-5 leading-relaxed text-graphite/75">
            {LANGUAGES.map((l) => l.english).join(', ')}.
          </p>
        </section>
      </div>

      <S10Start />
    </>
  )
}
