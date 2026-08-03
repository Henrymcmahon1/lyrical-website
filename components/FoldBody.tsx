import type { AboutFold } from '@/content/about-folds'

/**
 * The inside of a fold on /about.
 *
 * One width, one heading scale, one paragraph style, for every fold. The previous version
 * rendered four standalone section components here, which brought four different max-widths,
 * two heading scales, a centred block among left-aligned ones, and a `py-24` on each that
 * fought the fold's own padding.
 *
 * There is no heading in here by design. The fold's summary has already named the section
 * one line above, and repeating it was most of what made the page look untidy.
 *
 * Presentational only: it renders whatever `content/about-folds.ts` gives it and holds no
 * copy of its own, so editing the words never means touching a component.
 */
export function FoldBody({ fold }: { fold: AboutFold }) {
  const { paragraphs, pull, points, numbered, actions } = fold

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {paragraphs?.map((p) => (
        <p key={p} className="leading-relaxed text-graphite/75">
          {p}
        </p>
      ))}

      {pull && (
        <p className="border-l-2 border-indigo pl-6 font-brand text-xl leading-snug tracking-tight text-graphite">
          {pull}
        </p>
      )}

      {points && (
        // A list either way. `numbered` only decides whether the counter is shown, because a
        // set of beliefs reads as a sequence and two ways in do not.
        <ol className="mt-2 flex flex-col">
          {points.map((pt, i) => (
            <li
              key={pt.h ?? pt.p}
              className="flex items-baseline gap-5 border-t border-graphite/15 py-5 last:border-b"
            >
              {numbered && (
                <span className="font-mono text-xs tracking-[0.18em] text-indigo tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
              )}
              <div className="flex flex-col gap-2">
                {pt.h && (
                  <p className="font-brand text-xl leading-snug tracking-tight text-graphite">
                    {pt.h}
                  </p>
                )}
                <p
                  className={
                    pt.h
                      ? 'leading-relaxed text-graphite/75'
                      : 'font-brand text-lg leading-snug tracking-tight text-graphite'
                  }
                >
                  {pt.p}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}

      {actions && (
        <div className="mt-2 flex flex-wrap gap-3">
          {actions.map((a) => (
            <a
              key={a.href}
              href={a.href}
              className="nudge inline-flex min-h-11 items-center rounded-card border border-indigo px-5 text-sm text-indigo transition-colors hover:bg-indigo hover:text-cream"
            >
              {a.label} <span className="shift-arrow ml-1">&rarr;</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
