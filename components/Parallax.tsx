'use client'

import { useEffect, useRef } from 'react'

/**
 * Scroll parallax. Writes a Y offset to a CSS custom property, which the `.parallax`
 * class turns into a translate3d — so the work stays on the compositor and never
 * touches layout.
 *
 * Only runs while the element is on screen (IntersectionObserver gates the rAF loop),
 * and not at all under reduced motion or on coarse pointers, where the effect mostly
 * reads as jitter.
 *
 * `speed` is the fraction of scroll distance to offset by. Keep it small — 0.04 to 0.12
 * reads as depth; anything more reads as a broken layout.
 */
export function Parallax({
  children,
  speed = 0.08,
  className = '',
}: {
  children: React.ReactNode
  speed?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !window.matchMedia('(pointer: fine)').matches
    ) {
      return
    }

    let raf = 0
    let visible = false

    const update = () => {
      const rect = el.getBoundingClientRect()
      // Distance of the element's centre from the viewport centre, normalised.
      const centre = rect.top + rect.height / 2 - window.innerHeight / 2
      el.style.setProperty('--py', `${(-centre * speed).toFixed(2)}px`)
      raf = visible ? requestAnimationFrame(update) : 0
    }

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? false
        if (visible && !raf) raf = requestAnimationFrame(update)
        if (!visible && raf) {
          cancelAnimationFrame(raf)
          raf = 0
        }
      },
      { rootMargin: '120px 0px' },
    )
    io.observe(el)

    return () => {
      io.disconnect()
      if (raf) cancelAnimationFrame(raf)
      el.style.removeProperty('--py')
    }
  }, [speed])

  return (
    <div ref={ref} className={`parallax ${className}`}>
      {children}
    </div>
  )
}
