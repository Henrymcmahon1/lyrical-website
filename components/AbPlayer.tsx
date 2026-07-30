'use client'

import { useRef, useState } from 'react'

export type Demo = {
  source: string
  target: string
  artist: string
  title: string
  slug: string
  seconds: number
  hasAudio: boolean
}

/**
 * Original vs translated. Audio is `preload="none"` — nothing downloads until play.
 *
 * The gate: pressing play while locked calls `onLocked()` and plays nothing. The visitor
 * is told what is behind the gate (artist, pair, duration) BEFORE being asked for an
 * email, because this is the hardest gating option and it has to feel like a fair trade.
 */
export function AbPlayer({
  demo,
  unlocked,
  onLocked,
}: {
  demo: Demo | undefined
  unlocked: boolean
  onLocked: () => void
}) {
  const [side, setSide] = useState<'original' | 'translated'>('original')
  const [playing, setPlaying] = useState(false)
  const originalRef = useRef<HTMLAudioElement>(null)
  const translatedRef = useRef<HTMLAudioElement>(null)

  /**
   * Switching side stops playback here in the handler rather than in an effect — calling
   * setState synchronously in an effect body causes a cascading render. Switching PAIR is
   * handled by the parent giving this component a `key`, so it remounts with fresh state
   * and the old <audio> elements are torn down (which stops them).
   */
  const chooseSide = (next: 'original' | 'translated') => {
    if (next === side) return
    originalRef.current?.pause()
    translatedRef.current?.pause()
    setPlaying(false)
    setSide(next)
  }

  if (!demo || !demo.hasAudio) {
    return (
      <div className="mt-12 border border-dark-ink/15 px-6 py-8">
        <p className="text-sm text-dark-ink/65">
          A before-and-after for this pair isn&rsquo;t published yet.
        </p>
        <a
          href="#enquire"
          className="mt-4 inline-block border border-dark-accent px-5 py-3 text-sm text-dark-accent transition-colors hover:bg-dark-accent hover:text-dark-ground"
        >
          Ask to hear this pair
        </a>
      </div>
    )
  }

  const dir = `/audio/${demo.source.toLowerCase()}-${demo.target.toLowerCase()}`
  const active = side === 'original' ? originalRef : translatedRef

  const toggle = () => {
    if (!unlocked) {
      onLocked()
      return
    }
    const el = active.current
    if (!el) return
    const other = side === 'original' ? translatedRef.current : originalRef.current
    other?.pause()
    if (playing) {
      el.pause()
      setPlaying(false)
    } else {
      void el.play().catch(() => setPlaying(false))
      setPlaying(true)
    }
  }

  return (
    <div className="mt-12 flex flex-col items-center gap-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-dark-ink/55 tabular-nums">
        {demo.artist} &mdash; {demo.title} &middot; {demo.seconds}s excerpt
      </p>

      <div
        className="flex gap-px bg-dark-ink/20"
        role="group"
        aria-label="Choose which version to hear"
      >
        {(['original', 'translated'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => chooseSide(s)}
            aria-pressed={side === s}
            className={`px-5 py-2 text-sm transition-colors ${
              side === s
                ? 'bg-dark-accent text-dark-ground'
                : 'bg-dark-ground text-dark-ink/70 hover:text-dark-ink'
            }`}
          >
            {s === 'original' ? demo.source : demo.target}{' '}
            <span className="hidden sm:inline">{s}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={toggle}
        className="bg-dark-accent px-7 py-4 text-dark-ground transition-opacity hover:opacity-90"
      >
        {unlocked ? (playing ? 'Pause' : 'Play') : 'Unlock to listen'}
      </button>

      {!unlocked && (
        <p className="max-w-sm text-xs leading-relaxed text-dark-ink/50">
          One email unlocks every before-and-after on the site. We don&rsquo;t send
          newsletters.
        </p>
      )}

      <audio
        ref={originalRef}
        preload="none"
        src={`${dir}/${demo.slug}.original.mp3`}
        onEnded={() => setPlaying(false)}
      />
      <audio
        ref={translatedRef}
        preload="none"
        src={`${dir}/${demo.slug}.translated.mp3`}
        onEnded={() => setPlaying(false)}
      />
    </div>
  )
}
