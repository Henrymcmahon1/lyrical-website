import { describe, expect, it } from 'vitest'
import {
  classifyLyrics,
  detectByScript,
  detectLyrics,
  lyricsLanguageWarning,
} from '@/lib/lyrics-language'

/**
 * The check exists for one specific mistake: pasting the TRANSLATED lyrics (the target language)
 * when we asked for the ORIGINAL words the song is sung in. It is advisory, so the bar is "warns
 * on a confident mismatch and stays quiet otherwise", never "identifies every language".
 */

describe('detecting a script without any dependency', () => {
  it('reads Hangul as Korean', () => {
    expect(detectByScript('이것은 한국 노래입니다')).toBe('KO')
  })

  it('reads Kana as Japanese', () => {
    expect(detectByScript('これは日本語の歌です')).toBe('JA')
  })

  it('reads Han with no kana as Chinese', () => {
    expect(detectByScript('这是一首中文歌曲')).toBe('ZH')
  })

  it('returns null for Latin script, which script alone cannot resolve', () => {
    expect(detectByScript('this is an english line')).toBeNull()
  })
})

describe('classifying a full sheet', () => {
  it('trusts the script over franc for CJK', () => {
    // Even if franc guessed wrong, kana is a positive statement.
    expect(classifyLyrics('これは日本語の歌です', 'eng')).toBe('JA')
  })

  it('maps franc codes to our tokens on the Latin path', () => {
    const text = 'Esta es una cancion en espanol sobre la lluvia del verano que cae'
    expect(classifyLyrics(text, 'spa')).toBe('ES')
  })

  it('will not guess a Latin language from too little text', () => {
    // Two words is not enough to warn somebody they got their language wrong.
    expect(classifyLyrics('hey now', 'eng')).toBeNull()
  })

  it('returns null for a franc code outside the nine we work in', () => {
    // Italian is not offered; better to stay silent than warn against a language we do not model.
    expect(classifyLyrics('Questa e una canzone italiana sulla pioggia estiva della sera', 'ita')).toBeNull()
  })
})

describe('when to warn', () => {
  it('warns when the detected language differs from the source', () => {
    const w = lyricsLanguageWarning({ detected: 'EN', source: 'ES', target: 'EN' })
    expect(w).toBeTruthy()
    expect(w).toMatch(/English/)
    expect(w).toMatch(/Spanish/)
  })

  it('says nothing when the detected language matches the source', () => {
    expect(lyricsLanguageWarning({ detected: 'ES', source: 'ES', target: 'EN' })).toBeNull()
  })

  it('accepts Han lyrics for both Mandarin and Cantonese, which text cannot tell apart', () => {
    expect(lyricsLanguageWarning({ detected: 'ZH', source: 'ZH', target: 'EN' })).toBeNull()
    expect(lyricsLanguageWarning({ detected: 'ZH', source: 'YUE', target: 'EN' })).toBeNull()
  })

  it('accepts Han lyrics for Japanese, whose sheets can be kanji-heavy', () => {
    // A kanji-only Japanese line reads as Han. Warning there would be a false alarm.
    expect(lyricsLanguageWarning({ detected: 'ZH', source: 'JA', target: 'EN' })).toBeNull()
  })

  it('still warns when a clearly Latin sheet is pasted for a CJK source', () => {
    expect(lyricsLanguageWarning({ detected: 'EN', source: 'JA', target: 'EN' })).toBeTruthy()
  })

  it('sharpens the message when the lyrics are the target-language translation', () => {
    // The exact mistake the feature exists to catch: they pasted the version they want back.
    // The sharpened copy points out that the detected language is the one they asked us for.
    const w = lyricsLanguageWarning({ detected: 'EN', source: 'ES', target: 'EN' })
    expect(w).toMatch(/language you want it in/i)
  })

  it('does not claim it is the translation when the mismatch is some third language', () => {
    // French is neither the source nor the target here, so the "you pasted the translation"
    // framing would be wrong. It is still a mismatch, just a plain one.
    const w = lyricsLanguageWarning({ detected: 'FR', source: 'ES', target: 'EN' })
    expect(w).toBeTruthy()
    expect(w).not.toMatch(/language you want it in/i)
  })

  it('says nothing when there is no confident detection', () => {
    expect(lyricsLanguageWarning({ detected: null, source: 'ES', target: 'EN' })).toBeNull()
  })
})

describe('the end to end detector', () => {
  it('resolves real Latin sheets through franc', async () => {
    const english = 'This is an english song about the summer rain falling on the city at night'
    const spanish = 'Esta es una cancion en espanol sobre la lluvia de verano que cae de noche'
    expect(await detectLyrics(english)).toBe('EN')
    expect(await detectLyrics(spanish)).toBe('ES')
  })

  it('resolves CJK sheets by script alone', async () => {
    expect(await detectLyrics('이것은 여름비에 관한 한국 노래입니다')).toBe('KO')
    expect(await detectLyrics('これは夏の雨についての日本語の歌です')).toBe('JA')
    expect(await detectLyrics('这是一首关于夏天雨水的中文歌曲')).toBe('ZH')
  })

  it('stays null on a scrap too short to judge', async () => {
    expect(await detectLyrics('la la la')).toBeNull()
  })
})
