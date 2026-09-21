'use client'

import { useState } from 'react'
import { getDeliveredCoverUrl } from '@/app/studio/self-serve-actions'

/**
 * Plays a delivered cover in the studio. The URL is fetched on demand (a signed, short-lived
 * link minted server-side) rather than embedded in the page, so nothing leaks a playable link
 * into the initial HTML and the link cannot go stale before it is used.
 */
export function CoverPlayer({ jobId }: { jobId: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    const u = await getDeliveredCoverUrl(jobId)
    setLoading(false)
    if (u) setUrl(u)
    else setError('That cover is not ready to play yet.')
  }

  if (url) {
    return (
      <div className="mt-4 flex flex-col gap-2">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption -- a music cover has no captions */}
        <audio controls src={url} className="w-full" />
        <a href={url} download className="text-sm text-indigo underline underline-offset-4">
          Download
        </a>
      </div>
    )
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={load}
        disabled={loading}
        className="nudge inline-flex min-h-11 items-center gap-1.5 rounded-card bg-ember px-6 py-3 text-sm text-cream disabled:opacity-50"
      >
        {loading ? 'Loading…' : 'Play the cover'}
      </button>
      {error && <span className="ml-3 text-sm text-graphite/60">{error}</span>}
    </div>
  )
}
