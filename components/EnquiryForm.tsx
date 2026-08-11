'use client'

import { useEffect, useRef, useState } from 'react'
import { CONTACT_EMAIL, enquiryMailto } from '@/lib/enquiry-email'
import { ROLES } from '@/lib/enquiry-schema'
import { LANGUAGES } from '@/lib/languages'

/*
 * The "what can we help with?" radio is gone, 2026-08-11.
 *
 * Its two options were "I'd like to hear examples" and "I'd like to talk about a project", and
 * the first one was the same promise as the "Send me before and afters" button Henry removed.
 * Leaving it here would have meant the site still offering samples on the one page most likely
 * to be read by somebody deciding whether to trust us.
 *
 * `unlocked_audio` stays in the database and on the CSV export. It holds real history from
 * every enquiry made while that question existed, and dropping the column would destroy it to
 * tidy up a form. Nothing writes `true` to it any more.
 */

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

  /**
   * A prefilled mailto carrying everything they just typed.
   *
   * Set only when the enquiry could not be delivered and therefore was not recorded: a 5xx,
   * or the request never reaching the server. In those cases telling somebody to "email us
   * instead" while discarding what they wrote is how a lead is lost, so the way out has to
   * carry the answers with it. A 400 is a field they can fix, and gets no fallback.
   */
  const [fallbackHref, setFallbackHref] = useState('')

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState('sending')
    setError('')
    setFallbackHref('')

    const fd = new FormData(e.currentTarget)
    const body = {
      name: String(fd.get('name') ?? ''),
      email: String(fd.get('email') ?? ''),
      // Blank rather than a guessed default. The schema maps an unanswered select to the
      // right thing per column; inventing 'artist' or 'unsure' here would write a value the
      // visitor never chose and it would read as fact in the inbox.
      role: String(fd.get('role') ?? ''),
      company: String(fd.get('company') ?? ''),
      catalogue_size: String(fd.get('catalogue_size') ?? ''),
      target_languages: fd.getAll('target_languages').map(String),
      message: String(fd.get('message') ?? ''),
      source,
      // Always false since the examples request was removed. Sent explicitly rather than
      // omitted so the server keeps validating a boolean it has always received.
      unlocked_audio: false,
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
      setError(j.error ?? 'Something went wrong.')
      if (res.status >= 500) setFallbackHref(enquiryMailto(body, CONTACT_EMAIL))
      setState('error')
    } catch {
      setError('We couldn’t reach the server.')
      setFallbackHref(enquiryMailto(body, CONTACT_EMAIL))
      setState('error')
    }
  }

  const dark = tone === 'dark'
  const border = dark ? 'border-cream/30' : 'border-graphite/25'
  const muted = dark ? 'text-cream/60' : 'text-graphite/55'
  const field = `w-full rounded-card border ${border} bg-transparent px-4 py-3 outline-none transition-colors focus-visible:border-indigo`
  const chip = `nudge inline-flex min-h-11 cursor-pointer items-center rounded-card border ${border} px-3 text-sm transition-colors has-checked:border-ember has-checked:text-ember`

  /**
   * Filed with the other optional questions.
   *
   * It used to be rendered twice, because the removed examples overlay put it beside the email
   * where picking a language WAS the request. There is one form now, and somebody filling it in
   * has already decided to make contact, so the languages can be settled in the reply.
   */
  const languages = (
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
  )

  if (state === 'done') {
    return (
      <div>
        <p className="font-brand text-2xl leading-snug">
          Thank you. We&rsquo;ll be in touch shortly.
        </p>
        <p className={`mt-3 text-sm ${muted}`}>
          If it&rsquo;s urgent, reach us directly at {CONTACT_EMAIL}.
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

      {
        /*
         * Everything optional, collapsed.
         *
         * A native <details> rather than a JavaScript disclosure, because this form has to
         * submit with JavaScript disabled and inputs inside a CLOSED <details> are still
         * submitted. Collapsing them costs nothing and the visitor first sees two inputs and
         * a button instead of six fields.
         */
        <details className={`group border-y ${border}`}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm [&::-webkit-details-marker]:hidden">
            <span>
              Add more detail <span className={muted}>(optional)</span>
            </span>

            {/* A plus that becomes a minus. Two spans, not a rotated glyph, which sits
                visibly off centre at this size. Matches the folds on /about. */}
            <span
              aria-hidden="true"
              className="relative h-3 w-3 shrink-0 transition-transform duration-300 group-open:rotate-90"
            >
              <span className="absolute left-0 top-1/2 h-px w-3 -translate-y-1/2 bg-current" />
              <span className="absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 bg-current transition-opacity duration-300 group-open:opacity-0" />
            </span>
          </summary>

          <div className="flex flex-col gap-5 pb-6">
            <label className="flex flex-col gap-2">
              <span className="text-sm">You are</span>
              {/* Defaults to blank, not to 'artist'. A pre-selected answer nobody chose
                  arrives in the inbox looking like something they told you. */}
              <select name="role" defaultValue="" className={field}>
                <option value="" className="text-graphite">
                  Prefer not to say
                </option>
                {ROLES.map((r) => (
                  <option key={r} value={r} className="text-graphite">
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm">Company</span>
              <input name="company" autoComplete="organization" className={field} />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm">How many songs?</span>
              <select name="catalogue_size" defaultValue="" className={field}>
                <option value="" className="text-graphite">Prefer not to say</option>
                <option value="1" className="text-graphite">One song</option>
                <option value="2-10" className="text-graphite">2&ndash;10</option>
                <option value="11-100" className="text-graphite">11&ndash;100</option>
                <option value="100+" className="text-graphite">100+</option>
                <option value="unsure" className="text-graphite">Not sure yet</option>
              </select>
            </label>

            {languages}

            <label className="flex flex-col gap-2">
              <span className="text-sm">Anything else</span>
              <textarea name="message" rows={4} className={field} />
            </label>
          </div>
        </details>
      }

      {state === 'error' && (
        <div role="alert" className="flex flex-col gap-3">
          <p className="text-sm text-ember">{error}</p>
          {fallbackHref && (
            <div className="flex flex-col gap-2">
              <a
                href={fallbackHref}
                className="nudge inline-flex min-h-11 items-center self-start rounded-card border border-indigo px-5 text-indigo transition-colors hover:bg-indigo hover:text-cream"
              >
                Send it as an email instead <span className="shift-arrow">&rarr;</span>
              </a>
              <p className={`text-sm ${muted}`}>
                Opens your mail app with everything you just typed already filled in. Nothing
                you wrote is lost.
              </p>
            </div>
          )}
        </div>
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
