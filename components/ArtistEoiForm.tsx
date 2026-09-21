'use client'

import { useEffect, useRef, useState } from 'react'
import { Turnstile } from '@/components/Turnstile'
import { CONTACT_EMAIL, enquiryMailto } from '@/lib/enquiry-email'
import { CATALOGUE_SIZES } from '@/lib/enquiry-schema'
import {
  EOI_ROLES,
  EoiSchema,
  STREAM_BANDS,
  STREAM_BAND_LABELS,
  toEnquiry,
} from '@/lib/eoi-schema'
import { LANGUAGES } from '@/lib/languages'

const ROLE_LABELS: Record<(typeof EOI_ROLES)[number], string> = {
  artist: 'The artist',
  manager: 'A manager',
  label: 'A label',
  other: 'Something else',
}
const SIZE_LABELS: Record<(typeof CATALOGUE_SIZES)[number], string> = {
  '1': 'One song',
  '2-10': '2 to 10',
  '11-100': '11 to 100',
  '100+': '100 or more',
  unsure: 'Not sure yet',
}
const field =
  'w-full rounded-card border border-graphite/25 bg-transparent px-4 py-3 outline-none transition-colors focus-visible:border-indigo'
// Indigo, not ember, for the checked state and the error line: both are small text on cream,
// and ember never carries body text (3.2:1). Fills and large type only.
const chip =
  'nudge inline-flex min-h-11 cursor-pointer items-center rounded-card border border-graphite/25 px-3 text-sm transition-colors has-checked:border-indigo has-checked:text-indigo'
const opt = 'text-graphite'

const ERROR_FROM_QUERY = 'Something in the form did not look right. Please check it and send again.'

/**
 * Native <form method="post" action="/artists/eoi"> so it submits with JavaScript disabled;
 * JS upgrades it to a JSON post to /api/enquiry, the EnquiryForm pattern, with the mapping
 * done by toEnquiry so both paths write the identical row.
 */
export function ArtistEoiForm({
  siteKey,
  initialState,
}: {
  siteKey: string | null
  initialState?: 'sent' | 'error'
}) {
  // Set in an effect, not during render: Date.now() is impure and would give the server
  // and the client different values, risking a hydration mismatch.
  const mountedAt = useRef(0)
  useEffect(() => {
    mountedAt.current = Date.now()
  }, [])

  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>(
    initialState === 'sent' ? 'done' : initialState === 'error' ? 'error' : 'idle',
  )
  const [error, setError] = useState(initialState === 'error' ? ERROR_FROM_QUERY : '')
  const [fallbackHref, setFallbackHref] = useState('')
  const [token, setToken] = useState('')

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState('sending')
    setError('')
    setFallbackHref('')
    const fd = new FormData(e.currentTarget)
    const parsed = EoiSchema.safeParse({
      ...Object.fromEntries(fd.entries()),
      target_languages: fd.getAll('target_languages').map(String),
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check the form.')
      setState('error')
      return
    }
    const body = {
      ...toEnquiry(parsed.data),
      website: String(fd.get('website') ?? ''),
      elapsed_ms: mountedAt.current ? Date.now() - mountedAt.current : 10_000,
      turnstile_token: token,
    }
    try {
      const res = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setState('done')
        return
      }
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      setError(j.error ?? 'Something went wrong.')
      if (res.status >= 500) setFallbackHref(enquiryMailto(body, CONTACT_EMAIL))
      setState('error')
    } catch {
      setError('We could not reach the server.')
      setFallbackHref(enquiryMailto(body, CONTACT_EMAIL))
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <div>
        <p className="font-brand text-2xl leading-snug">
          Thank you. A person will reply within one working day.
        </p>
        <p className="mt-3 text-sm text-graphite/55">
          We will ask which song to start with and which language first. If it is urgent, reach
          us at {CONTACT_EMAIL}.
        </p>
      </div>
    )
  }

  return (
    <form method="post" action="/artists/eoi" onSubmit={submit} className="flex flex-col gap-5">
      <input type="hidden" name="elapsed_ms" value={9999} />
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
        <span className="text-sm">Artist or act</span>
        <input name="artistName" required className={field} />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm">Email</span>
        <input name="email" type="email" required autoComplete="email" className={field} />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm">You are</span>
        <select name="role" defaultValue="" className={field}>
          <option value="" className={opt}>
            Prefer not to say
          </option>
          {EOI_ROLES.map((r) => (
            <option key={r} value={r} className={opt}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm">Songs in the catalog</span>
        <select name="catalogue_size" defaultValue="" className={field}>
          <option value="" className={opt}>
            Prefer not to say
          </option>
          {CATALOGUE_SIZES.map((s) => (
            <option key={s} value={s} className={opt}>
              {SIZE_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm">Monthly streams across all platforms</span>
        <select name="monthlyStreamsBand" required defaultValue="" className={field}>
          <option value="" disabled className={opt}>
            Choose a band
          </option>
          {STREAM_BANDS.map((b) => (
            <option key={b} value={b} className={opt}>
              {STREAM_BAND_LABELS[b]}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm">Languages you want</legend>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.filter((l) => l.code !== 'EN').map((l) => (
            <label key={l.code} className={chip}>
              <input type="checkbox" name="target_languages" value={l.code} className="sr-only" />
              {l.endonym}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-2">
        <span className="text-sm">
          Links{' '}
          <span className="text-graphite/55">
            (up to 3, one per line: streaming profile, socials, a release)
          </span>
        </span>
        <textarea name="links" rows={3} className={field} />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm">Anything else</span>
        <textarea name="message" rows={4} className={field} />
      </label>

      <Turnstile
        siteKey={siteKey}
        action="artist-eoi"
        onVerify={setToken}
        onExpire={() => setToken('')}
      />

      {state === 'error' && (
        <div role="alert" className="flex flex-col gap-3">
          <p className="text-sm text-indigo">{error}</p>
          {fallbackHref && (
            <a
              href={fallbackHref}
              className="nudge inline-flex min-h-11 items-center gap-1.5 self-start rounded-card border border-indigo px-5 text-indigo transition-colors hover:bg-indigo hover:text-cream"
            >
              Send it as an email instead <span className="shift-arrow">&rarr;</span>
            </a>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={state === 'sending'}
        className="nudge min-h-11 self-start rounded-card bg-ember px-7 py-4 text-cream disabled:opacity-60"
      >
        {state === 'sending' ? 'Sending' : 'Send'}
      </button>
    </form>
  )
}
