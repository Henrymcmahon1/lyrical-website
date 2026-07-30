/**
 * The eight languages stated on the site. Approved by the client 2026-07-30.
 * Adding a language here is a public capability claim — do not add speculatively.
 */
export const LANGUAGES = [
  { code: 'EN', endonym: 'English', english: 'English' },
  { code: 'ES', endonym: 'Español', english: 'Spanish' },
  { code: 'PT', endonym: 'Português', english: 'Portuguese' },
  { code: 'IT', endonym: 'Italiano', english: 'Italian' },
  { code: 'FR', endonym: 'Français', english: 'French' },
  { code: 'ZH', endonym: '中文', english: 'Mandarin' },
  { code: 'JA', endonym: '日本語', english: 'Japanese' },
  { code: 'KO', endonym: '한국어', english: 'Korean' },
] as const

export type LanguageCode = (typeof LANGUAGES)[number]['code']

export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code) as readonly string[]

export function languageByCode(code: string) {
  return LANGUAGES.find((l) => l.code === code)
}
