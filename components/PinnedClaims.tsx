'use client'

import { useEffect, useRef, useState } from 'react'

export type Claim = { h: string; p: string }

/**
 * A section that pins while its claims advance.
 *
 * The pinning is CSS, scoped to `.js-motion` + >=768px + no-reduced-motion (see
 * globals.css). This component only tracks which claim is active. Outside that
 * intersection every claim is rendered in normal flow and `data-active` is ignored,
 * so a phone or a no-JS visitor gets a plain readable list and can never be trapped
 * in a tall empty track.
 */
export function PinnedClaims({ claims }: { claims: Claim[] }) {
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
      if (scrollable <= 0) {
        setActive(0)
      } else {
        const progress = Math.min(1, Math.max(0, -rect.top / scrollable))
        // Bias slightly so the last claim gets real dwell time at the end of the track.
        const i = Math.min(claims.length - 1, Math.floor(progress * claims.length * 0.999))
        setActive(i)
      }
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
  }, [claims.length])

  return (
    <div ref={trackRef} className="pin-track">
      <div className="pin-panel">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 md:grid-cols-2 md:gap-20">
          <div>
            <h2 className="font-brand text-4xl leading-tight tracking-tight text-balance">
              What changes is the language. Nothing else.
            </h2>
            <p className="mt-5 max-w-sm text-graphite/70">
              Every stage is measured against the original record, and every song is checked
              by ear before it reaches you.
            </p>

            {/* Progress dots double as a "you are here" cue while the section is pinned. */}
            <ol className="mt-10 hidden gap-3 md:flex" aria-hidden="true">
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
                <h3 className="mt-3 font-brand text-2xl tracking-tight md:text-3xl">
                  {c.h}
                </h3>
                <p className="mt-3 max-w-md leading-relaxed text-graphite/75">{c.p}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
