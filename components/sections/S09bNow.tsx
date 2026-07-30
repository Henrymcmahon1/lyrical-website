'use client'

import { useEffect, useRef } from 'react'
import { entryProgress } from '@/lib/scroll-progress'

/**
 * The turn. One line, its own screen, scroll-driven.
 *
 * It does not simply scroll past: the line drops and fades in as you enter, holds while the
 * section is on screen, then lifts and fades away as it leaves, handing off to the call to
 * action. Both halves run at every width.
 *
 * Framed as the cost of inaction stated as fact, not as pressure. No figure is quoted:
 * quantifying what a catalogue is "missing" walks back into the population-multiplier
 * claim the Monetization Thesis rules out, and a buyer deciding whether to trust us with
 * masters gets more cautious under pressure, not less.
 */
export default function S09bNow() {
  const trackRef = useRef<HTMLDivElement>(null)
  const lineRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const track = trackRef.current
    const line = lineRef.current
    if (!track || !line) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      line.style.opacity = '1'
      line.style.transform = 'none'
      return
    }

    let raf = 0
    let onScreen = false

    const measure = () => {
      const rect = track.getBoundingClientRect()
      const vh = window.innerHeight

      /**
       * The fade keys off the section ENTERING the viewport, not off progress through the
       * pinned track.
       *
       * Track progress is 0 at the moment the panel becomes stuck, and the panel already
       * fills the screen at that point, so an opacity of 0 there is a genuinely blank
       * screen. Measured at scroll 12000: track top 61px, panel filling the viewport,
       * line at opacity 0. Keying off entry means the line has already arrived by the
       * time the panel sticks.
       */
      const entry = entryProgress(rect, vh, 0.75)

      /**
       * The departure, keyed to the section's BOTTOM edge crossing the lower half of the
       * screen rather than to progress through the pinned track.
       *
       * This is the distinction that matters. Track progress is 0 at the moment the panel
       * sticks, when it still fills the whole screen, so fading against it produced a
       * genuinely blank screen. By the time the section's bottom edge has risen into the
       * lower half, the next section already occupies the space underneath, so there is
       * always something on screen to fade against. Safe at both breakpoints, which is why
       * this replaced the desktop-only drift.
       */
      const exitSpan = vh * 0.5
      const exit = exitSpan > 0 ? Math.min(1, Math.max(0, 1 - rect.bottom / exitSpan)) : 0

      line.style.opacity = (entry * (1 - exit)).toFixed(3)
      line.style.transform = `translate3d(0, ${((1 - entry) * 40 - exit * 34).toFixed(1)}px, 0)`

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
    io.observe(track)

    return () => {
      io.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <section aria-label="Your catalogue today">
      <div ref={trackRef} className="turn-track">
        <div className="turn-panel">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h2
              ref={lineRef}
              className="turn-line font-brand text-4xl leading-[1.1] tracking-tight text-balance sm:text-5xl lg:text-6xl"
            >
              Your catalogue is already working.
              <br />
              In only one language.
            </h2>
          </div>
        </div>
      </div>
    </section>
  )
}
