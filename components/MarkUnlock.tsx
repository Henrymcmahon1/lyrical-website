'use client'

import { useEffect, useRef } from 'react'
import { lerpOutline, toPath } from '@/lib/mark'
import { APPROX, EQUAL } from '@/lib/mark-states'

const ROTATE_MS = 640
const HOLD_MS = 200
const MORPH_MS = 920
const FRAMES = 30

/**
 * Morph frames are precomputed ONCE at module scope, so the animation costs an array
 * lookup per frame instead of regenerating two ~1.5 KB path strings 60 times a second.
 * Frame 0 is the bars; the final frame is byte-identical to the canonical mark
 * (asserted in tests/mark.test.ts).
 */
const TOP_FRAMES = Array.from({ length: FRAMES + 1 }, (_, i) =>
  toPath(lerpOutline(EQUAL.top, APPROX.top, i / FRAMES)),
)
const BOTTOM_FRAMES = Array.from({ length: FRAMES + 1 }, (_, i) =>
  toPath(lerpOutline(EQUAL.bottom, APPROX.bottom, i / FRAMES)),
)

const ease = (x: number) => 1 - Math.pow(1 - x, 3)

/**
 * The Unlock — the one sanctioned animation of the mark.
 *
 *   Beat 1  ‖   two vertical bars     the catalog, paused at a language border
 *   Beat 2  =   rotated to horizontal "equals" — naive translation
 *   Beat 3  ≈   bars bend into waves  what Lyrical actually delivers
 *
 * The DOM is written directly through refs rather than through React state: this runs at
 * first paint, and 100+ re-renders there is the difference between smooth and janky on a
 * mid-range phone. Rotation is a transform (compositor); the morph is an attribute swap.
 */
export function MarkUnlock({ size = 156 }: { size?: number }) {
  const groupRef = useRef<SVGGElement>(null)
  const topRef = useRef<SVGPathElement>(null)
  const bottomRef = useRef<SVGPathElement>(null)
  const raf = useRef(0)

  useEffect(() => {
    const group = groupRef.current
    const top = topRef.current
    const bottom = bottomRef.current
    if (!group || !top || !bottom) return

    const settle = () => {
      group.setAttribute('transform', 'rotate(0 32 32)')
      top.setAttribute('d', TOP_FRAMES[FRAMES])
      bottom.setAttribute('d', BOTTOM_FRAMES[FRAMES])
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      settle()
      return
    }

    let start = 0
    let lastFrame = -1

    const tick = (now: number) => {
      if (!start) start = now
      const e = now - start

      if (e < ROTATE_MS) {
        const r = -90 + 90 * ease(e / ROTATE_MS)
        group.setAttribute('transform', `rotate(${r.toFixed(2)} 32 32)`)
      } else if (e < ROTATE_MS + HOLD_MS) {
        group.setAttribute('transform', 'rotate(0 32 32)')
      } else {
        const p = Math.min(1, (e - ROTATE_MS - HOLD_MS) / MORPH_MS)
        const frame = Math.round(ease(p) * FRAMES)
        if (frame !== lastFrame) {
          lastFrame = frame
          top.setAttribute('d', TOP_FRAMES[frame])
          bottom.setAttribute('d', BOTTOM_FRAMES[frame])
        }
        if (p >= 1) {
          settle()
          return
        }
      }
      raf.current = requestAnimationFrame(tick)
    }

    /**
     * Start on first visibility, not on mount. A link opened in a background tab
     * (ctrl-click from an email or a deck) would otherwise skip the animation entirely:
     * rAF is paused while hidden, so by the time the visitor looked, the elapsed clock
     * would already be past the end.
     */
    const begin = () => {
      start = 0
      raf.current = requestAnimationFrame(tick)
    }

    if (document.visibilityState === 'visible') {
      begin()
      return () => cancelAnimationFrame(raf.current)
    }

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      document.removeEventListener('visibilitychange', onVisible)
      begin()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      cancelAnimationFrame(raf.current)
    }
  }, [])

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label="The Lyrical mark: a pause resolving into an approximation"
    >
      {/* Server-rendered as the pause state, so there is no flash of the final mark. */}
      <g ref={groupRef} transform="rotate(-90 32 32)">
        <path ref={topRef} d={TOP_FRAMES[0]} fill="currentColor" />
        <path ref={bottomRef} d={BOTTOM_FRAMES[0]} fill="currentColor" />
      </g>
    </svg>
  )
}
