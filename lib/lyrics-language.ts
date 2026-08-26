/**
 * Does the lyric sheet look like it is in the language the song was RECORDED in?
 *
 * This exists for one specific mistake. A customer is asked for the original words, in the
 * language the song is sung in, and sometimes pastes the TRANSLATION instead: the version they
 * want back, in the target language. The pipeline builds the new language from the original, so
 * the translation is the wrong input, and it is a silent wrong input because a full sheet of
 * plausible words looks fine.
 *
 * ## Advisory, never blocking
 *
 * `lib/lyrics.ts` deliberately does no language or character-set check, because a validator that
 * assumes Latin script would refuse the CJK languages this product exists to serve. Everything
 * here keeps that promise: it produces a WARNING string or nothing, and the form shows it beside
 * the box without ever stopping a submission. A false alarm costs a sentence; a hard block on a
 * bilingual song or a short sheet costs the submission.
 *
 * ## Two ways to detect, and why
 *
 * Script settles four of the nine languages outright: Hangul is Korean, Kana is Japanese, and
 * Han with neither is Chinese. Those need no dependency and work on very little text.
 *
 * The five Latin-script languages (English, Spanish, Portuguese, French, German) cannot be told
 * apart by script at all, and telling English from Spanish is the whole point, because the
 * original and its translation are usually both Latin. That needs a real language model, which
 * is `franc-min`. It is loaded lazily and only in the browser (see `detectLyrics`), so it never
 * reaches the marketing pages or the server bundle.
 *
 * ## The Chinese caveat is load-bearing
 *
 * 中文 and 粵語 are both written in Han characters and CANNOT be told apart from text, so a Han
 * sheet is accepted for either. A Japanese sheet can be kanji-heavy and also read as Han, so
 * Japanese accepts Han too rather than warn on a sheet that is genuinely Japanese. The cost of
 * these is that a Han sheet pasted for, say, a Korean song will not be caught. That is the right
 * trade: the alternative is warning real Chinese and Japanese customers that their own lyrics are
 * wrong.
 */

import { languageByCode } from './languages'

/** The languages we can positively recognise from a sheet. `ZH` stands for Han of any kind. */
export type DetectedLanguage = 'EN' | 'ES' | 'PT' | 'FR' | 'DE' | 'JA' | 'KO' | 'ZH'

/**
 * How many letters we need on the Latin path before trusting a guess.
 *
 * Below this, franc is guessing from noise and would warn people who pasted a title or a hummed
 * "la la la". Script detection is exempt: a single Hangul character is a certainty, not a guess.
 */
const MIN_LATIN_LETTERS = 12

/** franc's ISO 639-3 codes for the five Latin languages we model. Anything else stays unknown. */
const FRANC_TO_TOKEN: Record<string, DetectedLanguage> = {
  eng: 'EN',
  spa: 'ES',
  por: 'PT',
  fra: 'FR',
  deu: 'DE',
}

/**
 * What each source language will accept from a sheet without warning.
 *
 * Mostly "itself", with the two Han exceptions spelled out: Cantonese accepts Han because it is
 * written in Han, and Japanese accepts Han because a kanji-heavy sheet reads as Han.
 */
const ACCEPTS: Record<string, DetectedLanguage[]> = {
  EN: ['EN'],
  ES: ['ES'],
  PT: ['PT'],
  FR: ['FR'],
  DE: ['DE'],
  ZH: ['ZH'],
  YUE: ['ZH'],
  JA: ['JA', 'ZH'],
  KO: ['KO'],
}

/** Human names for a detected token, for the warning. `ZH` is "Chinese": it may be either. */
const DETECTED_NAME: Record<DetectedLanguage, string> = {
  EN: 'English',
  ES: 'Spanish',
  PT: 'Portuguese',
  FR: 'French',
  DE: 'German',
  JA: 'Japanese',
  KO: 'Korean',
  ZH: 'Chinese',
}

const HANGUL = /[가-힣ᄀ-ᇿ㄰-㆏]/
const KANA = /[぀-ゟ゠-ヿ]/
const HAN = /[㐀-䶿一-鿿豈-﫿]/

/**
 * The script-only verdict, or null when the script cannot decide (Latin, or nothing at all).
 *
 * Order matters: Hangul and Kana are checked before Han because Korean and Japanese both also use
 * Han characters, and their own scripts are the positive signal that it is not Chinese.
 */
export function detectByScript(text: string): 'JA' | 'KO' | 'ZH' | null {
  if (HANGUL.test(text)) return 'KO'
  if (KANA.test(text)) return 'JA'
  if (HAN.test(text)) return 'ZH'
  return null
}

/**
 * Combine the script verdict with a franc code into a final token, or null when we cannot say.
 *
 * Split out from `detectLyrics` so the whole decision is testable without loading franc: the
 * caller passes whatever code franc returned (including `und` for "undetermined").
 */
export function classifyLyrics(text: string, francCode: string): DetectedLanguage | null {
  const script = detectByScript(text)
  if (script) return script

  // Latin path. Count actual letters rather than characters, so punctuation and spacing do not
  // push a two-word scrap over the threshold.
  const letters = (text.match(/\p{L}/gu) ?? []).length
  if (letters < MIN_LATIN_LETTERS) return null

  return FRANC_TO_TOKEN[francCode] ?? null
}

/**
 * The warning to show, or null when the sheet is fine or we are not sure enough to speak.
 *
 * `source` and `target` are the form's language codes. The message always names the two languages
 * and pushes the point that we want the original. When the detected language IS the target, it
 * says so directly, because that is the exact mistake the feature exists to catch.
 */
export function lyricsLanguageWarning({
  detected,
  source,
  target,
}: {
  detected: DetectedLanguage | null
  source: string
  target: string
}): string | null {
  if (!detected) return null

  const accepted = ACCEPTS[source] ?? [source as DetectedLanguage]
  if (accepted.includes(detected)) return null

  const detectedName = DETECTED_NAME[detected]
  const sourceName = languageByCode(source)?.english ?? source

  if (detected === target) {
    return `These lyrics look like ${detectedName}, which is the language you want it in. Paste the original ${sourceName} words instead, exactly as they are sung: the new version is built from the original, not from a translation.`
  }

  return `These lyrics look like ${detectedName}, but you told us the song is recorded in ${sourceName}. Paste the original ${sourceName} words, exactly as they are sung, not a translation: the new version is built from the original.`
}

/**
 * The whole detection, end to end. The only part that touches `franc-min`.
 *
 * Loaded with a dynamic import so the trigram model lands in its own chunk, fetched the first
 * time somebody types Latin-script lyrics and never on a page that has no lyrics box. Script-only
 * sheets never load it at all.
 */
export async function detectLyrics(text: string): Promise<DetectedLanguage | null> {
  const script = detectByScript(text)
  if (script) return script

  const letters = (text.match(/\p{L}/gu) ?? []).length
  if (letters < MIN_LATIN_LETTERS) return null

  const { franc } = await import('franc-min')
  return classifyLyrics(text, franc(text))
}
