'use client'

import { useActionState, useState } from 'react'
import { submitFeedbackForm, type FeedbackResult } from '@/app/studio/feedback-actions'
import { requestRerollForm, type RerollResult } from '@/app/studio/reroll-actions'
import { FEEDBACK_TAGS, MIN_DOWN_NOTE_CHARS } from '@/lib/feedback-schema'
import { button, chip, control, eyebrow } from '@/components/studio/ui'

/**
 * The feedback loop is the product. Thumbs are radios inside a real form, so the bar posts
 * without JavaScript; React adds the live prompt switch and the pending state. A thumbs-down
 * needs a detailed note before it saves, and only a saved thumbs-down unlocks the re-roll.
 * Copy strings are the deck's, verbatim. Drawn in the studio's dark panel language.
 */
export type ExistingFeedback = { rating: 'up' | 'down'; note: string | null; tags: string[] } | null

const DOWN_PROMPT =
  'Tell us exactly what is wrong: which line, what time in the song, is it timing, pronunciation, the voice, or the meaning of the words? The more you write, the better the re-roll.'
const UP_PROMPT = 'Anything you loved, or anything small to fix? (optional)'
const REROLL_CLOSED = 'The re-roll window for this song has closed. Make it again to start fresh.'

export function FeedbackBar({ jobId, existing, rerollsLeft, canReroll }: {
  jobId: string; existing: ExistingFeedback; rerollsLeft: number; canReroll: boolean
}) {
  const [choice, setChoice] = useState<'up' | 'down' | ''>(existing?.rating ?? '')
  const [saved, save, saving] = useActionState<FeedbackResult | null, FormData>(submitFeedbackForm, null)
  const [rerolled, reroll, rerolling] = useActionState<RerollResult | null, FormData>(requestRerollForm, null)
  const showReroll = canReroll && existing?.rating === 'down' && !!existing.note && !rerolled?.ok

  return (
    <div className="mt-5 border-t border-dark-ink/10 pt-4">
      <form action={save} className="flex flex-col gap-3">
        <input type="hidden" name="jobId" value={jobId} />
        <fieldset className="flex flex-wrap items-center gap-3">
          <legend className="sr-only">How did this take turn out?</legend>
          {(['up', 'down'] as const).map((r) => (
            <label key={r} className={`${chip} inline-flex min-h-11 min-w-11 items-center justify-center px-3 text-lg`} aria-label={r === 'up' ? 'Thumbs up' : 'Thumbs down'}>
              <input type="radio" name="rating" value={r} className="sr-only" required checked={choice === r} onChange={() => setChoice(r)} />
              <span aria-hidden="true">{r === 'up' ? '\u{1F44D}' : '\u{1F44E}'}</span>
            </label>
          ))}
          {existing && !saved && <span className="font-product text-sm text-dark-ink/55">Saved. Change it any time.</span>}
        </fieldset>

        {choice && (
          <label className="flex flex-col gap-2">
            <span className="font-product text-sm leading-relaxed text-dark-ink/75">{choice === 'down' ? DOWN_PROMPT : UP_PROMPT}</span>
            <textarea name="note" rows={4} defaultValue={existing?.note ?? ''} className={control}
              required={choice === 'down'} minLength={choice === 'down' ? MIN_DOWN_NOTE_CHARS : undefined} />
          </label>
        )}
        {choice === 'down' && (
          <fieldset className="flex flex-wrap gap-2">
            <legend className={`mb-2 ${eyebrow}`}>What is it? Pick any.</legend>
            {FEEDBACK_TAGS.map((t) => (
              <label key={t} className={`${chip} rounded-full px-3 py-1.5 font-product text-sm`}>
                <input type="checkbox" name="tags" value={t} className="sr-only" defaultChecked={existing?.tags.includes(t) ?? false} />
                {t}
              </label>
            ))}
          </fieldset>
        )}
        {saved && !saved.ok && <p role="alert" className="font-product text-sm text-dark-accent">{saved.error}</p>}
        {saved?.ok && <p role="status" className="font-product text-sm text-dark-ink/70">Thank you. That goes straight into the next take.</p>}
        {choice && (
          <button type="submit" disabled={saving} className={`w-fit ${button.ghost}`}>
            {saving ? 'Saving…' : existing ? 'Update' : 'Save'}
          </button>
        )}
      </form>

      {showReroll && (
        <form action={reroll} className="mt-4 flex flex-col gap-2">
          <input type="hidden" name="jobId" value={jobId} />
          <button type="submit" disabled={rerollsLeft === 0 || rerolling} className={`w-fit ${button.primary}`}>
            {rerolling ? 'Starting…' : `Re-roll this track (${rerollsLeft} left)`}
          </button>
          {rerollsLeft === 0 && <p className="font-product text-sm text-dark-ink/60">{REROLL_CLOSED}</p>}
          {rerolled && !rerolled.ok && <p role="alert" className="font-product text-sm text-dark-accent">{rerolled.error}</p>}
        </form>
      )}
      {rerolled?.ok && <p role="status" className="mt-4 font-product text-sm text-dark-ink/70">Re-rolling. The new take will appear under this song as soon as it is ready.</p>}
    </div>
  )
}
