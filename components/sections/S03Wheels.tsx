'use client'

import { useMemo, useState } from 'react'
import { DriftingPairs } from '../DriftingPairs'
import { AbPlayer, type Demo } from '../AbPlayer'
import { LANGUAGES } from '@/lib/languages'
import raw from '@/content/demos.json'

/**
 * Audio file convention, drop files in and flip `hasAudio` in content/demos.json:
 *   public/audio/{source}-{target}/{slug}.original.mp3
 *   public/audio/{source}-{target}/{slug}.translated.mp3
 * The pair folder is lowercase, e.g. public/audio/en-es/my-track.original.mp3
 */
const demos = raw as Demo[]

/** Only pairs we can actually play are offered as choices. */
const PLAYABLE = demos.filter((d) => d.hasAudio)

export default function S03Wheels({
  unlocked,
  onLocked,
}: {
  unlocked: boolean
  onLocked: () => void
}) {
  const options = PLAYABLE.length ? PLAYABLE : demos
  const [slug, setSlug] = useState(options[0]?.slug ?? '')
  const demo = useMemo(() => options.find((d) => d.slug === slug), [options, slug])

  const label = (d: Demo) => {
    const s = LANGUAGES.find((l) => l.code === d.source)?.endonym ?? d.source
    const t = LANGUAGES.find((l) => l.code === d.target)?.endonym ?? d.target
    return `${s} ≈ ${t}`
  }

  return (
    <section id="hear" className="bg-dark-ground py-24 text-dark-ink sm:py-28">
      <div className="mx-auto flex max-w-4xl flex-col items-center px-6 text-center">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-dark-ink/50">
          Hear it
        </span>

        <h2 className="mt-5 font-brand text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
          There are no borders on your catalogue.
        </h2>

        <p className="mt-6 max-w-xl leading-relaxed text-dark-ink/70">
          The melody, the phrasing and the backing stay exactly as they are. Only the
          language changes.
        </p>

        <div className="mt-14 w-full">
          <DriftingPairs />
        </div>

        {/* The player is its own control now, sitting below the ambient reels. */}
        {options.length > 1 && (
          <div
            className="mt-12 flex flex-wrap justify-center gap-2"
            role="group"
            aria-label="Choose a language pair"
          >
            {options.map((d) => (
              <button
                key={d.slug}
                type="button"
                onClick={() => setSlug(d.slug)}
                aria-pressed={d.slug === slug}
                className={`nudge rounded-card border px-4 py-2 text-sm transition-colors ${
                  d.slug === slug
                    ? 'border-dark-accent text-dark-accent'
                    : 'border-dark-ink/25 text-dark-ink/65 hover:text-dark-ink'
                }`}
              >
                {label(d)}
              </button>
            ))}
          </div>
        )}

        <AbPlayer
          key={slug}
          demo={demo}
          unlocked={unlocked}
          onLocked={onLocked}
        />
      </div>
    </section>
  )
}
