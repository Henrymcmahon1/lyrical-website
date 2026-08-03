'use client'

import { useEffect, useRef, useState } from 'react'
import { trackProgress } from '@/lib/scroll-progress'
import { ScrollCue } from './ScrollCue'
import { PIN_ITEM_BODY, PIN_ITEM_HEADING } from './pinned-type'

export type Step = { h: string; p: string }

/**
 * A section that holds still while its steps advance, one idea on screen at a time.
 *
 * Pins at every width. The pinning itself is CSS, scoped to `.js-motion` and
 * `prefers-reduced-motion: no-preference`; this component only decides which step is active
 * and how far through the hold the reader is. With JavaScript off or motion reduced, none of
 * those rules exist and the steps render as an ordinary readable list.
 *
 * On a phone the heading arrives in normal flow ABOVE the track and scrolls away, and the
 * pinned panel carries a compact label instead. Keeping the full heading inside the panel
 * would eat roughly 40% of a 375px screen and leave the steps cramped, which is exactly what
 * the earlier mobile layout got wrong.
 */
export function PinnedStepper({
  title,
  intro,
  steps,
  numbered = true,
}: {
  /**
   * Short. It is the pinned header on a phone as well as the heading, so a sentence here
   * would eat a third of the panel and cramp the steps, which is what the earlier mobile
   * layout got wrong. Two or three words.
   */
  title: string
  /** The longer framing. Introduces the section, then scrolls away with it. */
  intro?: string
  steps: Step[]
  numbered?: boolean
}) {
  /*
   * Everything counts from 01.
   *
   * There used to be a `startAt` prop so "It starts with permission" could sit at step 00,
   * on the argument that a precondition is not part of the sequence. It read as a bug beside
   * the other pinned section counting 01, 02, 03, and one section using a different base from
   * the other is a worse problem than a precondition sharing a number with a step. Removed
   * rather than defaulted, so it cannot come back by accident.
   */
  const trackRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLElement>(null)
  const [active, setActive] = useState(0)
  const [pinned, setPinned] = useState(false)

  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    // Pinning is no longer gated on width. It runs wherever motion is allowed.
    const mq = window.matchMedia('(prefers-reduced-motion: no-preference)')

    let raf = 0
    let onScreen = false

    const measure = () => {
      const rect = track.getBoundingClientRect()
      const p = trackProgress(rect, window.innerHeight)

      setActive(Math.min(steps.length - 1, Math.floor(p * steps.length * 0.999)))

      // Written straight to the node rather than through state: this changes every frame and
      // React does not need to re-render for a transform.
      if (barRef.current) barRef.current.style.setProperty('--p', p.toFixed(4))

      raf = onScreen ? requestAnimationFrame(measure) : 0
    }

    const io = new IntersectionObserver((entries) => {
      onScreen = entries[0]?.isIntersecting ?? false
      if (onScreen && !raf) raf = requestAnimationFrame(measure)
      if (!onScreen && raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
    })

    const sync = () => setPinned(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    io.observe(track)

    return () => {
      mq.removeEventListener('change', sync)
      io.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [steps.length])

  // Indigo here too. The mobile pinned header uses it, and the same heading rendering in two
  // different colours depending on window width is the kind of inconsistency that reads as
  // an accident rather than a decision.
  const heading = (
    <>
      <h2 className="font-brand text-4xl leading-tight tracking-tight text-balance text-indigo">
        {title}
      </h2>
      {intro && <p className="mt-5 max-w-sm leading-relaxed text-graphite/70">{intro}</p>}
    </>
  )

  return (
    <>
      {/*
        No mobile heading block above the track any more.

        It rendered the title at full size in normal flow and then the pinned panel rendered
        it again, so a phone showed the same words twice within one screen of each other. The
        panel is now the only place the section names itself.
      */}

      <div
        ref={trackRef}
        className="pin-track"
        style={{ '--steps': steps.length } as React.CSSProperties}
      >
        <div className="pin-panel">
          {/* Mobile only. Proof that scrolling is still doing something while the panel holds. */}
          <div className="pin-progress" aria-hidden="true">
            <i ref={barRef} />
          </div>

          {/*
            Which way this section advances. Controlled, because this component already knows
            which step the reader is on, so it can say when the cue has done its job.

            Also gated on `pinned` so a cue never points at a section that is not holding.
          */}
          {pinned && <ScrollCue done={active > 0} />}

          <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 md:grid-cols-[minmax(0,22rem)_1fr] md:gap-20">
            <div className="hidden md:block">
              {heading}

              <ol className="mt-10 flex gap-3" aria-hidden="true">
                {steps.map((s, i) => (
                  <li
                    key={s.h}
                    className={`pin-dot h-px w-10 ${
                      pinned && i === active ? 'bg-indigo' : 'bg-graphite/20'
                    }`}
                  />
                ))}
              </ol>
            </div>

            <div>
              {/*
                The title, pinned.

                On a phone the heading arrives above the track at full size and scrolls away;
                this is where it lands, so the section names itself for the whole hold. It
                used to be a separate 11px uppercase label, which said the title's job in a
                caption's voice and left readers on step two unsure what they were reading.

                The title only. The intro stays above and scrolls off, because a sentence
                held here costs about a third of a 375px panel and cramps the steps.

                Desktop keeps the real heading in the left column, which never scrolls away,
                so this is mobile only rather than saying it twice.
              */}
              <div className="mb-8 border-b border-graphite/15 pb-4 md:hidden">
                <div className="flex items-baseline justify-between gap-4">
                  {/* Indigo: this is the section's identity and the one fixed point while
                      everything under it changes. Graphite would make it compete with the
                      step headings, which are the thing actually moving. */}
                  <h2 className="font-brand text-3xl leading-none tracking-tight text-indigo">
                    {title}
                  </h2>
                  <span className="font-mono text-[13px] tabular-nums text-graphite/45">
                    {String(active + 1).padStart(2, '0')}
                    <span className="text-graphite/30">
                      {' / '}
                      {String(steps.length).padStart(2, '0')}
                    </span>
                  </span>
                </div>
                {intro && (
                  <p className="mt-3 text-sm leading-relaxed text-graphite/65">{intro}</p>
                )}
              </div>

              <ul className="pin-stack flex flex-col gap-12 md:gap-0">
                {steps.map((s, i) => (
                  <li
                    key={s.h}
                    className="pin-item"
                    data-active={pinned ? i === active : undefined}
                  >
                    {numbered && (
                      // Desktop only: the persistent header above already carries the
                      // position on a phone, and two copies of it on one screen is noise.
                      <span className="hidden font-mono text-xs tracking-[0.18em] text-indigo tabular-nums md:inline">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    )}
                    <h3 className={PIN_ITEM_HEADING}>{s.h}</h3>
                    <p className={PIN_ITEM_BODY}>{s.p}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
