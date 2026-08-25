/**
 * The nine languages stated on the site. Approved by the client 2026-07-30, changed 2026-08-12.
 * Adding a language here is a public capability claim — do not add speculatively.
 *
 * ## What changed on 2026-08-12, and what it cost
 *
 * German and Cantonese in, Italian out, on Henry's instruction. Eight became nine.
 *
 * ⚠️ **This list decides the delivery promise.** `OFFERED` in `lib/language-pairs.ts` is derived
 * from it, and `GUARANTEED` is derived from `OFFERED`, so every entry here silently carries the
 * 48 hour commitment across every pair it can form. Nine languages is **72 pairs**, up from 56.
 * Henry confirmed that for German with the arithmetic in front of him. The brake is unchanged
 * and it is the only one: the clock starts when a human presses Accept in `/queue`, never when
 * somebody uploads.
 *
 * **Italian was removed rather than retired.** Nothing keeps its name, so an older row that
 * stored `IT` renders as the raw code in the queue and the CSV rather than "Italian". Henry's
 * call, and it is safe because `content/demos.json` never referenced it and `languageByCode`
 * already falls back for anything unknown. If a real Italian job ever turns up in the queue
 * reading "IT", that is why.
 *
 * ## Mandarin stays 中文, and that is a decision rather than an oversight
 *
 * 中文 literally reads "Chinese" rather than "Mandarin", so sitting it beside 粵語 can be read
 * as implying Cantonese is not Chinese. The alternative, 普通話 against 廣東話, puts the two at
 * the same level. That trade-off was put to Henry on 2026-08-12 and he chose to leave 中文 as
 * it is, because it is already live. Recorded here so the next person does not "fix" it.
 */
export const LANGUAGES = [
  { code: 'EN', endonym: 'English', english: 'English' },
  { code: 'ES', endonym: 'Español', english: 'Spanish' },
  { code: 'PT', endonym: 'Português', english: 'Portuguese' },
  { code: 'FR', endonym: 'Français', english: 'French' },
  { code: 'DE', endonym: 'Deutsch', english: 'German' },
  { code: 'ZH', endonym: '中文', english: 'Mandarin' },
  /**
   * `YUE` is the ISO 639-3 code for Cantonese, and it is three letters where every other code
   * here is two. That is not an inconsistency to tidy up: Cantonese has no two-letter ISO 639-1
   * code at all, and the alternatives are inventing one or overloading `ZH`, which already
   * means Mandarin in this list. A wrong code is worse than an odd-looking one.
   */
  { code: 'YUE', endonym: '粵語', english: 'Cantonese' },
  { code: 'JA', endonym: '日本語', english: 'Japanese' },
  { code: 'KO', endonym: '한국어', english: 'Korean' },
] as const

export type LanguageCode = (typeof LANGUAGES)[number]['code']

export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code) as readonly string[]

export function languageByCode(code: string) {
  return LANGUAGES.find((l) => l.code === code)
}
