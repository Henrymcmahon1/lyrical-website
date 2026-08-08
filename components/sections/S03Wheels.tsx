'use client'

import { DriftingPairs } from '../DriftingPairs'

/**
 * The listening section.
 *
 * There is deliberately no player and no pair picker here. No demo audio is published
 * yet, so a button promising playback would collect somebody's details and then deliver
 * nothing, which is a worse first impression than not asking. Instead this captures the
 * request and promises a personal send, which is true today and starts a conversation
 * rather than a download.
 *
 * Audio drop-in is still wired: see content/demos.json and components/AbPlayer.tsx.
 */
export default function S03Wheels({
  requested,
  onRequest,
}: {
  requested: boolean
  onRequest: () => void
}) {
  return (
    <section id="hear" className="bg-dark-ground py-24 text-dark-ink sm:py-28">
      <div className="mx-auto flex max-w-4xl flex-col items-center px-6 text-center">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-dark-ink/50">
          Hear it
        </span>

        <h2 className="mt-5 font-brand text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
          There are no borders on your catalog.
        </h2>

        <p className="mt-6 max-w-xl leading-relaxed text-dark-ink/70">
          The melody, the phrasing and the backing stay exactly as they are. Only the
          language changes.
        </p>

        <div className="mt-14 w-full">
          <DriftingPairs />
        </div>

        {requested ? (
          <div className="mt-14 max-w-md">
            <p className="font-brand text-2xl leading-snug">Thank you.</p>
            <p className="mt-3 text-sm leading-relaxed text-dark-ink/65">
              We&rsquo;ll send examples through shortly, chosen for the languages you told
              us about.
            </p>
          </div>
        ) : (
          <div className="mt-14 flex flex-col items-center">
            <button
              type="button"
              onClick={onRequest}
              className="nudge rounded-card bg-dark-accent px-8 py-4 text-dark-ground"
            >
              Send me before and afters <span className="shift-arrow">&rarr;</span>
            </button>
            <p className="mt-5 max-w-sm text-xs leading-relaxed text-dark-ink/50">
              Tell us who you are and which languages matter to you, and we&rsquo;ll send
              examples across. No newsletter, and we don&rsquo;t pass your details on.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
