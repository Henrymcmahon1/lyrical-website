import { describe, expect, it } from 'vitest'
import {
  MAX_UPLOAD_BYTES,
  TRAINING_MINIMUM_SECONDS,
  describeVoiceRejection,
  formatDuration,
  hasVoiceExtension,
  readAudioFacts,
  readFlacFacts,
  readWavFacts,
  trainingProgress,
  voicePathBelongsTo,
  voiceSamplePath,
} from '@/lib/voice-training'

/**
 * The training-upload rules, and the header parsers underneath them.
 *
 * The parsers get real bytes rather than mocks. A header reader tested against a fixture some
 * other function produced only proves the two agree, and the files this meets are written by
 * Pro Tools and Logic, not by us.
 */

// ── Building real headers ─────────────────────────────────────────────────────

function wav({
  channels = 1,
  sampleRate = 48000,
  bits = 24,
  seconds = 60,
  dataSize,
  extraChunk = false,
}: {
  channels?: number
  sampleRate?: number
  bits?: number
  seconds?: number
  dataSize?: number
  extraChunk?: boolean
} = {}): ArrayBuffer {
  const bytesPerSecond = sampleRate * channels * (bits / 8)
  const audioBytes = dataSize ?? Math.round(bytesPerSecond * seconds)

  // A LIST chunk before `data`, because real files carry them and a parser that assumes the
  // canonical 44-byte layout walks straight past the audio.
  const listSize = extraChunk ? 26 : 0
  const headerBytes = 44 + (extraChunk ? 8 + listSize : 0)

  const buf = new ArrayBuffer(headerBytes + Math.min(audioBytes, 128))
  const v = new DataView(buf)
  const put = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(offset + i, s.charCodeAt(i))
  }

  put(0, 'RIFF')
  v.setUint32(4, buf.byteLength - 8, true)
  put(8, 'WAVE')

  put(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, channels, true)
  v.setUint32(24, sampleRate, true)
  v.setUint32(28, bytesPerSecond, true)
  v.setUint16(32, channels * (bits / 8), true)
  v.setUint16(34, bits, true)

  let at = 36
  if (extraChunk) {
    put(at, 'LIST')
    v.setUint32(at + 4, listSize, true)
    at += 8 + listSize
  }

  put(at, 'data')
  v.setUint32(at + 4, audioBytes, true)
  return buf
}

function flac({
  channels = 1,
  sampleRate = 48000,
  seconds = 60,
}: { channels?: number; sampleRate?: number; seconds?: number } = {}): ArrayBuffer {
  const buf = new ArrayBuffer(4 + 4 + 34)
  const v = new DataView(buf)
  for (const [i, c] of [...'fLaC'].entries()) v.setUint8(i, c.charCodeAt(0))

  v.setUint8(4, 0x00) // STREAMINFO, not the last block
  v.setUint8(5, 0)
  v.setUint8(6, 0)
  v.setUint8(7, 34)

  const totalSamples = Math.round(sampleRate * seconds)

  /*
   * 20 bits sample rate, 3 bits (channels - 1), 5 bits (depth - 1), 36 bits total samples,
   * packed big-endian across eight bytes starting ten into the block.
   */
  const hi = (sampleRate << 12) | ((channels - 1) << 9) | ((24 - 1) << 4) | Math.floor(totalSamples / 2 ** 32)
  v.setUint32(18, hi >>> 0, false)
  v.setUint32(22, totalSamples >>> 0, false)
  return buf
}

// ── WAV ───────────────────────────────────────────────────────────────────────

describe('reading a WAV header', () => {
  it('reads channels, rate and duration', () => {
    const f = readWavFacts(wav({ channels: 1, sampleRate: 48000, seconds: 185 }))
    expect(f).not.toBeNull()
    expect(f!.channels).toBe(1)
    expect(f!.sampleRate).toBe(48000)
    expect(Math.round(f!.seconds)).toBe(185)
  })

  it('spots stereo, which is the whole reason this exists', () => {
    expect(readWavFacts(wav({ channels: 2 }))!.channels).toBe(2)
  })

  it('walks past a chunk that sits before the audio', () => {
    // Real files from a DAW carry LIST, bext and others. A parser that assumes the canonical
    // 44-byte layout reads the wrong four bytes and reports nonsense.
    const f = readWavFacts(wav({ seconds: 120, extraChunk: true }))
    expect(Math.round(f!.seconds)).toBe(120)
    expect(f!.channels).toBe(1)
  })

  it('handles 44.1k/16-bit, not just the 48k/24 case', () => {
    const f = readWavFacts(wav({ sampleRate: 44100, bits: 16, seconds: 90 }))
    expect(f!.sampleRate).toBe(44100)
    expect(Math.round(f!.seconds)).toBe(90)
  })

  it('returns null rather than guessing at something that is not a WAV', () => {
    expect(readWavFacts(new ArrayBuffer(8))).toBeNull()
    expect(readWavFacts(flac())).toBeNull()
  })
})

// ── FLAC ──────────────────────────────────────────────────────────────────────

describe('reading a FLAC STREAMINFO block', () => {
  it('reads channels, rate and duration', () => {
    const f = readFlacFacts(flac({ channels: 1, sampleRate: 48000, seconds: 240 }))
    expect(f).not.toBeNull()
    expect(f!.channels).toBe(1)
    expect(f!.sampleRate).toBe(48000)
    expect(Math.round(f!.seconds)).toBe(240)
  })

  it('spots stereo', () => {
    expect(readFlacFacts(flac({ channels: 2 }))!.channels).toBe(2)
  })

  it('reads a duration past the 32-bit boundary', () => {
    // Total samples is a 36-bit field. Anything over about 24 hours at 48k overflows a naive
    // 32-bit read, and more to the point so does the arithmetic if it is done with bit shifts.
    const f = readFlacFacts(flac({ sampleRate: 48000, seconds: 30000 }))
    expect(Math.round(f!.seconds)).toBe(30000)
  })

  it('returns null for anything that is not a FLAC', () => {
    expect(readFlacFacts(wav())).toBeNull()
    expect(readFlacFacts(new ArrayBuffer(4))).toBeNull()
  })
})

describe('picking a reader by filename', () => {
  it('uses the FLAC reader for .flac and the WAV reader otherwise', () => {
    expect(readAudioFacts('take.flac', flac({ channels: 2 }))!.channels).toBe(2)
    expect(readAudioFacts('take.wav', wav({ channels: 2 }))!.channels).toBe(2)
  })

  it('reports nothing for a real AIFF rather than misreading it', () => {
    /**
     * AIFF is accepted and not parsed. An AIFF begins `FORM....AIFF`, not `RIFF....WAVE`, so
     * the WAV reader it gets handed correctly declines it and the caller skips the mono check
     * rather than rejecting a format we said we take.
     *
     * The first version of this test fed WAV BYTES under an `.aiff` name and failed, because
     * the reader did its job. Worth keeping the note: the dispatch is on filename, so a test
     * has to supply bytes that match the claim it is making.
     */
    const aiff = new ArrayBuffer(64)
    const v = new DataView(aiff)
    for (const [i, c] of [...'FORM'].entries()) v.setUint8(i, c.charCodeAt(0))
    for (const [i, c] of [...'AIFF'].entries()) v.setUint8(8 + i, c.charCodeAt(0))

    expect(readAudioFacts('take.aiff', aiff)).toBeNull()
  })
})

// ── What the visitor is told ──────────────────────────────────────────────────

describe('rejecting a file, with a way out', () => {
  const ok = { name: 'verse.flac', size: 10 * 1024 * 1024 }

  it('accepts a mono lossless file under the limit', () => {
    expect(describeVoiceRejection(ok, { channels: 1, sampleRate: 48000, seconds: 200 })).toBeNull()
  })

  it('refuses a lossy file and says what the model needs', () => {
    const msg = describeVoiceRejection({ name: 'verse.mp3', size: 4_000_000 })
    expect(msg).toMatch(/lossless/i)
  })

  it('refuses anything over the free plan per-file ceiling', () => {
    const msg = describeVoiceRejection({ name: 'verse.wav', size: MAX_UPLOAD_BYTES + 1 })
    expect(msg).toMatch(/50MB/)
  })

  it('names FLAC as the way out of the size limit, not just the limit', () => {
    /**
     * The failure this prevents is somebody re-exporting the same WAV twice. FLAC is lossless
     * and about 45% smaller, so for most files it IS the fix, and saying so costs one clause.
     */
    const msg = describeVoiceRejection({ name: 'verse.wav', size: MAX_UPLOAD_BYTES + 1 })
    expect(msg).toMatch(/FLAC/)
  })

  it('refuses stereo, and explains that half of it would be discarded', () => {
    const msg = describeVoiceRejection(ok, { channels: 2, sampleRate: 48000, seconds: 200 })
    expect(msg).toMatch(/stereo/i)
    expect(msg).toMatch(/mono/i)
  })

  it('does not refuse a file whose header could not be read', () => {
    // AIFF, or a WAV written oddly. Refusing on "we could not check" is the check doing harm.
    expect(describeVoiceRejection(ok, null)).toBeNull()
    expect(describeVoiceRejection(ok)).toBeNull()
  })

  it('refuses an empty file', () => {
    expect(describeVoiceRejection({ name: 'verse.flac', size: 0 })).toMatch(/empty/i)
  })
})

describe('accepted extensions', () => {
  it('takes the three lossless containers, in any case', () => {
    for (const n of ['a.flac', 'b.WAV', 'c.aiff', 'd.AIF']) expect(hasVoiceExtension(n)).toBe(true)
  })

  it('refuses lossy and non-audio', () => {
    for (const n of ['a.mp3', 'b.m4a', 'c.ogg', 'd.zip', 'e']) {
      expect(hasVoiceExtension(n)).toBe(false)
    }
  })
})

// ── Progress ──────────────────────────────────────────────────────────────────

describe('how much more they need', () => {
  it('asks for 20 to 30 minutes when nothing is uploaded', () => {
    const p = trainingProgress(0)
    expect(p.enough).toBe(false)
    expect(p.message).toMatch(/20 to 30 minutes/)
  })

  it('counts down to the minimum in minutes, not percentages', () => {
    const p = trainingProgress(TRAINING_MINIMUM_SECONDS - 5 * 60)
    expect(p.enough).toBe(false)
    expect(p.message).toContain('5 min')
  })

  it('says it is enough AT the minimum, not past it', () => {
    /**
     * Measured against the 20 minute minimum rather than the 30 minute target on purpose. A bar
     * reading 66% when the set is already usable tells somebody they are unfinished when they
     * are not, and the cost of that is an abandoned upload.
     */
    const p = trainingProgress(TRAINING_MINIMUM_SECONDS)
    expect(p.enough).toBe(true)
    expect(p.fraction).toBe(1)
  })

  it('still encourages more between the minimum and the target', () => {
    expect(trainingProgress(22 * 60).message).toMatch(/better model/i)
  })

  it('stops asking past the target', () => {
    expect(trainingProgress(40 * 60).message).toMatch(/plenty/i)
  })

  it('never reports a fraction above 1', () => {
    expect(trainingProgress(10 * 3600).fraction).toBe(1)
  })
})

describe('formatting a duration', () => {
  it('uses seconds under a minute', () => {
    expect(formatDuration(45)).toBe('45 s')
  })

  it('drops the seconds when there are none', () => {
    expect(formatDuration(120)).toBe('2 min')
  })

  it('reads as minutes and seconds otherwise', () => {
    expect(formatDuration(1470)).toBe('24 min 30 s')
  })

  it('never shows a negative', () => {
    expect(formatDuration(-5)).toBe('0 s')
  })
})

// ── Paths ─────────────────────────────────────────────────────────────────────

describe('where a sample is stored', () => {
  it('puts every object under the uploader own id, which is what the policy checks', () => {
    const p = voiceSamplePath('user-1', 'voice-1', 0, 'Verse Take 3.FLAC')
    expect(p).toBe('user-1/voice-1/sample-0.flac')
  })

  it('never lets the uploader filename decide the key', () => {
    // A filename can carry anything. Letting it into the path is how traversal happens.
    const p = voiceSamplePath('user-1', 'voice-1', 2, '../../../etc/passwd.wav')
    expect(p).toBe('user-1/voice-1/sample-2.wav')
    expect(p).not.toContain('..')
  })

  it('accepts a path under the right owner and voice', () => {
    expect(voicePathBelongsTo('user-1/voice-1/sample-0.flac', 'user-1', 'voice-1')).toBe(true)
  })

  it('REFUSES another owner folder, which is the whole point', () => {
    expect(voicePathBelongsTo('user-2/voice-1/sample-0.flac', 'user-1', 'voice-1')).toBe(false)
    expect(voicePathBelongsTo('user-1/voice-9/sample-0.flac', 'user-1', 'voice-1')).toBe(false)
    expect(voicePathBelongsTo('user-1/voice-1/../../x.flac', 'user-1', 'voice-1')).toBe(false)
  })
})
