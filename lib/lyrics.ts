/**
 * The lyric sheet a customer supplies with a song.
 *
 * Stored as a `text` column on `song_jobs`, NOT as a file in the bucket. A full sheet is two to
 * five kilobytes, so a thousand songs is about five megabytes, and the free Postgres database
 * is 500MB against the 1GB of file storage that is already the binding constraint for audio.
 * Text in a column also comes back with the row, stays searchable and stays editable, where a
 * file would need a signed URL and a fetch to read three kilobytes.
 *
 * ## "Any language" is mostly an encoding problem
 *
 * The words themselves are not the hard part: Postgres `text` holds any UTF-8, and a textarea
 * accepts any script a keyboard can produce. What breaks is the `.txt` FILE, because a text
 * file carries no reliable statement of its own encoding:
 *
 *   Windows Notepad's "Unicode" option writes UTF-16 LE with a byte order mark. Decoded as
 *   UTF-8 that is not slightly wrong, it is unreadable.
 *
 *   Its "UTF-8" option writes a byte order mark too, which is not a character and shows up as
 *   an invisible one at the very start of the first line.
 *
 *   Older exports are Windows-1252, where every accented character in Spanish, French,
 *   Portuguese or Italian is a single byte that is not valid UTF-8 at all.
 *
 * `decodeLyricsFile` handles all three rather than assuming the happy case, because the happy
 * case is exactly the one an English-speaking developer tests with.
 */

/**
 * Generous, and a ceiling rather than a target.
 *
 * A long song runs to about three thousand characters. Twenty thousand leaves room for a
 * translation pasted underneath, section markers, and the fact that a CJK lyric sheet uses
 * fewer characters for the same song while a transliteration alongside it uses many more.
 */
export const MAX_LYRICS_CHARS = 20000

/** What a `.txt` upload may be. Anything else is very unlikely to be a lyric sheet. */
export const LYRICS_EXTENSIONS = ['.txt'] as const
export const LYRICS_ACCEPT_ATTRIBUTE = '.txt,text/plain'

/** A lyric sheet is text. Anything approaching a megabyte is not one. */
export const MAX_LYRICS_FILE_BYTES = 1024 * 1024

/**
 * Decode a `.txt` the way the person who saved it meant it, not the way we would like it saved.
 *
 * Order matters. A byte order mark is a positive statement about encoding, so it wins outright.
 * Only when there is none do we try UTF-8 strictly, and only when THAT fails do we fall back to
 * Windows-1252, which can decode any byte sequence and therefore must never be tried first: it
 * would silently turn valid UTF-8 accents into mojibake rather than failing.
 */
export function decodeLyricsFile(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)

  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(buffer)
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(buffer)
  }

  try {
    // `fatal` is the whole point: it throws on bytes that are not valid UTF-8, which is the
    // signal that this is a legacy encoding rather than a file with an odd character in it.
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    return new TextDecoder('windows-1252').decode(buffer)
  }
}

/**
 * Tidy a lyric sheet without editing anybody's words.
 *
 * Every rule here is reversible in meaning: nothing that changes what is sung is touched. In
 * particular section markers like `[Verse 1]` and `(x2)` are LEFT ALONE, because somebody typed
 * them deliberately and the pipeline can use the structure.
 */
export function normaliseLyrics(raw: string): string {
  return (
    raw
      // A byte order mark that survived decoding is an invisible character at the start of the
      // first line, and it will sit in the database forever looking like nothing.
      .replace(/^﻿/, '')
      // Windows and old Mac line endings, so a line count means the same thing everywhere.
      .replace(/\r\n?/g, '\n')
      // Trailing spaces on a line are invisible and change nothing, and they make two copies of
      // the same sheet compare as different.
      .replace(/[ \t]+$/gm, '')
      // Three or more blank lines is a paste artefact. Two is a deliberate section break.
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
}

export type LyricStats = { lines: number; characters: number }

/**
 * What the form shows back to somebody who has just pasted.
 *
 * Lines rather than words, because a lyric sheet is read in lines and because a word count is
 * meaningless in Mandarin, Cantonese, Japanese and Korean, which are four of the nine here.
 * Blank lines are not counted: they are spacing, not content.
 */
export function lyricStats(text: string): LyricStats {
  const clean = normaliseLyrics(text)
  if (!clean) return { lines: 0, characters: 0 }
  return {
    lines: clean.split('\n').filter((line) => line.trim().length > 0).length,
    // `Array.from` counts CODE POINTS, so an emoji or a character outside the basic plane
    // counts once rather than twice. `.length` would report a different number for the same
    // visible sheet depending on the script it is written in.
    characters: Array.from(clean).length,
  }
}

/** Why a chosen `.txt` cannot be used, or null when it is fine. */
export function describeLyricsFileRejection(file: { name: string; size: number }): string | null {
  if (!LYRICS_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))) {
    return `${file.name} is not a .txt file. Export the lyrics as plain text, or paste them straight into the box.`
  }
  if (file.size === 0) return `${file.name} is empty.`
  if (file.size > MAX_LYRICS_FILE_BYTES) {
    return `${file.name} is too large to be a lyric sheet. Paste the words in instead.`
  }
  return null
}

/**
 * Whether a sheet looks like it was pasted by mistake.
 *
 * Deliberately advisory and never blocking. It catches the two things people actually paste
 * into a lyrics box by accident, a URL and nothing else, and returns null for everything else
 * rather than trying to judge whether words are lyrics.
 */
export function describeLyricsWarning(text: string): string | null {
  const clean = normaliseLyrics(text)
  if (!clean) return null

  const stats = lyricStats(clean)

  if (stats.lines === 1 && /^https?:\/\/\S+$/i.test(clean)) {
    return 'That looks like a link rather than the words. We cannot open links, so paste the lyrics themselves.'
  }
  if (stats.lines === 1 && stats.characters > 400) {
    return 'That is one very long line. If the line breaks were lost in the paste, put them back: the pipeline works line by line.'
  }
  return null
}
