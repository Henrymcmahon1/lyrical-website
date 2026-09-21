'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Keeps the studio list live while a self-serve job is still rendering. The page is a server
 * component, so a periodic `router.refresh()` re-runs its query and the status moves on its own
 * (queued -> rendering -> delivered) without the customer reloading. Stops polling once
 * everything has settled, so a quiet studio makes no requests.
 */
export function StudioAutoRefresh({ active }: { active: boolean }) {
  const router = useRouter()
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => router.refresh(), 12000)
    return () => clearInterval(id)
  }, [active, router])
  return null
}
