'use client'

import { useState } from 'react'
import { getDeliveredCoverUrl } from '@/app/studio/self-serve-actions'
import { button, link } from '@/components/studio/ui'

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
        <a href={url} download className={`w-fit ${link}`}>
          Download
        </a>
      </div>
    )
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button type="button" onClick={load} disabled={loading} className={button.primary}>
        {loading ? 'Loading…' : 'Play the cover'}
      </button>
      {error && <span className="font-product text-sm text-dark-ink/60">{error}</span>}
    </div>
  )
}
