'use client'

import { useEffect, useState } from 'react'

/**
 * A small chevron saying "this continues below".
 *
 * Two callers, two reasons. The hero needs it because nothing on a first screen tells a
 * visitor there is anything under it. The pinned sections need it because a tester read the
 * changing cards as a carousel and swiped sideways, which does nothing.
 *
 * Both want the same thing afterwards: it should leave. A permanently animating arrow beside
 * the copy stops being a signpost and starts competing with what it points at.
 *
 * Two modes, chosen by whether `done` is passed:
 *
 * - **Controlled.** `PinnedStepper` already knows which step the reader is on, so it says
 *   when the cue has done its job.
 * - **Self managing.** The hero has no such state, so with no `done` prop the cue watches for
 *   any scroll at all and retires itself. Once retired it stays retired: scrolling back to the
 *   top does not reset it, because by then the visitor has demonstrably worked out the gesture.
 *
 * Positioning belongs to the parent, which only has to be a positioned ancestor. The CSS lives
 * in `globals.css` inside the reduced-motion query, which is also why this returns null under
 * `prefers-reduced-motion`: unstyled, it would fall into normal flow as a stray arrow.
 */
export function ScrollCue({ done }: { done?: boolean }) {
  const selfManaged = done === undefined
  const [scrolled, setScrolled] = useState(false)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: no-preference)')
    const sync = () => setAllowed(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (!selfManaged) return

    // `passive` because this never calls preventDefault, and a non-passive scroll listener
    // on the first screen is exactly where a janky page comes from.
    const onScroll = () => {
      if (window.scrollY > 40) setScrolled(true)
    }
    onScroll() // Somebody arriving at an anchor or restoring a scroll position is not new here.
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [selfManaged])

  if (!allowed) return null

  const finished = selfManaged ? scrolled : done

  return (
    <div className="scroll-cue" data-done={finished || undefined} aria-hidden="true">
      <svg viewBox="0 0 24 14" fill="none" className="h-3.5 w-6">
        <path
          d="M2 2 L12 11 L22 2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
