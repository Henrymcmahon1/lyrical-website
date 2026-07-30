'use client'

import { useEffect, useRef, useState } from 'react'
import { ROLES } from '@/lib/enquiry-schema'
import { LANGUAGES } from '@/lib/languages'

const ROLE_LABELS: Record<(typeof ROLES)[number], string> = {
  artist: 'An artist',
  manager: 'A manager',
  label: 'A label',
  publisher: 'A publisher',
  distributor: 'A distributor',
  other: 'Something else',
}

/**
 * Native <form method="post"> so it works with JavaScript disabled; JS upgrades it to
 * fetch for an inline success state.
 */
export function EnquiryForm({
  source,
  onSuccess,
  tone = 'light',
}: {
  source: string
  onSuccess?: () => void
  tone?: 'light' | 'dark'
}) {
  // Set in an effect, not during render: Date.now() is impure and would give the server
  // and the client different values, risking a hydration mismatch.
  const mountedAt = useRef(0)
  useEffect(() => {
    mountedAt.current = Date.now()
  }, [])

  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState('sending')
    setError('')

    const fd = new FormData(e.currentTarget)
    const body = {
      name: String(fd.get('name') ?? ''),
      email: String(fd.get('email') ?? ''),
      role: String(fd.get('role') ?? 'other'),
      company: String(fd.get('company') ?? ''),
      catalogue_size: String(fd.get('catalogue_size') ?? 'unsure'),
      target_languages: fd.getAll('target_languages').map(String),
      message: String(fd.get('message') ?? ''),
      source,
      unlocked_audio: source === 'gate',
      website: String(fd.get('website') ?? ''),
      // If the ref somehow never initialised, don't let a real person be treated as a bot.
      elapsed_ms: mountedAt.current ? Date.now() - mountedAt.current : 10_000,
    }

    try {
      const res = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setState('done')
        onSuccess?.()
        return
      }
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      setError(j.error ?? 'Something went wrong. Please email henry.jamcmahon@gmail.com.')
      setState('error')
    } catch {
      setError('We couldn’t reach the server. Please email henry.jamcmahon@gmail.com.')
      setState('error')
    }
  }

  const dark = tone === 'dark'
  const border = dark ? 'border-cream/30' : 'border-graphite/25'
  const muted = dark ? 'text-cream/60' : 'text-graphite/55'
  const field = `w-full rounded-card border ${border} bg-transparent px-4 py-3 outline-none transition-colors focus-visible:border-indigo`
  const chip = `nudge inline-flex min-h-11 cursor-pointer items-center rounded-card border ${border} px-3 text-sm transition-colors has-checked:border-ember has-checked:text-ember`

  if (state === 'done') {
    return (
      <div>
        <p className="font-brand text-2xl leading-snug">
          Thank you. We&rsquo;ll be in touch shortly.
        </p>
        <p className={`mt-3 text-sm ${muted}`}>
          If it&rsquo;s urgent, reach us directly at henry.jamcmahon@gmail.com.
        </p>
      </div>
    )
  }

  return (
    <form
      method="post"
      action="/api/enquiry"
      onSubmit={submit}
      className="flex flex-col gap-5"
    >
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="elapsed_ms" value={9999} />

      {/* Honeypot: kept in the layout but visually hidden, so bots still fill it. */}
      <div aria-hidden="true" className="absolute h-0 w-0 overflow-hidden opacity-0">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-sm">Your name</span>
        <input name="name" required minLength={2} autoComplete="name" className={field} />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className={field}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm">You are</span>
        <select name="role" required defaultValue="artist" className={field}>
          {ROLES.map((r) => (
            <option key={r} value={r} className="text-graphite">
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm">
          Company <span className={muted}>(optional)</span>
        </span>
        <input name="company" autoComplete="organization" className={field} />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm">How many songs?</span>
        <select name="catalogue_size" defaultValue="unsure" className={field}>
          <option value="1" className="text-graphite">One song</option>
          <option value="2-10" className="text-graphite">2&ndash;10</option>
          <option value="11-100" className="text-graphite">11&ndash;100</option>
          <option value="100+" className="text-graphite">100+</option>
          <option value="unsure" className="text-graphite">Not sure yet</option>
        </select>
      </label>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm">Languages you&rsquo;re interested in</legend>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.filter((l) => l.code !== 'EN').map((l) => (
            <label key={l.code} className={chip}>
              <input
                type="checkbox"
                name="target_languages"
                value={l.code}
                className="sr-only"
              />
              {l.endonym}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-2">
        <span className="text-sm">
          Anything else <span className={muted}>(optional)</span>
        </span>
        <textarea name="message" rows={4} className={field} />
      </label>

      {state === 'error' && (
        <p role="alert" className="text-sm text-ember">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={state === 'sending'}
        className="nudge self-start rounded-card bg-ember px-7 py-4 text-cream disabled:opacity-60"
      >
        {state === 'sending' ? 'Sending…' : 'Send enquiry'}
      </button>
    </form>
  )
}
