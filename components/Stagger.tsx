'use client'

import { useEffect, useRef } from 'react'

/**
 * Staggered pop-in. Direct children rise in sequence rather than together.
 *
 * Same safety contract as Reveal: the animation only exists under `.js-motion`, so with
 * JavaScript disabled the children are simply visible.
 */
export function Stagger({
  children,
  as: Tag = 'div',
  className = '',
}: {
  children: React.ReactNode
  as?: 'div' | 'ul' | 'ol'
  className?: string
}) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      typeof IntersectionObserver === 'undefined'
    ) {
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
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    )
    io.observe(el)

    // Never let a missed observer leave content hidden.
    const failsafe = window.setTimeout(() => el.classList.add('in'), 3000)

    return () => {
      window.clearTimeout(failsafe)
      io.disconnect()
    }
  }, [])

  const Component = Tag as React.ElementType
  return (
    <Component ref={ref} className={`stagger ${className}`}>
      {children}
    </Component>
  )
}
