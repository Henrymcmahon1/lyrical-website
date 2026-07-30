'use client'

import { useEffect, useRef } from 'react'
import { toPath } from '@/lib/mark'
import { APPROX } from '@/lib/mark-states'

const TOP = toPath(APPROX.top)
const BOTTOM = toPath(APPROX.bottom)

/**
 * The signature transition: a full-bleed cream panel with the mark punched out of it,
 * scaled up until the hole swallows the screen and the section beneath is revealed
 * through the logo.
 *
 * Implemented as a TRANSFORM on an SVG group, not an animated clip-path: transforms stay
 * on the compositor, clip-path animation does not. The punch-out is an even-odd fill on a
 * rect plus the two mark paths, so there is exactly one painted element.
 *
 * Scoped to `.js-motion` + >=768px + no-reduced-motion in CSS. Everywhere else the track
 * collapses to nothing and the sections simply sit next to each other, so a phone or a
 * no-JS visitor loses a flourish, not any content.
 */
export function ZoomThroughMark({ children }: { children: React.ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const groupRef = useRef<SVGGElement>(null)

  useEffect(() => {
    const track = trackRef.current
    const group = groupRef.current
    if (!track || !group) return

    const mq = window.matchMedia(
      '(min-width: 768px) and (prefers-reduced-motion: no-preference)',
    )
    if (!mq.matches) return

    let raf = 0
    let onScreen = false

    const measure = () => {
      const rect = track.getBoundingClientRect()
      const scrollable = rect.height - window.innerHeight
      const p = scrollable > 0 ? Math.min(1, Math.max(0, -rect.top / scrollable)) : 0

      // The opening finishes at 72% of the track, so the revealed copy gets real dwell
      // time instead of the reader scrolling two screens to uncover one paragraph.
      const t = Math.min(1, p / 0.72)
      const eased = t * t
      // 1 -> 17 is comfortably past the point where the stroke covers a 21:9 viewport.
      const scale = 1 + eased * 16
      // Scaled about (32, 20), NOT the artboard centre. The mark is two open strokes with
      // no enclosed counter, so scaling about (32, 32) just pushes both waves apart and
      // expands the filled gap between them: the aperture never opens and the screen stays
      // blank. (32, 20) is the join between the upper wave's two Bezier segments, i.e. a
      // point INSIDE the stroke, so the stroke body is what grows to fill the viewport.
      group.setAttribute(
        'transform',
        `translate(32 20) scale(${scale.toFixed(3)}) translate(-32 -20)`,
      )
      // Fade the panel out over the last stretch so the reveal completes cleanly.
      track.style.setProperty('--veil', String(p > 0.62 ? Math.max(0, 1 - (p - 0.62) / 0.1) : 1))

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
    <div ref={trackRef} className="zoom-track">
      <div className="zoom-stage">
        <div className="zoom-content">{children}</div>

        {/* The veil: cream everywhere except the mark, which is a hole. */}
        <svg
          className="zoom-veil"
          viewBox="0 0 64 64"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <g ref={groupRef}>
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d={`M-400 -400 H 464 V 464 H -400 Z ${TOP} ${BOTTOM}`}
              fill="var(--color-cream)"
            />
          </g>
        </svg>
      </div>
    </div>
  )
}
