'use client'

import { useEffect, useRef, useState } from 'react'
import { trackProgress } from '@/lib/scroll-progress'

export type Step = { h: string; p: string }

/**
 * A section that holds still while its steps advance, one idea on screen at a time.
 *
 * Pins at every width. The pinning itself is CSS, scoped to `.js-motion` and
 * `prefers-reduced-motion: no-preference`; this component only decides which step is active
 * and how far through the hold the reader is. With JavaScript off or motion reduced, none of
 * those rules exist and the steps render as an ordinary readable list.
 *
 * On a phone the heading arrives in normal flow ABOVE the track and scrolls away, and the
 * pinned panel carries a compact label instead. Keeping the full heading inside the panel
 * would eat roughly 40% of a 375px screen and leave the steps cramped, which is exactly what
 * the earlier mobile layout got wrong.
 */
export function PinnedStepper({
  eyebrow,
  title,
  intro,
  steps,
  numbered = true,
  startAt = 1,
}: {
  eyebrow?: string
  title: string
  intro?: string
  steps: Step[]
  numbered?: boolean
  /** 0 lets a precondition sit at step 00 rather than renumbering the real sequence. */
  startAt?: number
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLElement>(null)
  const [active, setActive] = useState(0)
  const [pinned, setPinned] = useState(false)

  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    // Pinning is no longer gated on width. It runs wherever motion is allowed.
    const mq = window.matchMedia('(prefers-reduced-motion: no-preference)')

    let raf = 0
    let onScreen = false

    const measure = () => {
      const rect = track.getBoundingClientRect()
      const p = trackProgress(rect, window.innerHeight)

      setActive(Math.min(steps.length - 1, Math.floor(p * steps.length * 0.999)))

      // Written straight to the node rather than through state: this changes every frame and
      // React does not need to re-render for a transform.
      if (barRef.current) barRef.current.style.setProperty('--p', p.toFixed(4))

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

    const sync = () => setPinned(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    io.observe(track)

    return () => {
      mq.removeEventListener('change', sync)
      io.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [steps.length])

  const heading = (
    <>
      {eyebrow && (
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite/45">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-4 font-brand text-4xl leading-tight tracking-tight text-balance">
        {title}
      </h2>
      {intro && <p className="mt-5 max-w-sm text-graphite/70">{intro}</p>}
    </>
  )

  return (
    <>
      {/* Mobile: the headline arrives at full size in normal flow, then hands over to the pin. */}
      <div className="mx-auto max-w-6xl px-6 pb-12 md:hidden">{heading}</div>

      <div
        ref={trackRef}
        className="pin-track"
        style={{ '--steps': steps.length } as React.CSSProperties}
      >
        <div className="pin-panel">
          {/* Mobile only. Proof that scrolling is still doing something while the panel holds. */}
          <div className="pin-progress" aria-hidden="true">
            <i ref={barRef} />
          </div>

          <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 md:grid-cols-[minmax(0,22rem)_1fr] md:gap-20">
            <div className="hidden md:block">
              {heading}

              <ol className="mt-10 flex gap-3" aria-hidden="true">
                {steps.map((s, i) => (
                  <li
                    key={s.h}
                    className={`pin-dot h-px w-10 ${
                      pinned && i === active ? 'bg-indigo' : 'bg-graphite/20'
                    }`}
                  />
                ))}
              </ol>
            </div>

            <div>
              {/* The compact label the heading hands over to, plus where the reader is. */}
              {eyebrow && (
                <p className="mb-8 flex items-baseline justify-between gap-4 font-mono text-[11px] uppercase tracking-[0.18em] text-graphite/45 md:hidden">
                  <span>{eyebrow}</span>
                  <span className="tabular-nums text-indigo">
                    {String(active + startAt).padStart(2, '0')}
                    <span className="text-graphite/30">
                      {' / '}
                      {String(steps.length - 1 + startAt).padStart(2, '0')}
                    </span>
                  </span>
                </p>
              )}

              <ul className="pin-stack flex flex-col gap-12 md:gap-0">
                {steps.map((s, i) => (
                  <li
                    key={s.h}
                    className="pin-item"
                    data-active={pinned ? i === active : undefined}
                  >
                    {numbered && (
                      <span className="font-mono text-xs tracking-[0.18em] text-indigo tabular-nums">
                        {String(i + startAt).padStart(2, '0')}
                      </span>
                    )}
                    <h3 className="mt-3 font-brand text-3xl leading-tight tracking-tight md:text-4xl">
                      {s.h}
                    </h3>
                    <p className="mt-4 max-w-md text-lg leading-relaxed text-graphite/75">
                      {s.p}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
