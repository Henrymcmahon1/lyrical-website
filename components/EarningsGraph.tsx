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
 * The Y axis auto-scales to each render's own 5-year total, rounded up to a clean number, so the
 * line fills the chart and reads as a satisfying climb at ANY size: a small artist and a large one
 * both get a curve that rises across the plot, and the magnitude lives where it belongs, in the
 * axis labels and the 5-year total beneath. (A fixed ceiling was tried first and made a typical
 * artist's line hug the bottom, which read as "this earns nothing".) `niceCeil` rounds up to 1, 2
 * or 5 times a power of ten for tidy gridline labels; a zero estimate falls back to a small scale
 * so the axis still renders a flat, honest line at zero.
 */
function niceCeil(value: number): number {
  if (value <= 0) return 1000
  const mag = Math.pow(10, Math.floor(Math.log10(value)))
  const n = value / mag
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return step * mag
}

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
 *
 * The animated area path and the line group are keyed by `signature`, a string built from every
 * input field. When a calculator value changes, React sees a new key and remounts those two
 * nodes rather than patching their attributes in place, which restarts the CSS grow animation
 * (`.area-grow` / `.line-fade` in globals.css) on every change, not just on first mount.
 */
export function EarningsGraph({ input }: { input: EarningsInput }) {
  const rows = cumulativeByYear(input, 5)
  const total = fiveYearTotal(input)
  const maxValue = niceCeil(total)
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

        <path
          key={signature}
          d={areaD}
          fill="var(--color-indigo)"
          fillOpacity={0.14}
          className="area-grow"
        />

        <g key={signature} className="line-fade">
          <path d={lineD} fill="none" stroke="var(--color-indigo)" strokeWidth={2.5} className="line-path" />
          {rows.map((r, i) => (
            <g key={`${signature}:${r.year}`}>
              <title>{`Year ${r.year}: ${usd(r.cumulative)} cumulative, estimate`}</title>
              <circle cx={linePoints[i][0]} cy={linePoints[i][1]} r={4} fill="var(--color-ember)" />
            </g>
          ))}
        </g>

        {rows.map((r, i) => (
          <text
            key={r.year}
            x={xFor(r.year)}
            y={AXIS_Y + 20}
            textAnchor={i === 0 ? 'start' : i === rows.length - 1 ? 'end' : 'middle'}
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
