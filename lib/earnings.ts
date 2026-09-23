/**
 * The Door-1 earnings estimate. Pure, no I/O.
 *
 * Every output is an ESTIMATE from a public blended payout figure and the visitor's inputs.
 * The page says so next to every number; this module says so in its names.
 *
 * The estimate is GROSS: the new-language streaming receipts before anyone's share. The terms
 * (lyrical's share, the artist's share) are prose on the page, never a computed figure here.
 *
 * `songs` IS a multiplier: `monthlyStreams` is the AVERAGE MONTHLY STREAMS PER SONG (not the
 * whole catalog's total), so `songs` scales it up to the catalog without double counting. A
 * catalog's total monthly streams is `monthlyStreams * songs`, which is exactly what the
 * formula below computes on its way to the annual figure.
 */
export const PAYOUT_PER_STREAM_USD = 0.004
export const PAYOUT_LABEL = 'industry blended average, 2026, estimate'
export const MIN_LANGUAGES = 1
export const MAX_LANGUAGES = 8
export const DEFAULT_LANGUAGES = 2
export const MIN_AUDIENCE_SHARE = 0.1
export const MAX_AUDIENCE_SHARE = 1
export const DEFAULT_AUDIENCE_SHARE = 0.8

export type EarningsInput = {
  /** Average monthly streams for a SINGLE song, not the whole catalog. */
  monthlyStreams: number
  songs: number
  languages: number
  audienceShare: number
}

export type EarningsEstimate = {
  /** Gross estimated new-language streaming receipts per year, before any share. */
  grossAnnualReceipts: number
  perLanguage: number
  languages: number
  audienceShare: number
  songs: number
}

export const WORKED_EXAMPLE: EarningsInput = {
  monthlyStreams: 8_000,
  songs: 12,
  languages: DEFAULT_LANGUAGES,
  audienceShare: DEFAULT_AUDIENCE_SHARE,
}

const cents = (n: number) => Math.round(n * 100) / 100

export function clampLanguages(n: number): number {
  const whole = Number.isFinite(n) ? Math.round(n) : MIN_LANGUAGES
  return Math.min(MAX_LANGUAGES, Math.max(MIN_LANGUAGES, whole))
}

export function clampAudienceShare(x: number): number {
  const v = Number.isFinite(x) ? x : DEFAULT_AUDIENCE_SHARE
  return Math.min(MAX_AUDIENCE_SHARE, Math.max(MIN_AUDIENCE_SHARE, v))
}

export function estimateEarnings(input: EarningsInput): EarningsEstimate {
  const monthlyStreams = Number.isFinite(input.monthlyStreams)
    ? Math.max(0, input.monthlyStreams)
    : 0
  const songs = Number.isFinite(input.songs) ? Math.max(1, Math.round(input.songs)) : 1
  const languages = clampLanguages(input.languages)
  const audienceShare = clampAudienceShare(input.audienceShare)
  // Each figure is rounded once, from the raw amount, so no rounding compounds. `songs`
  // multiplies here: `monthlyStreams` is per song, so `monthlyStreams * songs` is the
  // catalog's total monthly streams, never double counted against `songs` a second time.
  const raw = monthlyStreams * songs * 12 * audienceShare * languages * PAYOUT_PER_STREAM_USD
  return {
    grossAnnualReceipts: cents(raw),
    perLanguage: cents(raw / languages),
    languages,
    audienceShare,
    songs,
  }
}

/**
 * The running total of GROSS annual new-language receipts, accrued year over year.
 *
 * The model is deliberately flat: cumulative(N) = annualGross * N. No growth curve, no decay,
 * no discounting, so there is nothing here that reads as an NPV or a perpetuity. It is a plain
 * multiple of the same `estimateEarnings` figure the rest of the page already shows.
 */
export function cumulativeByYear(
  input: EarningsInput,
  years = 5,
): { year: number; cumulative: number }[] {
  const annualGross = estimateEarnings(input).grossAnnualReceipts
  const horizon = Number.isFinite(years) ? Math.max(1, Math.round(years)) : 5
  return Array.from({ length: horizon }, (_, i) => {
    const year = i + 1
    return { year, cumulative: cents(annualGross * year) }
  })
}

/** The cumulative total at year 5, the headline figure next to the graph. */
export function fiveYearTotal(input: EarningsInput): number {
  return cumulativeByYear(input, 5).at(-1)!.cumulative
}

/** Whole US dollars, en-US grouping, identical on the server and in the browser. */
export function usd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}
