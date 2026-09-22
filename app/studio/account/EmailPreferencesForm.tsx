'use client'

import { useActionState } from 'react'
import { saveEmailPreferencesForm, type EmailPreferencesResult } from './actions'
import { button } from '@/components/studio/ui'

/**
 * Two toggles, one form, `useActionState` so it posts with or without JavaScript (matching
 * FeedbackBar.tsx). `available` comes from `lib/account-data.ts`'s `getEmailPreferences`: false
 * means Bot 1's migration 004 has not landed yet, so the toggles show today's default (opted
 * in) and saving reports the same "not turned on yet" message the action itself returns.
 */
export function EmailPreferencesForm({
  productEmails,
  ratingReminders,
  available,
}: {
  productEmails: boolean
  ratingReminders: boolean
  available: boolean
}) {
  const [result, action, pending] = useActionState<EmailPreferencesResult | null, FormData>(
    saveEmailPreferencesForm,
    null,
  )

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex items-start gap-3">
        <input type="checkbox" name="productEmails" defaultChecked={productEmails} className="mt-1 size-4 shrink-0 accent-dark-accent" />
        <span className="font-product text-sm leading-relaxed text-dark-ink/80">
          Product emails: tips and updates about the studio.
        </span>
      </label>
      <label className="flex items-start gap-3">
        <input type="checkbox" name="ratingReminders" defaultChecked={ratingReminders} className="mt-1 size-4 shrink-0 accent-dark-accent" />
        <span className="font-product text-sm leading-relaxed text-dark-ink/80">
          Rating reminders: one nudge, 24 hours after a delivery, if you have not rated it yet.
        </span>
      </label>
      <p className="font-product text-xs leading-relaxed text-dark-ink/50">
        Emails about your own tracks (delivered, could not be made, billing) are always on.
      </p>
      {!available && (
        <p role="status" className="font-product text-xs leading-relaxed text-dark-ink/50">
          These preferences are not turned on for your account yet.
        </p>
      )}
      <button type="submit" disabled={pending} className={`${button.ghost} w-fit`}>
        {pending ? 'Saving…' : 'Save preferences'}
      </button>
      {result && !result.ok && (
        <p role="alert" className="font-product text-sm text-dark-accent">{result.error}</p>
      )}
      {result?.ok && <p role="status" className="font-product text-sm text-dark-ink/60">Saved.</p>}
    </form>
  )
}
