'use client'

import { useEffect, useRef } from 'react'
import { toPath } from '@/lib/mark'
import { APPROX } from '@/lib/mark-states'

const TOP = toPath(APPROX.top)
const BOTTOM = toPath(APPROX.bottom)

/**
 * Fly through the mark.
 *
 * The mark scales up and fades out as you scroll, while the statement behind it rises and
 * resolves. You pass through the logo into the next idea.
 *
 * WHY NOT A PUNCH-OUT. The obvious version is a full-bleed veil with the mark cut out of
 * it, scaled until the hole swallows the screen. That cannot work with this mark: the
 * approximation sign is two open strokes with NO enclosed counter, so its middle is the
 * gap between the waves. Centred content sits exactly in that gap, which is the opaque
 * part, so the screen renders as blank cream until the scale gets very large. Measured on
 * a 2560x1215 viewport, the gap covered the middle ~48% of the screen at scale 1.
 *
 * Two layers, both animated with transform and opacity only, so nothing is ever masked
 * and no scroll position can produce an empty screen.
 */
export function ZoomThroughMark({ children }: { children: React.ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const markRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const track = trackRef.current
    const mark = markRef.current
    const content = contentRef.current
    if (!track || !mark || !content) return

    const mq = window.matchMedia(
      '(min-width: 768px) and (prefers-reduced-motion: no-preference)',
    )
    const rest = () => {
      mark.style.opacity = '0'
      content.style.opacity = '1'
      content.style.transform = 'none'
    }
    if (!mq.matches) {
      rest()
      return
    }

    let raf = 0
    let onScreen = false

    const measure = () => {
      const rect = track.getBoundingClientRect()
      const scrollable = rect.height - window.innerHeight
      const p = scrollable > 0 ? Math.min(1, Math.max(0, -rect.top / scrollable)) : 1

      // The mark rushes toward the viewer and dissolves over the first 65%.
      const m = Math.min(1, p / 0.65)
      mark.style.transform = `scale(${(1 + m * m * 7).toFixed(3)})`
      mark.style.opacity = String(Math.max(0, 1 - m * 1.15))

      // The statement resolves from 30% onward, so the two never fight for attention.
      const c = Math.min(1, Math.max(0, (p - 0.3) / 0.45))
      content.style.opacity = String(c)
      content.style.transform = `scale(${(0.94 + c * 0.06).toFixed(3)})`

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
        {/* The mark you fly into. Decorative: the real mark is in the nav and footer. */}
        <div ref={markRef} className="zoom-mark" aria-hidden="true">
          <svg viewBox="0 0 64 64" width="240" height="240">
            <path d={TOP} fill="currentColor" />
            <path d={BOTTOM} fill="currentColor" />
          </svg>
        </div>

        <div ref={contentRef} className="zoom-content">
          {children}
        </div>
      </div>
    </div>
  )
}
