'use client'

import { useActionState } from 'react'
import { updateNameForm, type UpdateNameResult } from './actions'
import { MAX_NAME_LENGTH } from '@/lib/account-data'
import { button, control, eyebrow } from '@/components/studio/ui'

/**
 * The editable name field. `useActionState` so it posts with or without JavaScript, matching
 * EmailPreferencesForm.tsx. The save writes `profiles.name` for the caller only, scoped by
 * `updateNameForm` -> `lib/account-data.ts`'s `updateName` down to `.eq('id', userId)`.
 */
export function NameForm({ name }: { name: string }) {
  const [result, action, pending] = useActionState<UpdateNameResult | null, FormData>(updateNameForm, null)

  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className={eyebrow}>Name</span>
        <input
          name="name"
          defaultValue={name}
          maxLength={MAX_NAME_LENGTH}
          autoComplete="name"
          className={control}
        />
      </label>
      <button type="submit" disabled={pending} className={`${button.ghost} w-fit`}>
        {pending ? 'Saving…' : 'Save name'}
      </button>
      {result && !result.ok && (
        <p role="alert" className="font-product text-sm text-dark-accent">{result.error}</p>
      )}
      {result?.ok && <p role="status" className="font-product text-sm text-dark-ink/60">Saved.</p>}
    </form>
  )
}
