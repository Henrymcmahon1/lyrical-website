/**
 * A collapsible section, built on native `<details>`.
 *
 * No JavaScript, which matters here for three reasons: /about must stay readable with JS
 * disabled, the browser's own find-in-page can open a closed `<details>` to reveal a match,
 * and keyboard and screen reader behaviour comes for free rather than being reimplemented.
 *
 * The label and the one-line summary stay visible when closed, so nothing is hidden without
 * a signpost. The section's own heading lives inside, which is why the summary is written as
 * a short description rather than repeating it.
 */
export function Fold({
  label,
  summary,
  children,
  defaultOpen = false,
}: {
  label: string
  summary: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  return (
    <details
      open={defaultOpen}
      className="group border-t border-graphite/15 last:border-b [&_section]:py-0"
    >
      {/*
        The label sits above the summary on a phone and beside it from `sm` up. Side by side at
        375px left the summary in a 128px column, wrapping a single sentence over six lines.
      */}
      <summary className="flex cursor-pointer list-none flex-col gap-2 py-6 sm:flex-row sm:items-baseline sm:gap-5 sm:py-7 [&::-webkit-details-marker]:hidden">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite/45 sm:mt-1 sm:w-32 sm:shrink-0">
          {label}
        </span>

        <span className="flex flex-1 items-start justify-between gap-5">
          <span className="font-brand text-xl leading-snug tracking-tight text-balance sm:text-2xl">
            {summary}
          </span>

          {/*
            A plus that becomes a minus. Two spans rather than rotating a glyph, because a
            character rotated 45 degrees sits visibly off-centre at this size.
          */}
          <span
            aria-hidden="true"
            className="relative mt-2 h-3 w-3 shrink-0 text-indigo transition-transform duration-300 group-open:rotate-90"
          >
            <span className="absolute left-0 top-1/2 h-px w-3 -translate-y-1/2 bg-current" />
            <span className="absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 bg-current transition-opacity duration-300 group-open:opacity-0" />
          </span>
        </span>
      </summary>

      <div className="pb-10">{children}</div>
    </details>
  )
}
