'use client'

import { useState } from 'react'
import { EarningsGraph } from '@/components/EarningsGraph'
import {
  DEFAULT_AUDIENCE_SHARE,
  MAX_AUDIENCE_SHARE,
  MAX_LANGUAGES,
  MIN_AUDIENCE_SHARE,
  MIN_LANGUAGES,
  PAYOUT_LABEL,
  PAYOUT_PER_STREAM_USD,
  estimateEarnings,
  usd,
  type EarningsInput,
} from '@/lib/earnings'

const field =
  'w-full rounded-card border border-graphite/25 bg-transparent px-4 py-3 outline-none transition-colors focus-visible:border-indigo'
const tile = 'rounded-card border border-graphite/15 p-5'
const label = 'font-mono text-[11px] uppercase tracking-[0.18em] text-graphite/50'

const LANGUAGE_OPTIONS = Array.from(
  { length: MAX_LANGUAGES - MIN_LANGUAGES + 1 },
  (_, i) => MIN_LANGUAGES + i,
)

/**
 * State starts at `initial`, so the server renders the worked example and the client hydrates
 * to the same numbers. With JavaScript off the visitor sees a real, labelled estimate and
 * inert controls: no blank tiles, no "loading".
 *
 * The output is the GROSS estimate only. The terms are prose elsewhere on the page, never a
 * split computed here.
 *
 * The graph sits above the inputs and tiles as the centrepiece: it is driven by the same `e`
 * the tiles read, so the two can never disagree for the same inputs.
 */
export function EarningsCalculator({ initial }: { initial: EarningsInput }) {
  const [input, setInput] = useState<EarningsInput>(initial)
  const e = estimateEarnings(input)
  const set = (patch: Partial<EarningsInput>) => setInput((v) => ({ ...v, ...patch }))
  const pct = Math.round(e.audienceShare * 100)

  return (
    <div className="flex flex-col gap-10">
      <div className={`${tile} sm:p-8`}>
        <EarningsGraph estimate={e} />
      </div>

      <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <form
          className="flex flex-col gap-5"
          onSubmit={(ev) => ev.preventDefault()}
          aria-label="Earnings calculator inputs"
        >
          <label className="flex flex-col gap-2">
            <span className="text-sm">Monthly streams across all platforms</span>
            <input
              type="number"
              name="monthlyStreams"
              inputMode="numeric"
              min={0}
              step={1000}
              value={input.monthlyStreams}
              onChange={(ev) => set({ monthlyStreams: Number(ev.target.value) })}
              className={field}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm">
              Songs in your catalog{' '}
              <span className="text-graphite/55">(context only, not a multiplier)</span>
            </span>
            <input
              type="number"
              name="songs"
              inputMode="numeric"
              min={1}
              step={1}
              value={input.songs}
              onChange={(ev) => set({ songs: Number(ev.target.value) })}
              className={field}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm">
              Languages you want{' '}
              <span className="text-graphite/55">
                ({MIN_LANGUAGES} to {MAX_LANGUAGES})
              </span>
            </span>
            <select
              name="languages"
              value={input.languages}
              onChange={(ev) => set({ languages: Number(ev.target.value) })}
              className={field}
            >
              {LANGUAGE_OPTIONS.map((n) => (
                <option key={n} value={n} className="text-graphite">
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm">
              New-language audience as a share of your current one: <strong>{pct}%</strong>{' '}
              <span className="text-graphite/55">
                (an assumption, default {Math.round(DEFAULT_AUDIENCE_SHARE * 100)}%)
              </span>
            </span>
            <input
              type="range"
              name="audienceShare"
              min={MIN_AUDIENCE_SHARE * 100}
              max={MAX_AUDIENCE_SHARE * 100}
              step={5}
              value={pct}
              onChange={(ev) => set({ audienceShare: Number(ev.target.value) / 100 })}
              className="min-h-11 accent-indigo"
            />
          </label>
          <p className="text-sm text-graphite/55">
            Payout used: {PAYOUT_PER_STREAM_USD.toFixed(3)} US dollars per stream ({PAYOUT_LABEL}).
          </p>
        </form>

        <div className="grid gap-4 sm:grid-cols-2" aria-live="polite">
          <div className={`${tile} sm:col-span-2`}>
            <p className={label}>Estimated gross new-language streaming receipts per year</p>
            <p className="mt-2 font-brand text-4xl" data-testid="gross-annual">
              {usd(e.grossAnnualReceipts)}
            </p>
            <p className="mt-1 text-sm text-graphite/55">
              estimate, before any share, across {e.languages}{' '}
              {e.languages === 1 ? 'language' : 'languages'}
            </p>
          </div>
          <div className={tile}>
            <p className={label}>Per language, estimate</p>
            <p className="mt-2 font-brand text-3xl" data-testid="per-language">
              {usd(e.perLanguage)}
            </p>
          </div>
          <div className={tile}>
            <p className={label}>Upfront cost (the terms, not an estimate)</p>
            <p className="mt-2 font-brand text-3xl">$0 upfront</p>
          </div>
          <p className="text-sm leading-relaxed text-graphite/55 sm:col-span-2">
            Every number here is an estimate from public payout averages and your own inputs.
            Real receipts depend on the songs, the markets and the release.
          </p>
        </div>
      </div>
    </div>
  )
}
