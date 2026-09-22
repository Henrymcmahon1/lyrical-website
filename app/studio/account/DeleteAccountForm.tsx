'use client'

import { useActionState, useState } from 'react'
import { deleteAccountForm, type DeleteAccountResult } from './actions'
import { DELETE_CONFIRM_TEXT } from '@/lib/account-data'
import { button, control } from '@/components/studio/ui'

/**
 * The soft delete, guarded by a type-to-confirm field so a stray click cannot trigger it. The
 * submit button stays disabled until the typed text matches exactly. What actually happens on
 * submit (retire the voice models, keep every ledger row, sign out) lives in
 * `app/studio/account/actions.ts` and `lib/account-data.ts`; this component only gates the click.
 */
export function DeleteAccountForm() {
  const [result, action, pending] = useActionState<DeleteAccountResult | null, FormData>(deleteAccountForm, null)
  const [confirm, setConfirm] = useState('')

  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="font-product text-sm leading-relaxed text-dark-ink/70">
        This keeps your billing history, your delivered tracks and your credit ledger exactly as
        they are. It retires your voice models and signs you out. It does not delete anything.
      </p>
      <label className="flex flex-col gap-1.5">
        <span className="font-product text-[11px] uppercase tracking-[0.14em] text-dark-ink/60">
          Type {DELETE_CONFIRM_TEXT} to confirm
        </span>
        <input
          name="confirm"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="off"
          className={control}
        />
      </label>
      <button
        type="submit"
        disabled={pending || confirm !== DELETE_CONFIRM_TEXT}
        className={`${button.ghost} w-fit`}
      >
        {pending ? 'Closing your account…' : 'Delete my account'}
      </button>
      {result && !result.ok && (
        <p role="alert" className="font-product text-sm text-dark-accent">{result.error}</p>
      )}
    </form>
  )
}
