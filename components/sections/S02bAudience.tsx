'use client'

import { useEffect, useRef, useState } from 'react'
import { lerpOutline, toPath } from '@/lib/mark'
import { APPROX, EQUAL } from '@/lib/mark-states'
import { LANGUAGES } from '@/lib/languages'
import { trackProgress } from '@/lib/scroll-progress'
import { Mark } from '../Mark'

const FRAMES = 30

/** Precomputed once: frame 0 is the pause bars, the last frame is the canonical mark. */
const TOP = Array.from({ length: FRAMES + 1 }, (_, i) =>
  toPath(lerpOutline(EQUAL.top, APPROX.top, i / FRAMES)),
)
const BOTTOM = Array.from({ length: FRAMES + 1 }, (_, i) =>
  toPath(lerpOutline(EQUAL.bottom, APPROX.bottom, i / FRAMES)),
)

const OTHERS = LANGUAGES.filter((l) => l.code !== 'EN')

/**
 * "Your audience today" becoming "your audience with Lyrical", driven by scroll.
 * The pause symbol rotates and bends into the mark as you pass through the section,
 * and one language blooms into eight.
 *
 * Expressed in LANGUAGE NAMES, never listener or population figures: the Monetization
 * Thesis is explicit that population numbers are an internal prioritisation heuristic
 * and must never be presented as a claim about reach.
 *
 * Both states are in the DOM and CSS decides which is visible, so with JavaScript off
 * the section renders its RESOLVED state (the meaningful one) rather than freezing on
 * the "before" half with seven languages stuck at opacity 0.
 */
export default function S02bAudience() {
  const trackRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const groupRef = useRef<SVGGElement>(null)
  const topRef = useRef<SVGPathElement>(null)
  const botRef = useRef<SVGPathElement>(null)
  const [after, setAfter] = useState(false)

  useEffect(() => {
    const track = trackRef.current
    const group = groupRef.current
    const top = topRef.current
    const bot = botRef.current
    if (!track || !group || !top || !bot) return

    const settle = () => {
      group.setAttribute('transform', 'rotate(0 32 32)')
      top.setAttribute('d', TOP[FRAMES])
      bot.setAttribute('d', BOTTOM[FRAMES])
      setAfter(true)
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      settle()
      return
    }

    /**
     * One clock, at every width.
     *
     * The section pins on a phone as well now, so `.audience-track` always has real height to
     * measure and track progress is meaningful everywhere. That removes the mobile-only entry
     * driver and, with it, the split between the mark morphing on one clock and the copy
     * resolving on another: the reader holds still while both resolve together, which is what
     * the pin was for.
     */
    let raf = 0
    let onScreen = false
    let lastFrame = -1

    const measure = () => {
      const rect = track.getBoundingClientRect()
      const p = trackProgress(rect, window.innerHeight)

      // First 45% rotates the pause upright; the rest bends it into the mark.
      const rot = -90 + 90 * Math.min(1, p / 0.45)
      group.setAttribute('transform', `rotate(${rot.toFixed(2)} 32 32)`)

      const morph = Math.min(1, Math.max(0, (p - 0.45) / 0.55))
      const frame = Math.round(morph * FRAMES)
      if (frame !== lastFrame) {
        lastFrame = frame
        top.setAttribute('d', TOP[frame])
        bot.setAttribute('d', BOTTOM[frame])
      }
      setAfter(p > 0.62)

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
    <section aria-label="What Lyrical changes about your audience">
      <div ref={trackRef} className="audience-track" data-after={after}>
        <div className="audience-panel">
          <div className="mx-auto w-full max-w-4xl px-6 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite/45">
              <span className="a-before">Your audience today</span>
              <span className="a-after">Your audience with Lyrical</span>
            </p>

            {/*
              This panel is a fixed `100vh - nav`, so its content cannot be allowed to grow
              past it: anything taller is clipped rather than scrolled, and what got clipped
              was the last paragraph. On a 375x667 screen the content came to 704px against a
              607px panel.

              So the mark and the vertical rhythm both shrink on small screens and return to
              full size from `sm` up. The type is untouched, because this section is the
              emotional turn of the page and shrinking the headline to buy space would cost
              more than the space is worth.
            */}
            <div className="mt-6 flex justify-center text-indigo [&_svg]:h-20 [&_svg]:w-20 sm:mt-10 sm:[&_svg]:h-[132px] sm:[&_svg]:w-[132px]">
              {/* Animated mark: only shown once JS has opted in. */}
              <svg
                ref={svgRef}
                viewBox="0 0 64 64"
                width={132}
                height={132}
                className="a-anim"
                role="img"
                aria-label="A pause symbol becoming the Lyrical mark"
              >
                <g ref={groupRef} transform="rotate(-90 32 32)">
                  <path ref={topRef} d={TOP[0]} fill="currentColor" />
                  <path ref={botRef} d={BOTTOM[0]} fill="currentColor" />
                </g>
              </svg>
              {/* Static fallback: the resolved mark, for no-JS. */}
              <span className="a-static">
                <Mark size={132} title="The Lyrical mark" />
              </span>
            </div>

            <h2 className="mt-6 font-brand text-4xl leading-tight tracking-tight text-balance sm:mt-10 sm:text-5xl">
              <span className="a-before">Everyone who happens to speak the language.</span>
              <span className="a-after">Everyone who was always going to love it.</span>
            </h2>

            {/* One language becomes eight. Names, never numbers. */}
            <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:mt-10 sm:gap-y-3">
              <li className="font-brand text-xl sm:text-3xl">English</li>
              {OTHERS.map((l, i) => (
                <li
                  key={l.code}
                  className="a-bloom font-brand text-xl sm:text-3xl"
                  style={{ transitionDelay: `${i * 70}ms` }}
                >
                  {l.endonym}
                </li>
              ))}
            </ul>

            <p className="mt-6 text-graphite/70 sm:mt-10">
              <span className="a-before">
                A finished record, available everywhere, built for one language.
              </span>
              <span className="a-after">
                The same record, authorized in eight languages, in the artist&rsquo;s own
                voice.
              </span>
            </p>

            {/*
              The one surviving line of the old problem section. Without it nothing on the
              page explains why this has not simply been done already, which is what
              justifies the price.
            */}
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-graphite/55 sm:mt-6">
              Until now that meant re-recording: the artist, a studio, a translator and an
              engineer, weeks per song. So it only ever happened for the biggest releases.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
