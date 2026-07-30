'use client'

import { useEffect, useRef } from 'react'
import { EnquiryForm } from './EnquiryForm'

export function EnquiryOverlay({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)

    const previous = document.activeElement as HTMLElement | null
    box.current?.querySelector<HTMLInputElement>('input[name="name"]')?.focus()

    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-graphite/75 p-4 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gate-title"
        className="my-8 w-full max-w-lg rounded-card bg-cream p-6 sm:p-8"
      >
        <div className="flex items-start justify-between gap-6">
          <h2
            id="gate-title"
            className="font-brand text-2xl leading-tight tracking-tight text-balance"
          >
            Tell us who you are, and we&rsquo;ll send examples across.
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mt-1 text-3xl leading-none text-graphite/60 hover:text-graphite"
          >
            &times;
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-graphite/70">
          Pick the languages that matter to you and we&rsquo;ll send before-and-afters
          chosen for them. A real person sends these, so tell us anything useful. We
          don&rsquo;t send newsletters and we don&rsquo;t pass your details on.
        </p>

        <div className="mt-6">
          <EnquiryForm source="gate" onSuccess={onSuccess} />
        </div>
      </div>
    </div>
  )
}
