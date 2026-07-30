'use client'

import { useEffect, useRef, useState } from 'react'
import { trackProgress } from '@/lib/scroll-progress'

export type Step = { h: string; p: string }

/**
 * A section that holds while its steps advance, one idea on screen at a time.
 *
 * Same safety contract as PinnedClaims: the pinning lives in CSS scoped to `.js-motion`
 * AND >=768px AND no-reduced-motion. Outside that intersection the steps render as an
 * ordinary list, so a phone or a no-JS visitor reads all of them normally and can never
 * be trapped in a tall empty track.
 *
 * Below the breakpoint the list is not left static. Each step fades up as it arrives, and a
 * compact strip carrying the eyebrow and the progress dots sticks under the nav so the
 * reader keeps a sense of where they are in the sequence. The strip is deliberately not the
 * whole heading block: eyebrow, a `text-4xl` title and the intro come to roughly 40% of a
 * 375px screen, which leaves too little room for the content it is meant to be a cue for.
 */
export function PinnedStepper({
  eyebrow,
  title,
  intro,
  steps,
  numbered = true,
  startAt = 1,
}: {
  eyebrow?: string
  title: string
  intro?: string
  steps: Step[]
  numbered?: boolean
  /** 0 lets a precondition sit at step 00 rather than renumbering the real sequence. */
  startAt?: number
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLLIElement | null)[]>([])
  const [active, setActive] = useState(0)
  const [pinned, setPinned] = useState(false)

  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    const mq = window.matchMedia(
      '(min-width: 768px) and (prefers-reduced-motion: no-preference)',
    )

    let raf = 0
    let onScreen = false

    const measure = () => {
      const rect = track.getBoundingClientRect()
      const vh = window.innerHeight

      if (mq.matches) {
        // Pinned. The track is 100vh of panel plus travel per step, and progress through
        // that travel IS the step index by construction.
        const p = trackProgress(rect, vh)
        setActive(Math.min(steps.length - 1, Math.floor(p * steps.length * 0.999)))
      } else {
        /**
         * Unpinned, and track progress is the wrong clock — the same mistake that broke the
         * morph, in a different costume.
         *
         * In normal flow the track is the height of the stacked list: measured 1414px inside
         * an 812px viewport, so `height - vh` is 602px and progress saturates at 1 after
         * 602px of scrolling, while the reader still has 1414px of content to get through.
         * The dots raced to the last step and sat there from step 2 onward, which is worse
         * than showing nothing.
         *
         * The honest cue here is positional: the current step is the last one whose top has
         * crossed the reading line.
         */
        const line = vh * 0.4
        let index = 0
        for (let i = 0; i < itemRefs.current.length; i++) {
          const el = itemRefs.current[i]
          if (el && el.getBoundingClientRect().top <= line) index = i
        }
        setActive(index)
      }

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

    // `pinned` gates `data-active`, which drives the desktop crossfade. `active` itself is
    // NOT reset here: below the breakpoint the sticky strip reads it.
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

  /**
   * One observer per step, so a step animates when IT arrives rather than when the section
   * does. Observed at every width on purpose: `.pin-reveal` has no rules above 767px, so
   * `.in` is inert there, and adding it unconditionally means resizing from phone width up
   * to desktop and back can never leave a step stranded at opacity 0.
   */
  useEffect(() => {
    const els = itemRefs.current.filter((el): el is HTMLLIElement => el !== null)
    if (!els.length) return

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('in')
          io.unobserve(entry.target)
        }
      },
      // Commit slightly after the item crosses the bottom edge rather than exactly on it.
      { rootMargin: '0px 0px -8% 0px' },
    )
    els.forEach((el) => io.observe(el))

    return () => io.disconnect()
  }, [steps.length])

  return (
    <div ref={trackRef} className="pin-track" style={{ '--steps': steps.length } as React.CSSProperties}>
      <div className="pin-panel">
        {/*
          Mobile only. `md:hidden` is display:none, so above the breakpoint this is not a
          flex item and the pinned panel's centring is untouched. `top-15` is 3.75rem, which
          clears the sticky nav: a 44px tap target plus py-2 top and bottom.
        */}
        {eyebrow && (
          <div className="sticky top-15 z-10 mb-10 border-b border-graphite/10 bg-cream/85 backdrop-blur-sm md:hidden">
            <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite/45">
                {eyebrow}
              </p>
              <ol className="ml-auto flex gap-2" aria-hidden="true">
                {steps.map((s, i) => (
                  <li
                    key={s.h}
                    className={`h-px w-7 transition-colors duration-300 ${
                      i === active ? 'bg-indigo' : 'bg-graphite/20'
                    }`}
                  />
                ))}
              </ol>
            </div>
          </div>
        )}

        <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 md:grid-cols-[minmax(0,22rem)_1fr] md:gap-20">
          <div>
            {eyebrow && (
              <p className="hidden font-mono text-[11px] uppercase tracking-[0.18em] text-graphite/45 md:block">
                {eyebrow}
              </p>
            )}
            <h2 className="mt-4 font-brand text-4xl leading-tight tracking-tight text-balance">
              {title}
            </h2>
            {intro && <p className="mt-5 max-w-sm text-graphite/70">{intro}</p>}

            <ol className="mt-10 hidden gap-3 md:flex" aria-hidden="true">
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

          <ul className="pin-stack flex flex-col gap-12 md:gap-0">
            {steps.map((s, i) => (
              <li
                key={s.h}
                ref={(el) => {
                  itemRefs.current[i] = el
                }}
                className="pin-item pin-reveal"
                data-active={pinned ? i === active : undefined}
              >
                {numbered && (
                  <span className="font-mono text-xs tracking-[0.18em] text-indigo tabular-nums">
                    {String(i + startAt).padStart(2, '0')}
                  </span>
                )}
                <h3 className="mt-3 font-brand text-3xl leading-tight tracking-tight md:text-4xl">
                  {s.h}
                </h3>
                <p className="mt-4 max-w-md text-lg leading-relaxed text-graphite/75">{s.p}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
