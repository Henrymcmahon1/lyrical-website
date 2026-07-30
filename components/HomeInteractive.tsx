'use client'

import { useState } from 'react'
import S03Wheels from './sections/S03Wheels'
import { EnquiryOverlay } from './EnquiryOverlay'

/**
 * Holds the "has this visitor asked for examples" state.
 *
 * The server reads the signed cookie and passes `initiallyRequested`, so somebody who has
 * already asked is thanked rather than asked again.
 *
 * The underlying column is still `unlocked_audio`: it was named when this was an audio
 * gate, and renaming it would need a migration for no behavioural gain. It means "this
 * person asked to hear examples", which is what it always recorded.
 */
export function HomeInteractive({
  initiallyRequested,
}: {
  initiallyRequested: boolean
}) {
  const [requested, setRequested] = useState(initiallyRequested)
  const [open, setOpen] = useState(false)

  return (
    <>
      <S03Wheels requested={requested} onRequest={() => setOpen(true)} />
      <EnquiryOverlay
        open={open}
        onClose={() => setOpen(false)}
        onSuccess={() => {
          setRequested(true)
          setOpen(false)
        }}
      />
    </>
  )
}
