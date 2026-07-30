'use client'

import { useEffect, useRef } from 'react'
import { entryProgress, trackProgress } from '@/lib/scroll-progress'

/**
 * The turn. One line, its own screen, scroll-driven.
 *
 * It does not simply scroll past: the line drops and fades in as you enter, holds while
 * the section is pinned, then lifts away as you leave, handing off to the call to action.
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

    /**
     * The arrival runs at every width. It is keyed to the section entering the viewport,
     * which needs no sticky track, so a phone gets the same drop-in that desktop does.
     *
     * The departure does not. `drift` lifts the line away as the pinned panel releases, and
     * below 768px nothing pins, so there is nothing to lift away from — the section simply
     * scrolls off. Applying it there would just be a constant offset.
     */
    const wideMq = window.matchMedia('(min-width: 768px)')
    let wide = wideMq.matches
    const syncWide = () => {
      wide = wideMq.matches
    }
    wideMq.addEventListener('change', syncWide)

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

      // Once it has arrived it HOLDS. No fade-out: the panel scrolling away under the
      // next section is the transition, and fading here would blank the screen again.
      const drift = wide ? Math.max(0, (trackProgress(rect, vh) - 0.7) / 0.3) * 14 : 0

      line.style.opacity = String(entry)
      line.style.transform = `translate3d(0, ${((1 - entry) * 40 - drift).toFixed(1)}px, 0)`

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
      wideMq.removeEventListener('change', syncWide)
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
