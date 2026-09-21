'use client'

import { useRef, useState } from 'react'

/** Original against the new-language version, one at a time. No gate: the section is public and the URLs are server-signed. Native controls so a listener can scrub both to the same bar; preload none. */
export function CoffeyPlayer({ originalUrl, coverUrl }: { originalUrl: string; coverUrl: string }) {
  const [side, setSide] = useState<'original' | 'cover'>('original')
  const originalRef = useRef<HTMLAudioElement>(null)
  const coverRef = useRef<HTMLAudioElement>(null)
  const choose = (next: 'original' | 'cover') => {
    if (next === side) return
    originalRef.current?.pause()
    coverRef.current?.pause()
    setSide(next)
  }
  const tab = (s: 'original' | 'cover') => `min-h-11 px-5 text-sm transition-colors ${side === s ? 'bg-dark-accent text-dark-ground' : 'bg-dark-ground text-dark-ink/70 hover:text-dark-ink'}`
  return (
    <div className="mt-10 flex w-full max-w-xl flex-col items-center gap-6">
      <div className="flex gap-px overflow-hidden rounded-card bg-dark-ink/20" role="group" aria-label="Choose which version to hear">
        <button type="button" onClick={() => choose('original')} aria-pressed={side === 'original'} className={tab('original')}>The original</button>
        <button type="button" onClick={() => choose('cover')} aria-pressed={side === 'cover'} className={tab('cover')}>The new language</button>
      </div>
      <audio ref={originalRef} controls preload="none" src={originalUrl} className={side === 'original' ? 'w-full' : 'hidden'} aria-label="Coffey Anderson, the original" />
      <audio ref={coverRef} controls preload="none" src={coverUrl} className={side === 'cover' ? 'w-full' : 'hidden'} aria-label="Coffey Anderson, re-sung in the new language" />
    </div>
  )
}
