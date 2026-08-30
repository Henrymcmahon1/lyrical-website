'use client'

import { useEffect, useRef } from 'react'

/**
 * The Turnstile widget.
 *
 * Renders Cloudflare's challenge and hands the resulting token up to the form, which sends it to
 * a server action for verification. This component only produces the token; it never decides
 * whether to trust it. See `lib/turnstile.ts` for the half that does.
 *
 * Renders NOTHING when there is no site key, which is what makes the whole feature config-gated:
 * with the key absent the form has no widget and behaves exactly as before.
 *
 * ## Loading the script
 *
 * The API script is injected once and shared across every widget on the page. It is loaded with
 * `render=explicit` so nothing renders until we ask, which lets us place the widget in a specific
 * element and hold its id for cleanup. `challenges.cloudflare.com` is allowed in the CSP
 * (script-src, frame-src and connect-src) in `next.config.ts`.
 *
 * ## Token freshness
 *
 * A token lasts about five minutes. `refresh-expired: 'auto'` re-challenges before it lapses, so
 * a long upload does not submit a stale token. If one still expires, `onExpire` clears it and the
 * server rejects the submit, and the customer retries.
 */

type TurnstileApi = {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string
      callback: (token: string) => void
      'expired-callback'?: () => void
      'error-callback'?: () => void
      'refresh-expired'?: 'auto' | 'manual' | 'never'
      action?: string
    },
  ) => string
  remove: (id: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
    onTurnstileLoad?: () => void
  }
}

const SCRIPT_ID = 'cf-turnstile-script'
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

/** Resolve once `window.turnstile` is available, loading the script the first time. */
function loadTurnstile(): Promise<TurnstileApi> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) {
      resolve(window.turnstile)
      return
    }

    const finish = () => {
      if (window.turnstile) resolve(window.turnstile)
      else reject(new Error('Turnstile loaded but the global is missing'))
    }

    const existing = document.getElementById(SCRIPT_ID)
    if (existing) {
      existing.addEventListener('load', finish, { once: true })
      existing.addEventListener('error', () => reject(new Error('Turnstile failed to load')), {
        once: true,
      })
      return
    }

    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.addEventListener('load', finish, { once: true })
    script.addEventListener('error', () => reject(new Error('Turnstile failed to load')), {
      once: true,
    })
    document.head.appendChild(script)
  })
}

export function Turnstile({
  siteKey,
  onVerify,
  onExpire,
  action,
}: {
  siteKey: string | null
  /** Called with a fresh token whenever the challenge is solved. */
  onVerify: (token: string) => void
  /** Called when the current token expires, so the form can clear it. */
  onExpire?: () => void
  /** Optional label Cloudflare shows in its analytics, e.g. "sign-in" or "submit". */
  action?: string
}) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // No key means the feature is off: render nothing and do not load the script.
    if (!siteKey || !ref.current) return

    let widgetId: string | null = null
    let cancelled = false
    const el = ref.current

    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !el) return
        widgetId = turnstile.render(el, {
          sitekey: siteKey,
          callback: onVerify,
          'expired-callback': () => onExpire?.(),
          'error-callback': () => onExpire?.(),
          'refresh-expired': 'auto',
          action,
        })
      })
      .catch(() => {
        // Script blocked or failed. The server verifier fails open on an unreachable Cloudflare,
        // so a customer who cannot load the widget is not stuck: they just get no challenge.
        if (!cancelled) onExpire?.()
      })

    return () => {
      cancelled = true
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId)
        } catch {
          // Already gone; nothing to clean up.
        }
      }
    }
    // siteKey/action are stable for a given form; the callbacks are wrapped by the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey, action])

  if (!siteKey) return null
  return <div ref={ref} className="min-h-[65px]" />
}
