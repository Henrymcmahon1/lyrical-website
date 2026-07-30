'use client'

import { useId, useState } from 'react'
import { LANGUAGES } from '@/lib/languages'
import { Mark } from './Mark'

const ITEM_H = 46
const VISIBLE = 3

/**
 * One reel. A real listbox — arrow keys and Home/End work, selection is announced.
 *
 * The reel LANDS and HOLDS on a language. It never spins indefinitely: perpetual motion
 * would imply unlimited capability, and we support eight languages, not all of them.
 */
function Reel({
  label,
  index,
  onChange,
}: {
  label: string
  index: number
  onChange: (i: number) => void
}) {
  const labelId = useId()
  const last = LANGUAGES.length - 1

  return (
    <div className="flex flex-col items-center gap-3">
      <span
        id={labelId}
        className="font-mono text-[10px] uppercase tracking-[0.18em] text-dark-ink/50"
      >
        {label}
      </span>

      <ul
        role="listbox"
        aria-labelledby={labelId}
        aria-activedescendant={`${labelId}-opt-${index}`}
        tabIndex={0}
        /* 7rem on mobile: two reels + the mark + gaps must fit inside 390px minus px-6. */
        className="relative h-[138px] w-[7rem] overflow-hidden text-center outline-none sm:w-40"
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            onChange(index === last ? 0 : index + 1)
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            onChange(index === 0 ? last : index - 1)
          } else if (e.key === 'Home') {
            e.preventDefault()
            onChange(0)
          } else if (e.key === 'End') {
            e.preventDefault()
            onChange(last)
          }
        }}
      >
        <div
          className="transition-transform duration-700 ease-[cubic-bezier(.16,.84,.34,1)]"
          style={{ transform: `translateY(${Math.floor(VISIBLE / 2) * ITEM_H - index * ITEM_H}px)` }}
        >
          {LANGUAGES.map((l, i) => (
            <li
              key={l.code}
              id={`${labelId}-opt-${i}`}
              role="option"
              aria-selected={i === index}
              onClick={() => onChange(i)}
              style={{ height: ITEM_H }}
              className={`flex cursor-pointer items-center justify-center font-brand text-lg transition-colors sm:text-2xl ${
                i === index ? 'text-dark-ink' : 'text-dark-ink/25'
              }`}
            >
              {l.endonym}
            </li>
          ))}
        </div>
      </ul>
    </div>
  )
}

export function Wheels({
  onPair,
}: {
  onPair: (source: string, target: string) => void
}) {
  const [si, setSi] = useState(0)
  const [ti, setTi] = useState(1)

  const change = (which: 'source' | 'target') => (i: number) => {
    const nextS = which === 'source' ? i : si
    const nextT = which === 'target' ? i : ti
    if (which === 'source') setSi(i)
    else setTi(i)
    onPair(LANGUAGES[nextS].code, LANGUAGES[nextT].code)
  }

  return (
    <div>
      <div className="flex items-center justify-center gap-3 sm:gap-10">
        <Reel label="From" index={si} onChange={change('source')} />
        <Mark size={48} className="h-9 w-9 shrink-0 text-dark-accent sm:h-12 sm:w-12" />
        <Reel label="Into" index={ti} onChange={change('target')} />
      </div>

      <p aria-live="polite" className="sr-only">
        {LANGUAGES[si].english} to {LANGUAGES[ti].english}
      </p>

      <p className="mt-8 font-brand text-xl text-dark-ink/70">
        {LANGUAGES[si].endonym} <span className="text-dark-accent">&#8776;</span>{' '}
        {LANGUAGES[ti].endonym}
      </p>
    </div>
  )
}
