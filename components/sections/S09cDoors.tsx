import Link from 'next/link'
import { DOORS } from '@/content/two-doors'
import { Reveal } from '../Reveal'

/**
 * The two doors, side by side, between the turn and the closing ask. Added 2026-09-22 on
 * Henry's instruction after the v2 review: the original seven-section flow comes back and this
 * is the one new screen in it.
 *
 * Colour band: `S09bNow` above is cream and `S10Start` below is graphite. This section stays
 * on cream on purpose. A dark ground here would stack two near-identical blacks back to back,
 * which is the seam bug `/hear` documents, so the two halves are bordered cards on the page
 * colour and the dark band still belongs to the ask alone.
 *
 * Two equal halves: same card, same heading scale, same button weight. Neither door is the
 * "real" one. Ember carries both buttons because it is the action colour and the cards are
 * on cream, where the fill passes.
 */
export default function S09cDoors() {
  return (
    <section id="doors" aria-label="Two ways in" className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
      <Reveal>
        <h2 className="text-center font-brand text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
          {DOORS.h}
        </h2>
      </Reveal>

      <div className="mt-14 grid gap-6 md:grid-cols-2">
        {DOORS.doors.map((door, i) => (
          <Reveal key={door.label} delay={120 + i * 80} className="flex">
            <div className="flex w-full flex-col rounded-card border border-graphite/15 p-8 sm:p-10">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite/45">
                {door.label}
              </span>
              <h3 className="mt-5 font-brand text-3xl leading-tight tracking-tight text-balance">
                {door.h}
              </h3>
              <p className="mt-5 leading-relaxed text-graphite/75">{door.p}</p>
              <ul className="mt-6 flex flex-col gap-2 text-sm text-graphite/75">
                {door.points.map((point) => (
                  <li key={point} className="flex gap-3">
                    <span aria-hidden="true" className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-indigo" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-8">
                <Link
                  href={door.href}
                  className="nudge inline-flex min-h-11 items-center rounded-card bg-ember px-7 py-4 text-cream"
                >
                  {door.cta} <span className="shift-arrow">&rarr;</span>
                </Link>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
