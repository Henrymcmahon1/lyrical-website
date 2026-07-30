'use client'

import { useEffect, useState, type RefObject } from 'react'

/**
 * Position indicator for a scroll-snap carousel, mobile only.
 *
 * A horizontal scroller with no indicator reads as a truncated list rather than a swipeable
 * one, and the whole point of the carousel is to save height without hiding anything. The
 * dots are the affordance that says there is more to the right.
 *
 * Driven by `scrollLeft` rather than an IntersectionObserver: the container is the scroll
 * root here, not the viewport, so viewport intersection says nothing useful about which
 * card is showing.
 *
 * Decorative. The cards themselves are the content and remain readable and reachable by
 * keyboard, so this is hidden from assistive technology.
 */
export function CarouselDots({
  scrollerRef,
  count,
  className = '',
}: {
  scrollerRef: RefObject<HTMLElement | null>
  count: number
  className?: string
}) {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const el = scrollerRef.current
    if (!el || count < 2) return

    const read = () => {
      // Width of one card plus its gap, derived rather than hard-coded so it survives a
      // change to the card width in the markup.
      const step = el.scrollWidth / count
      if (step <= 0) return
      setActive(Math.max(0, Math.min(count - 1, Math.round(el.scrollLeft / step))))
    }

    read()
    el.addEventListener('scroll', read, { passive: true })
    window.addEventListener('resize', read)
    return () => {
      el.removeEventListener('scroll', read)
      window.removeEventListener('resize', read)
    }
  }, [scrollerRef, count])

  if (count < 2) return null

  return (
    <ol aria-hidden="true" className={`flex gap-2 md:hidden ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <li
          key={i}
          className={`h-px w-7 transition-colors duration-300 ${
            i === active ? 'bg-indigo' : 'bg-graphite/20'
          }`}
        />
      ))}
    </ol>
  )
}
