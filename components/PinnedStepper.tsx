'use client'

import { useEffect, useRef, useState } from 'react'

export type Step = { h: string; p: string }

/**
 * A section that holds while its steps advance, one idea on screen at a time.
 *
 * Same safety contract as PinnedClaims: the pinning lives in CSS scoped to `.js-motion`
 * AND >=768px AND no-reduced-motion. Outside that intersection the steps render as an
 * ordinary list, so a phone or a no-JS visitor reads all of them normally and can never
 * be trapped in a tall empty track.
 */
export function PinnedStepper({
  eyebrow,
  title,
  intro,
  steps,
  numbered = true,
}: {
  eyebrow?: string
  title: string
  intro?: string
  steps: Step[]
  numbered?: boolean
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [pinned, setPinned] = useState(false)

  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    const mq = window.matchMedia(
      '(min-width: 768px) and (prefers-reduced-motion: no-preference)',
    )

    let raf = 0
    let onScreen = false

    const measure = () => {
      const rect = track.getBoundingClientRect()
      const scrollable = rect.height - window.innerHeight
      if (scrollable > 0) {
        const p = Math.min(1, Math.max(0, -rect.top / scrollable))
        setActive(Math.min(steps.length - 1, Math.floor(p * steps.length * 0.999)))
      }
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

    const sync = () => {
      setPinned(mq.matches)
      if (!mq.matches) setActive(0)
    }
    sync()
    mq.addEventListener('change', sync)
    io.observe(track)

    return () => {
      mq.removeEventListener('change', sync)
      io.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [steps.length])

  return (
    <div ref={trackRef} className="pin-track" style={{ '--steps': steps.length } as React.CSSProperties}>
      <div className="pin-panel">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 md:grid-cols-[minmax(0,22rem)_1fr] md:gap-20">
          <div>
            {eyebrow && (
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite/45">
                {eyebrow}
              </p>
            )}
            <h2 className="mt-4 font-brand text-4xl leading-tight tracking-tight text-balance">
              {title}
            </h2>
            {intro && <p className="mt-5 max-w-sm text-graphite/70">{intro}</p>}

            <ol className="mt-10 hidden gap-3 md:flex" aria-hidden="true">
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

          <ul className="pin-stack flex flex-col gap-12 md:gap-0">
            {steps.map((s, i) => (
              <li
                key={s.h}
                className="pin-item"
                data-active={pinned ? i === active : undefined}
              >
                {numbered && (
                  <span className="font-mono text-xs tracking-[0.18em] text-indigo tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                )}
                <h3 className="mt-3 font-brand text-3xl leading-tight tracking-tight md:text-4xl">
                  {s.h}
                </h3>
                <p className="mt-4 max-w-md text-lg leading-relaxed text-graphite/75">{s.p}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
