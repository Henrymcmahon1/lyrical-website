/**
 * The Door-1 earnings estimate. Pure, no I/O.
 *
 * Every output is an ESTIMATE from a public blended payout figure and the visitor's inputs.
 * The page says so next to every number; this module says so in its names.
 *
 * `songs` is displayed context, not a multiplier. `monthlyStreams` is already the whole
 * catalog's monthly streams, so multiplying by the song count would double count.
 */
export const PAYOUT_PER_STREAM_USD = 0.004
export const PAYOUT_LABEL = 'industry blended average, 2026, estimate'
export const ARTIST_SHARE = 0.7
export const LYRICAL_SHARE = 0.3
export const MIN_LANGUAGES = 1
export const MAX_LANGUAGES = 3
export const MIN_AUDIENCE_SHARE = 0.05
export const MAX_AUDIENCE_SHARE = 1
export const DEFAULT_AUDIENCE_SHARE = 0.2

export type EarningsInput = {
  monthlyStreams: number
  songs: number
  languages: number
  audienceShare: number
}

export type EarningsEstimate = {
  extraAnnualReceipts: number
  artistAnnual: number
  lyricalAnnual: number
  perLanguage: number
  languages: number
  audienceShare: number
  songs: number
}

export const WORKED_EXAMPLE: EarningsInput = {
  monthlyStreams: 100_000,
  songs: 12,
  languages: 2,
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
  // Each figure is rounded once, from the raw amount, so no rounding compounds through the
  // split. The two shares may therefore differ from the rounded total by a cent; the page
  // shows whole dollars, so nothing visible ever disagrees.
  const raw = monthlyStreams * 12 * audienceShare * languages * PAYOUT_PER_STREAM_USD
  return {
    extraAnnualReceipts: cents(raw),
    artistAnnual: cents(raw * ARTIST_SHARE),
    lyricalAnnual: cents(raw * LYRICAL_SHARE),
    perLanguage: cents(raw / languages),
    languages,
    audienceShare,
    songs,
  }
}

/** Whole US dollars, en-US grouping, identical on the server and in the browser. */
export function usd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}
