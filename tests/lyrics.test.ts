import { describe, expect, it } from 'vitest'
import {
  MAX_LYRICS_FILE_BYTES,
  decodeLyricsFile,
  describeLyricsFileRejection,
  describeLyricsWarning,
  lyricStats,
  normaliseLyrics,
} from '@/lib/lyrics'

/**
 * The lyric sheet, and specifically the encoding half.
 *
 * A `.txt` carries no reliable statement of its own encoding, so these tests feed real byte
 * sequences rather than strings. Testing a decoder with a string proves nothing: the string has
 * already been decoded by whatever produced it.
 */

const utf8 = (s: string) => new TextEncoder().encode(s).buffer

/** UTF-16 LE with a byte order mark, which is what Windows Notepad's "Unicode" writes. */
function utf16le(s: string): ArrayBuffer {
  const out = new Uint8Array(2 + s.length * 2)
  out[0] = 0xff
  out[1] = 0xfe
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    out[2 + i * 2] = c & 0xff
    out[3 + i * 2] = c >> 8
  }
  return out.buffer
}

/** Windows-1252, where every accent is a single byte that is NOT valid UTF-8. */
function cp1252(bytes: number[]): ArrayBuffer {
  return new Uint8Array(bytes).buffer
}

describe('decoding a .txt that somebody actually saved', () => {
  it('reads plain UTF-8', () => {
    expect(decodeLyricsFile(utf8('Corazón partío\nY nada más'))).toBe('Corazón partío\nY nada más')
  })

  it('reads UTF-16 LE, which Notepad writes when you pick "Unicode"', () => {
    /**
     * The failure this prevents is total rather than cosmetic. Decoded as UTF-8, a UTF-16 file
     * is not slightly wrong, it is unreadable, and the customer would have no idea why.
     */
    expect(decodeLyricsFile(utf16le('Hola mundo'))).toContain('Hola mundo')
  })

  it('reads UTF-16 BE', () => {
    const be = new Uint8Array([0xfe, 0xff, 0x00, 0x48, 0x00, 0x69])
    expect(decodeLyricsFile(be.buffer)).toBe('Hi')
  })

  it('falls back to Windows-1252 for a legacy export', () => {
    // "Café" in Windows-1252: the é is 0xE9, a single byte and not valid UTF-8.
    expect(decodeLyricsFile(cp1252([0x43, 0x61, 0x66, 0xe9]))).toBe('Café')
  })

  it('tries UTF-8 BEFORE the fallback, so valid accents are not mangled', () => {
    /**
     * Order is the whole design. Windows-1252 can decode ANY byte sequence, so trying it first
     * would silently turn correct UTF-8 accents into mojibake and never fail. UTF-8 is tried
     * strictly first precisely so that it CAN fail and hand over.
     */
    const proper = decodeLyricsFile(utf8('Café'))
    expect(proper).toBe('Café')
    expect(proper).not.toBe('CafÃ©')
  })

  it('handles CJK, which is four of the nine languages', () => {
    expect(decodeLyricsFile(utf8('你好\nこんにちは\n안녕하세요'))).toBe('你好\nこんにちは\n안녕하세요')
  })
})

describe('tidying a sheet without editing the words', () => {
  it('strips a byte order mark that survived decoding', () => {
    // Invisible, permanent, and it sits at the start of the first sung line forever.
    expect(normaliseLyrics('﻿First line')).toBe('First line')
  })

  it('normalises Windows and old Mac line endings', () => {
    expect(normaliseLyrics('one\r\ntwo\rthree')).toBe('one\ntwo\nthree')
  })

  it('removes trailing spaces, which are invisible and make two copies differ', () => {
    expect(normaliseLyrics('one   \ntwo\t\n')).toBe('one\ntwo')
  })

  it('collapses a paste artefact but KEEPS a deliberate section break', () => {
    expect(normaliseLyrics('a\n\n\n\n\nb')).toBe('a\n\nb')
    expect(normaliseLyrics('a\n\nb')).toBe('a\n\nb')
  })

  it('LEAVES section markers alone', () => {
    // Somebody typed [Verse 1] on purpose and the pipeline can use the structure. Stripping it
    // would be us deciding we know better about their own sheet.
    const sheet = '[Verse 1]\nline one\n\n[Chorus] (x2)\nline two'
    expect(normaliseLyrics(sheet)).toBe(sheet)
  })

  it('never touches the words themselves', () => {
    const sheet = 'Corazón partío\n你好 世界\nÇa va'
    expect(normaliseLyrics(sheet)).toBe(sheet)
  })
})

describe('counting a sheet', () => {
  it('counts sung lines, not blank ones', () => {
    expect(lyricStats('one\n\ntwo\n\n\nthree').lines).toBe(3)
  })

  it('reports zero for an empty sheet', () => {
    expect(lyricStats('   \n\n  ')).toEqual({ lines: 0, characters: 0 })
  })

  it('counts code points, so a script does not change the number', () => {
    /**
     * `.length` counts UTF-16 code units, so a character outside the basic plane counts twice
     * and the same visible sheet reports different sizes depending on the language it is in.
     */
    expect(lyricStats('𝄞').characters).toBe(1)
    expect(lyricStats('你好').characters).toBe(2)
  })
})

describe('rejecting a file that is not a lyric sheet', () => {
  it('accepts a .txt in any case', () => {
    expect(describeLyricsFileRejection({ name: 'lyrics.TXT', size: 2000 })).toBeNull()
  })

  it('refuses a .docx and says what to do instead', () => {
    const msg = describeLyricsFileRejection({ name: 'lyrics.docx', size: 2000 })
    expect(msg).toMatch(/\.txt/)
    expect(msg).toMatch(/paste/i)
  })

  it('refuses an empty file and one far too large to be words', () => {
    expect(describeLyricsFileRejection({ name: 'a.txt', size: 0 })).toMatch(/empty/i)
    expect(
      describeLyricsFileRejection({ name: 'a.txt', size: MAX_LYRICS_FILE_BYTES + 1 }),
    ).toMatch(/too large/i)
  })
})

describe('warning without blocking', () => {
  it('spots a pasted link, which is the commonest mistake', () => {
    expect(describeLyricsWarning('https://genius.com/some-song-lyrics')).toMatch(/link/i)
  })

  it('spots a paste that lost its line breaks', () => {
    expect(describeLyricsWarning('word '.repeat(120))).toMatch(/one very long line/i)
  })

  it('says nothing about a normal sheet', () => {
    expect(describeLyricsWarning('[Verse 1]\nline one\nline two\n\n[Chorus]\nline three')).toBeNull()
  })

  it('says nothing about an empty box, because empty is allowed', () => {
    // Lyrics are optional. A warning on an untouched field is noise.
    expect(describeLyricsWarning('')).toBeNull()
  })

  it('never blocks a short one-line sheet, which is legitimate', () => {
    expect(describeLyricsWarning('La la la')).toBeNull()
  })
})
