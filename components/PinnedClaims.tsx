'use client'

import { useEffect, useRef, useState } from 'react'
import { trackProgress } from '@/lib/scroll-progress'

export type Claim = { h: string; p: string }

/**
 * A section that holds still while its claims advance.
 *
 * Same contract as PinnedStepper: the pinning is CSS scoped to `.js-motion` and
 * `prefers-reduced-motion: no-preference`, and it now runs at every width. This component
 * only tracks which claim is active and how far through the hold the reader is. Outside that
 * intersection every claim renders in normal flow and `data-active` is ignored.
 *
 * On a phone the heading arrives above the track and scrolls away, handing over to a compact
 * label inside the panel. `label` is that short form: a shortening of the heading rather than
 * a new claim, so it says nothing the section does not already say.
 */
export function PinnedClaims({
  claims,
  label,
}: {
  claims: Claim[]
  /** Compact form of the heading, shown inside the pinned panel on mobile. */
  label?: string
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLElement>(null)
  const [active, setActive] = useState(0)
  const [pinned, setPinned] = useState(false)

  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    const mq = window.matchMedia('(prefers-reduced-motion: no-preference)')

    let raf = 0
    let onScreen = false

    const measure = () => {
      const rect = track.getBoundingClientRect()
      const p = trackProgress(rect, window.innerHeight)

      // Bias slightly so the last claim gets real dwell time at the end of the track.
      setActive(Math.min(claims.length - 1, Math.floor(p * claims.length * 0.999)))
      if (barRef.current) barRef.current.style.setProperty('--p', p.toFixed(4))

      raf = onScreen ? requestAnimationFrame(measure) : 0
    }

    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries[0]?.isIntersecting ?? false
        if (onScreen && !raf) raf = requestAnimationFrame(measure)
        if (!onScreen && raf) {
          cancelAnimationFrame(raf)
          raf = 0
        }
      },
      { rootMargin: '0px' },
    )

    const sync = () => setPinned(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    io.observe(track)

    return () => {
      mq.removeEventListener('change', sync)
      io.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [claims.length])

  const heading = (
    <>
      <h2 className="font-brand text-4xl leading-tight tracking-tight text-balance">
        What changes is the language. Nothing else.
      </h2>
      <p className="mt-5 max-w-sm text-graphite/70">
        Every stage is measured against the original record, and every song is checked by ear
        before it reaches you.
      </p>
    </>
  )

  return (
    <>
      {/* Mobile: the headline arrives at full size, then hands over to the pinned panel. */}
      <div className="mx-auto max-w-6xl px-6 pb-12 md:hidden">{heading}</div>

      <div ref={trackRef} className="pin-track" style={{ '--steps': claims.length } as React.CSSProperties}>
        <div className="pin-panel">
          <div className="pin-progress" aria-hidden="true">
            <i ref={barRef} />
          </div>

          <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 md:grid-cols-2 md:gap-20">
            <div className="hidden md:block">
              {heading}

              {/* Progress dots double as a "you are here" cue while the section is pinned. */}
              <ol className="mt-10 flex gap-3" aria-hidden="true">
                {claims.map((c, i) => (
                  <li
                    key={c.h}
                    className={`pin-dot h-px w-10 ${
                      pinned && i === active ? 'bg-indigo' : 'bg-graphite/20'
                    }`}
                  />
                ))}
              </ol>
            </div>

            <div>
              {label && (
                <p className="mb-8 flex items-baseline justify-between gap-4 font-mono text-[11px] uppercase tracking-[0.18em] text-graphite/45 md:hidden">
                  <span>{label}</span>
                  <span className="tabular-nums text-indigo">
                    {String(active + 1).padStart(2, '0')}
                    <span className="text-graphite/30">
                      {' / '}
                      {String(claims.length).padStart(2, '0')}
                    </span>
                  </span>
                </p>
              )}

              <ul className="pin-stack flex flex-col gap-12 md:gap-0">
                {claims.map((c, i) => (
                  <li
                    key={c.h}
                    className="pin-item"
                    data-active={pinned ? i === active : undefined}
                  >
                    <span className="font-mono text-xs tracking-[0.18em] text-indigo">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <h3 className="mt-3 font-brand text-2xl tracking-tight md:text-3xl">{c.h}</h3>
                    <p className="mt-3 max-w-md leading-relaxed text-graphite/75">{c.p}</p>
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
