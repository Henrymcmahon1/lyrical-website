'use client'

import { Turnstile } from '@/components/Turnstile'
import { turnstileSiteKey } from '@/lib/turnstile'

/**
 * The bot guard for a plain server-action `<form>` (issue #392): the Turnstile widget plus a
 * honeypot, in one drop-in. The widget writes its token into the form as the hidden field
 * `cf-turnstile-response`, so the server action reads it from the FormData with no client
 * callback. `lib/form-guard.ts` checks both on the server.
 *
 * The honeypot is the same pattern as the enquiry form: kept in the layout but invisible and out
 * of the tab order, so a person never fills it and a naive bot does.
 */
export function FormGuard({ action }: { action: string }) {
  return (
    <>
      <div aria-hidden="true" className="absolute h-0 w-0 overflow-hidden opacity-0">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      <Turnstile siteKey={turnstileSiteKey()} action={action} />
    </>
  )
}
