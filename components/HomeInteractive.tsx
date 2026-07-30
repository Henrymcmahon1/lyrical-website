'use client'

import { useState } from 'react'
import S03Wheels from './sections/S03Wheels'
import { EnquiryOverlay } from './EnquiryOverlay'

/**
 * Holds the unlock state for the wheels. The server reads the signed cookie and passes
 * `initiallyUnlocked`, so a returning visitor is never re-gated.
 */
export function HomeInteractive({
  initiallyUnlocked,
}: {
  initiallyUnlocked: boolean
}) {
  const [unlocked, setUnlocked] = useState(initiallyUnlocked)
  const [open, setOpen] = useState(false)

  return (
    <>
      <S03Wheels unlocked={unlocked} onLocked={() => setOpen(true)} />
      <EnquiryOverlay
        open={open}
        onClose={() => setOpen(false)}
        onSuccess={() => {
          setUnlocked(true)
          setOpen(false)
        }}
      />
    </>
  )
}
