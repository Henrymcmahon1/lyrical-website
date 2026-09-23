import { type EarningsInput, cumulativeByYear, fiveYearTotal, usd } from '@/lib/earnings'

const WIDTH = 640
const HEIGHT = 260
const MARGIN_LEFT = 60
const MARGIN_RIGHT = 16
const MARGIN_TOP = 28
const AXIS_Y = HEIGHT - 40
const PLOT_H = AXIS_Y - MARGIN_TOP
const PLOT_W = WIDTH - MARGIN_LEFT - MARGIN_RIGHT

/**
 * A fixed reference scale for the Y axis, instead of normalising to each render's own total.
 *
 * The model is linear (cumulative = annualGross * year), so a chart auto-scaled to its own
 * total always draws the exact same shape no matter the input: year 1 is always 1/5 of the
 * height, year 5 is always the full height. Anchoring the scale to a fixed ceiling instead
 * means a bigger total genuinely climbs higher and reads as a steeper line, which is the
 * point of the graph. A total beyond the ceiling simply extends the scale to fit it, so the
 * line never clips off the top.
 */
const REFERENCE_5YR_CEILING = 200_000

/**
 * The cumulative earnings line graph: the running total of GROSS annual new-language receipts,
 * year 1 through year 5, climbing from near zero to the 5-year total.
 *
 * No component state, no effect: the line and the area beneath it are drawn at their real,
 * final SVG geometry (never animated in the geometry itself). The "grow from the axis" motion
 * is CSS only, on `transform: scaleY()` for the area and `opacity` for the line and points,
 * gated by the page's existing `.js-motion` class (added to `<html>` by the inline script in
 * `app/layout.tsx`, and never added at all under `prefers-reduced-motion: reduce`; the global
 * reduced-motion rule in `globals.css` also collapses any animation duration to the end state
 * as a second line of defence). With JavaScript disabled, or under reduced motion, the line
 * simply renders at full height immediately: there is no state to be "stuck" at zero waiting
 * for a script that never runs.
 *
 * Every figure here is an estimate, GROSS, before any share: the same locked rule as the rest
 * of the page. There is no NPV, no discounting, no perpetuity: cumulative(N) = annualGross * N,
 * a plain running total.
 */
export function EarningsGraph({ input }: { input: EarningsInput }) {
  const rows = cumulativeByYear(input, 5)
  const total = fiveYearTotal(input)
  const maxValue = Math.max(total, REFERENCE_5YR_CEILING)
  const signature = `${input.monthlyStreams}:${input.songs}:${input.languages}:${input.audienceShare}`

  const xFor = (year: number) => MARGIN_LEFT + ((year - 1) / (rows.length - 1)) * PLOT_W
  const yFor = (value: number) => AXIS_Y - (value / maxValue) * PLOT_H

  const linePoints = rows.map((r) => [xFor(r.year), yFor(r.cumulative)] as const)
  const lineD = linePoints.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ')
  const areaD = `M${xFor(1)},${AXIS_Y} ${linePoints
    .map(([x, y]) => `L${x},${y}`)
    .join(' ')} L${xFor(rows.length)},${AXIS_Y} Z`

  const yTicks = [0, 0.5, 1].map((f) => ({
    value: maxValue * f,
    y: AXIS_Y - f * PLOT_H,
  }))

  const chartLabel = `Cumulative estimated gross new-language streaming receipts, year 1 through year ${rows.length}, climbing to ${usd(
    total,
  )} by year ${rows.length}, an estimate.`

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={chartLabel}
        className="w-full"
      >
        <title>{`Estimated cumulative gross receipts, year 1 to year ${rows.length}`}</title>
        <desc>{chartLabel}</desc>

        {yTicks.map(({ value, y }) => (
          <g key={value}>
            <line
              x1={MARGIN_LEFT}
              y1={y}
              x2={WIDTH - MARGIN_RIGHT}
              y2={y}
              stroke="var(--color-graphite)"
              strokeOpacity={0.12}
            />
            <text
              x={MARGIN_LEFT - 10}
              y={y + 4}
              textAnchor="end"
              fontSize={11}
              fontFamily="var(--font-mono)"
              fill="var(--color-graphite)"
              fillOpacity={0.6}
            >
              {usd(value)}
            </text>
          </g>
        ))}

        <line
          x1={MARGIN_LEFT}
          y1={AXIS_Y}
          x2={WIDTH - MARGIN_RIGHT}
          y2={AXIS_Y}
          stroke="var(--color-graphite)"
          strokeOpacity={0.25}
        />

        <path d={areaD} fill="var(--color-indigo)" fillOpacity={0.14} className="area-grow" />

        <g className="line-fade">
          <path d={lineD} fill="none" stroke="var(--color-indigo)" strokeWidth={2.5} className="line-path" />
          {rows.map((r, i) => (
            <g key={`${signature}:${r.year}`}>
              <title>{`Year ${r.year}: ${usd(r.cumulative)} cumulative, estimate`}</title>
              <circle cx={linePoints[i][0]} cy={linePoints[i][1]} r={4} fill="var(--color-ember)" />
            </g>
          ))}
        </g>

        {rows.map((r) => (
          <text
            key={r.year}
            x={xFor(r.year)}
            y={AXIS_Y + 20}
            textAnchor="middle"
            fontSize={11}
            fontFamily="var(--font-mono)"
            fill="var(--color-graphite)"
          >
            {`Year ${r.year}`}
          </text>
        ))}
      </svg>
      <figcaption className="mt-4 text-sm text-graphite/70">
        Estimated 5-year total: <strong>{usd(total)}</strong>, gross, an estimate.
      </figcaption>
    </figure>
  )
}
