'use server'

import { revalidatePath } from 'next/cache'
import { currentUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { retireAccount, setEmailPreference } from '@/lib/account-data'
import { signOut } from '@/app/studio/actions'

/**
 * The account page's two writes. Both run privileged (service role) after `currentUser()`
 * confirms who is asking, scoped to that id the whole way down through lib/account-data.ts.
 * `useActionState` shape throughout, matching feedback-actions.ts and reroll-actions.ts, so the
 * page's forms post with or without JavaScript.
 */

export type EmailPreferencesResult = { ok: true } | { ok: false; error: string }

export async function saveEmailPreferencesForm(
  _prev: EmailPreferencesResult | null,
  formData: FormData,
): Promise<EmailPreferencesResult> {
  const user = await currentUser()
  if (!user) return { ok: false, error: 'Your session expired. Sign in and try again.' }

  // An unchecked checkbox sends no field at all, which is exactly "off" here: both toggles are
  // always saved together from the one form, never a partial patch.
  const result = await setEmailPreference(supabaseAdmin(), user.id, {
    productEmails: formData.get('productEmails') === 'on',
    ratingReminders: formData.get('ratingReminders') === 'on',
  })
  if (result.ok) revalidatePath('/studio/account')
  return result
}

export type DeleteAccountResult = { ok: true } | { ok: false; error: string }

/** What the customer must type before the delete button does anything. */
export const DELETE_CONFIRM_TEXT = 'DELETE'

export async function deleteAccountForm(
  _prev: DeleteAccountResult | null,
  formData: FormData,
): Promise<DeleteAccountResult> {
  const user = await currentUser()
  if (!user) return { ok: false, error: 'Your session expired. Sign in and try again.' }

  if (String(formData.get('confirm') ?? '').trim() !== DELETE_CONFIRM_TEXT) {
    return { ok: false, error: `Type ${DELETE_CONFIRM_TEXT} to confirm.` }
  }

  const result = await retireAccount(supabaseAdmin(), user.id)
  if (!result.ok) return result

  // Retired successfully: sign out and leave. signOut() redirects and never returns.
  await signOut()
  return { ok: true }
}
