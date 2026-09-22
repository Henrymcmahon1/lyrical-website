import { type EarningsEstimate, usd } from '@/lib/earnings'

const WIDTH = 640
const HEIGHT = 260
const AXIS_Y = HEIGHT - 40
const MAX_BAR_H = AXIS_Y - 28
const BAR_GAP = 14
const MAX_BAR_W = 64
const MIN_BAR_W = 24

/**
 * The animated earnings graph: one bar per language, all the same height because the
 * estimate is not broken down by named language.
 *
 * No component state, no effect: every bar is drawn at its real, final height and position
 * (SVG geometry, never animated), and the "grow from zero" motion is a CSS keyframe on
 * `transform: scaleY()` only, gated by the page's existing `.js-motion` class (added to
 * `<html>` by the inline script in `app/layout.tsx`, and never added at all when
 * `prefers-reduced-motion: reduce`; the global reduced-motion rule in `globals.css` also
 * collapses any animation duration to the end state as a second line of defence). With
 * JavaScript disabled, or under reduced motion, the bars simply render at full height: there
 * is no state to be "stuck" at zero waiting for a script that never runs.
 *
 * Each bar's `key` includes the calculator's current values, so React remounts the bar (and
 * the CSS animation replays) whenever the inputs change, without any JS driving it.
 */
export function EarningsGraph({ estimate }: { estimate: EarningsEstimate }) {
  const { perLanguage, languages, grossAnnualReceipts } = estimate
  const signature = `${perLanguage}:${languages}`

  const barW = Math.max(
    MIN_BAR_W,
    Math.min(MAX_BAR_W, (WIDTH - BAR_GAP * (languages + 1)) / languages),
  )
  const barH = perLanguage > 0 ? MAX_BAR_H : 0
  const totalLabel = `Total estimated gross new-language streaming receipts: ${usd(
    grossAnnualReceipts,
  )} a year, estimate.`
  const chartLabel = `Estimated gross receipts by language, estimate. ${languages} ${
    languages === 1 ? 'bar' : 'bars'
  }, ${usd(perLanguage)} each, estimate.`

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={chartLabel}
        className="w-full"
      >
        <line
          x1={0}
          y1={AXIS_Y}
          x2={WIDTH}
          y2={AXIS_Y}
          stroke="var(--color-graphite)"
          strokeOpacity={0.25}
        />
        {Array.from({ length: languages }, (_, i) => {
          const x = BAR_GAP + i * (barW + BAR_GAP)
          const cx = x + barW / 2
          return (
            <g key={`${signature}:${i}`}>
              <title>{`Language ${i + 1}: ${usd(perLanguage)} a year, estimate`}</title>
              <rect
                x={x}
                y={AXIS_Y - barH}
                width={barW}
                height={barH}
                fill="var(--color-indigo)"
                className="bar-grow"
              />
              <text
                x={cx}
                y={AXIS_Y + 18}
                textAnchor="middle"
                fontSize={11}
                fontFamily="var(--font-mono)"
                fill="var(--color-graphite)"
              >
                {`Language ${i + 1}`}
              </text>
              <text
                x={cx}
                y={Math.max(14, AXIS_Y - barH - 8)}
                textAnchor="middle"
                fontSize={12}
                fontFamily="var(--font-mono)"
                fill="var(--color-graphite)"
              >
                {usd(perLanguage)}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption className="mt-4 text-sm text-graphite/70">{totalLabel}</figcaption>
    </figure>
  )
}
