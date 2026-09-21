import Link from 'next/link'
import { DOORS } from '@/content/two-doors'
import { Reveal } from '../Reveal'

/**
 * The two doors, side by side, and since Henry's second review on 2026-09-22 the CLOSING
 * section of the home page. `S10Start` came off the home page the same day (it still closes
 * /about and /ai-music-translation), so this is the last thing a visitor sees and the one
 * place the site asks them to choose.
 *
 * ## Colour band
 *
 * This section is the home page's one dark band. It uses the dark-section tokens from
 * globals.css (`dark-ground` #1B1D1F, `dark-ink` #EDEBE4, `dark-accent` #FF6B2C), never
 * indigo, which fails contrast on the dark ground. `S09bNow` above it is cream, so the seam
 * is cream to dark: one deliberate step, not the two-near-identical-blacks fault `/hear`
 * documents. If anything dark is ever placed directly above this section, a cream band has
 * to go between them.
 *
 * ## Two halves, one sentence each
 *
 * Each door says who it is for in its heading and its one line, because the two were being
 * confused. The left door is for musicians: their own songs, or songs they have the rights
 * to, one button to /pricing. The right door is for artists releasing a catalog with us: the
 * three benefits, "Sign with us" to /artists and the enquiry link "Tell us about it" to
 * /contact, which is where that CTA lives now that the old closer is gone. Same card, same
 * heading scale; neither door is the "real" one.
 *
 * `id="doors"` is the nav's "Get started" target. `[id]` in globals.css carries the
 * scroll-margin that keeps the heading clear of the sticky nav; `scroll-mt-24` restates it
 * on the section so the rule is visible where the anchor is.
 */
export default function S09cDoors() {
  return (
    <section
      id="doors"
      aria-label="Two ways in"
      className="scroll-mt-24 bg-dark-ground py-24 text-dark-ink sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <h2 className="text-center font-brand text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
            {DOORS.h}
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {DOORS.doors.map((door, i) => (
            <Reveal key={door.h} delay={120 + i * 80} className="flex">
              <div className="flex w-full flex-col rounded-card border border-dark-ink/15 p-8 sm:p-10">
                <h3 className="font-brand text-3xl leading-tight tracking-tight text-balance">
                  {door.h}
                </h3>
                <p className="mt-5 text-lg leading-relaxed text-dark-ink/75">{door.p}</p>
                {door.points.length > 0 && (
                  <ul className="mt-6 flex flex-col gap-2 text-sm text-dark-ink/75">
                    {door.points.map((point) => (
                      <li key={point} className="flex gap-3">
                        <span
                          aria-hidden="true"
                          className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-dark-accent"
                        />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-auto flex flex-wrap items-center gap-4 pt-8">
                  <Link
                    href={door.href}
                    className="nudge inline-flex min-h-11 items-center rounded-card bg-dark-accent px-7 py-4 text-dark-ground"
                  >
                    {door.cta} <span className="shift-arrow">&rarr;</span>
                  </Link>
                  {'secondary' in door && door.secondary && (
                    <Link
                      href={door.secondary.href}
                      className="nudge inline-flex min-h-11 items-center rounded-card border border-dark-ink/30 px-7 py-4 transition-colors hover:border-dark-ink"
                    >
                      {door.secondary.cta}
                    </Link>
                  )}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
