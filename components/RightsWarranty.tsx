'use client'

/**
 * The rights warranty a customer reads and agrees to before submitting.
 *
 * The full terms sit in a scrollable box directly above the checkbox rather than behind a link,
 * because agreement is only meaningful if the terms are in front of the person at the moment they
 * agree. The box scrolls rather than pushing the submit button off the screen, and the checkbox is
 * unticked by default so agreeing is an affirmative act. `lib/terms.ts` is the single source of
 * the wording; this component only renders it.
 */
export function RightsWarranty({
  preface,
  intro,
  points,
  checked,
  onChange,
}: {
  /** An optional voice-specific line shown before the lead-in. */
  preface?: string
  intro: string
  points: string[]
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="max-h-52 overflow-y-auto rounded-card border border-graphite/20 bg-cream/60 p-4 text-sm leading-relaxed text-graphite/80">
        {preface && <p>{preface}</p>}
        <p className={preface ? 'mt-3' : ''}>{intro}</p>
        <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5">
          {points.map((point, i) => (
            <li key={i}>{point}</li>
          ))}
        </ol>
      </div>

      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 size-4 shrink-0 accent-indigo"
        />
        <span className="text-sm leading-relaxed text-graphite/80">
          I have read and agree to the above.
        </span>
      </label>
    </div>
  )
}
