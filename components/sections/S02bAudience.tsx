'use client'

import { useEffect, useRef, useState } from 'react'
import { lerpOutline, toPath } from '@/lib/mark'
import { APPROX, EQUAL } from '@/lib/mark-states'
import { LANGUAGES } from '@/lib/languages'
import { entryProgress, trackProgress } from '@/lib/scroll-progress'
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
     * The driver depends on whether the section has a sticky track to measure.
     *
     * Above 768px `.audience-track` is 190vh and the panel pins, so progress through that
     * track is the right clock. Below it there is no track: the section is its own content
     * height, which measured 704px inside an 812px viewport, so `rect.height - innerHeight`
     * is NEGATIVE and track progress is forced to 1 at every scroll position. The morph
     * therefore landed on its final frame the instant the section came into view and never
     * animated.
     *
     * Below the breakpoint the clock is entry progress measured on the MARK, not on the
     * section. The mark sits about 176px inside the section, so keying to the section top
     * meant the mark did not cross the bottom edge until progress was already 0.26 — the
     * first 43% of the rotation happened off screen and the reader never saw the pause bars
     * at all. Measuring the mark itself puts the whole morph on screen, and it stays correct
     * if the section's padding ever changes.
     */
    const MOBILE_SPAN = 0.7

    /**
     * On a phone the shape and the words resolve on two different clocks, deliberately.
     *
     * The mark morphs as it crosses the screen, which is the only window where it is actually
     * visible. Measured at 375x812: the section is 896px inside an 812px viewport, so it can
     * never be fully on screen at once, and by the moment its bottom reaches the fold the mark
     * has already travelled to -111px. Driving the morph from that point put the entire bend
     * phase off screen.
     *
     * The copy and the language bloom wait. They hold on "Everyone who happens to speak the
     * language" until the bottom of the section has cleared the fold, so the original line has
     * been read in full before it is replaced, and a little further scrolling commits it.
     */
    const RESOLVE_MARGIN = 48
    const wideMq = window.matchMedia('(min-width: 768px)')
    let wide = wideMq.matches
    const syncWide = () => {
      wide = wideMq.matches
    }
    wideMq.addEventListener('change', syncWide)

    let raf = 0
    let onScreen = false
    let lastFrame = -1

    const measure = () => {
      const rect = track.getBoundingClientRect()
      const vh = window.innerHeight
      let p: number
      let resolved: boolean
      if (wide) {
        p = trackProgress(rect, vh)
        resolved = p > 0.62
      } else {
        // Fall back to the track if the mark has no box yet (pre-layout first frame).
        const markRect = svgRef.current?.getBoundingClientRect()
        const from = markRect && markRect.height > 0 ? markRect : rect
        p = entryProgress(from, vh, MOBILE_SPAN)
        resolved = rect.bottom <= vh - RESOLVE_MARGIN
      }

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
      setAfter(resolved)

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
    <section aria-label="What Lyrical changes about your audience">
      <div ref={trackRef} className="audience-track" data-after={after}>
        <div className="audience-panel">
          <div className="mx-auto w-full max-w-4xl px-6 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite/45">
              <span className="a-before">Your audience today</span>
              <span className="a-after">Your audience with Lyrical</span>
            </p>

            <div className="mt-10 flex justify-center text-indigo">
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

            <h2 className="mt-10 font-brand text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
              <span className="a-before">Everyone who happens to speak the language.</span>
              <span className="a-after">Everyone who was always going to love it.</span>
            </h2>

            {/* One language becomes eight. Names, never numbers. */}
            <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
              <li className="font-brand text-2xl sm:text-3xl">English</li>
              {OTHERS.map((l, i) => (
                <li
                  key={l.code}
                  className="a-bloom font-brand text-2xl sm:text-3xl"
                  style={{ transitionDelay: `${i * 70}ms` }}
                >
                  {l.endonym}
                </li>
              ))}
            </ul>

            <p className="mt-10 text-graphite/70">
              <span className="a-before">
                A finished record, available everywhere, built for one language.
              </span>
              <span className="a-after">
                The same record, authorised in eight languages, in the artist&rsquo;s own
                voice.
              </span>
            </p>

            {/*
              The one surviving line of the old problem section. Without it nothing on the
              page explains why this has not simply been done already, which is what
              justifies the price.
            */}
            <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-graphite/55">
              Until now that meant re-recording: the artist, a studio, a translator and an
              engineer, weeks per song. So it only ever happened for the biggest releases.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
