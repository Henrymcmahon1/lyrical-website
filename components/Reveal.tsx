'use client'

import { useEffect, useRef } from 'react'

/**
 * Scroll reveal, driven by IntersectionObserver.
 *
 * The animation only exists when `<html class="js-motion">` is present, which an inline
 * script in the layout sets before first paint. So the no-JS state is "fully visible",
 * and nothing can strand body copy at opacity 0.
 */
export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Reduced motion: the global media query collapses the duration, but make it explicit.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('in')
      return
    }

    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('in')
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add('in')
            io.unobserve(el)
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    )

    io.observe(el)

    // Safety net: if anything prevents the observer from ever firing, reveal regardless.
    const failsafe = window.setTimeout(() => el.classList.add('in'), 3000)

    return () => {
      window.clearTimeout(failsafe)
      io.disconnect()
    }
  }, [])

  return (
    <div
      ref={ref}
      className={`reveal ${className}`}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  )
}
