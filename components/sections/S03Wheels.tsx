'use client'

import { useMemo, useState } from 'react'
import { Wheels } from '../Wheels'
import { AbPlayer, type Demo } from '../AbPlayer'
import raw from '@/content/demos.json'

/**
 * Audio file convention — drop files in and flip `hasAudio` in content/demos.json:
 *   public/audio/{source}-{target}/{slug}.original.mp3
 *   public/audio/{source}-{target}/{slug}.translated.mp3
 * The pair folder is lowercase, e.g. public/audio/en-es/my-track.original.mp3
 */
const demos = raw as Demo[]

export default function S03Wheels({
  unlocked,
  onLocked,
}: {
  unlocked: boolean
  onLocked: () => void
}) {
  const [pair, setPair] = useState({ source: 'EN', target: 'ES' })

  const demo = useMemo(
    () => demos.find((d) => d.source === pair.source && d.target === pair.target),
    [pair],
  )

  return (
    <section id="hear" className="bg-dark-ground py-24 text-dark-ink sm:py-28">
      <div className="mx-auto flex max-w-4xl flex-col items-center px-6 text-center">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-dark-ink/50">
          Hear it
        </span>

        <h2 className="mt-5 font-brand text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
          Choose a pair. Hear the same performance twice.
        </h2>

        <p className="mt-6 max-w-xl leading-relaxed text-dark-ink/70">
          The melody, the phrasing and the backing are identical. Only the language changes.
        </p>

        <div className="mt-14 w-full">
          <Wheels onPair={(source, target) => setPair({ source, target })} />
        </div>

        {/* key on the pair: remounting tears down the old <audio>, so changing language
            can never leave a previous track playing underneath. */}
        <AbPlayer
          key={`${pair.source}-${pair.target}`}
          demo={demo}
          unlocked={unlocked}
          onLocked={onLocked}
        />
      </div>
    </section>
  )
}
