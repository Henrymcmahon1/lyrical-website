'use client'

import { useEffect } from 'react'
import Lenis from 'lenis'

/**
 * Lenis owns smooth scrolling. CSS `scroll-behavior: smooth` is deliberately not set —
 * see the note in globals.css. Disabled entirely under reduced motion.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const lenis = new Lenis({ duration: 1.1, smoothWheel: true })
    let id = 0
    const raf = (time: number) => {
      lenis.raf(time)
      id = requestAnimationFrame(raf)
    }
    id = requestAnimationFrame(raf)

    // Make in-page anchors work through Lenis.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a[href^="#"], a[href^="/#"]')
      if (!a) return
      const href = a.getAttribute('href') ?? ''
      const id2 = href.slice(href.indexOf('#') + 1)
      const target = id2 && document.getElementById(id2)
      if (!target) return
      e.preventDefault()
      lenis.scrollTo(target, { offset: -80 })
    }
    document.addEventListener('click', onClick)

    return () => {
      document.removeEventListener('click', onClick)
      cancelAnimationFrame(id)
      lenis.destroy()
    }
  }, [])

  return null
}
