import { describe, expect, it } from 'vitest'
import {
  DOOR1_FORMAT_LABEL,
  DOOR1_MAX_BYTES,
  Door1JobSchema,
  NO_PACK_TARGETS,
  defaultRestoreMode,
  describeDoor1FileRejection,
  door1AssetRow,
  door1JobRow,
  door1Settings,
  isQobuzUrl,
  isDoor1,
  readDoor1Settings,
} from '@/lib/door1-schema'

const JOB_ID = '22222222-2222-4222-8222-222222222222'
const USER_ID = '00000000-0000-4000-8000-00000000000a'
const ENQUIRY_ID = '33333333-3333-4333-8333-333333333333'
const QOBUZ = 'https://open.qobuz.com/track/123456789'

const BASE = {
  jobId: JOB_ID,
  primaryArtist: 'Coffey Anderson',
  title: 'Sweet Home',
  sourceLanguage: 'EN',
  targetLanguage: 'ES',
  sourceUrl: QOBUZ,
}

const parse = (over: Record<string, unknown> = {}) => Door1JobSchema.safeParse({ ...BASE, ...over })
const firstError = (over: Record<string, unknown>) => {
  const r = parse(over)
  expect(r.success).toBe(false)
  return r.success ? '' : r.error.issues[0]?.message
}

describe('Door1JobSchema: the minimum', () => {
  it('accepts artist, title, a language pair and a Qobuz link', () => {
    const r = parse()
    expect(r.success).toBe(true)
  })

  it('defaults vocal_denoise ON and treats empty optionals as absent', () => {
    const r = parse({ voiceModel: '  ', lyrics: '', notes: '', dueOn: '', enquiryId: '' })
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.vocalDenoise).toBe(true)
    expect(r.data.voiceModel).toBeUndefined()
    expect(r.data.lyrics).toBeUndefined()
    expect(r.data.notes).toBeUndefined()
    expect(r.data.dueOn).toBeUndefined()
    expect(r.data.enquiryId).toBeUndefined()
  })

  it('requires artist and title', () => {
    expect(parse({ primaryArtist: ' ' }).success).toBe(false)
    expect(parse({ title: '' }).success).toBe(false)
  })

  it('requires a UUID job id', () => {
    expect(parse({ jobId: 'nope' }).success).toBe(false)
  })

  it('refuses a malformed enquiry id', () => {
    expect(parse({ enquiryId: 'not-a-uuid' }).success).toBe(false)
    expect(parse({ enquiryId: ENQUIRY_ID }).success).toBe(true)
  })
})

describe('languages', () => {
  it('refuses the same language twice', () => {
    expect(firstError({ targetLanguage: 'EN' })).toMatch(/two different languages/i)
  })

  it('refuses an unknown code', () => {
    expect(parse({ sourceLanguage: 'XX' }).success).toBe(false)
  })

  it('refuses a target the pipeline has no language pack for (Japanese today), clearly', () => {
    expect(NO_PACK_TARGETS).toContain('JA')
    expect(firstError({ targetLanguage: 'JA' })).toMatch(/Japanese/)
  })

  it('still allows Japanese as the SOURCE (the pack is only needed for the target)', () => {
    expect(parse({ sourceLanguage: 'JA', targetLanguage: 'EN' }).success).toBe(true)
  })
})

describe('source: exactly one', () => {
  const asset = { path: `${USER_ID}/${JOB_ID}/full_mix-1.flac`, filename: 'Sweet Home.flac', bytes: 30_000_000 }

  it('accepts an uploaded full mix with no link', () => {
    expect(parse({ sourceUrl: undefined, asset }).success).toBe(true)
  })

  it('refuses both', () => {
    expect(firstError({ asset })).toMatch(/one source/i)
  })

  it('refuses neither', () => {
    expect(firstError({ sourceUrl: '' })).toMatch(/one source/i)
  })

  it('refuses a non-Qobuz link', () => {
    expect(firstError({ sourceUrl: 'https://open.spotify.com/track/1' })).toMatch(/Qobuz/)
  })

  it('refuses an upload over 50 MB and names the way out', () => {
    expect(firstError({ sourceUrl: undefined, asset: { ...asset, bytes: DOOR1_MAX_BYTES + 1 } })).toMatch(
      /FLAC or a Qobuz link/,
    )
  })

  it('refuses a file type that is not MP3, FLAC or WAV', () => {
    expect(parse({ sourceUrl: undefined, asset: { ...asset, filename: 'a.ogg' } }).success).toBe(false)
  })
})

describe('isQobuzUrl', () => {
  it.each([
    ['https://open.qobuz.com/track/1', true],
    ['https://play.qobuz.com/album/abc', true],
    ['https://www.qobuz.com/gb-en/album/x/y', true],
    ['https://qobuz.com/album/x', true],
    ['http://open.qobuz.com/track/1', false],
    ['https://qobuz.com.evil.example/track/1', false],
    ['https://evilqobuz.com/track/1', false],
    ['javascript:alert(1)', false],
    ['not a url', false],
  ])('%s -> %s', (url, ok) => {
    expect(isQobuzUrl(url)).toBe(ok)
  })
})

describe('describeDoor1FileRejection', () => {
  it('accepts MP3, FLAC and WAV under the cap', () => {
    for (const name of ['a.mp3', 'a.FLAC', 'a.wav']) {
      expect(describeDoor1FileRejection({ name, size: 1000 })).toBeNull()
    }
  })
  it('refuses over 50 MB with "use FLAC or a Qobuz link"', () => {
    expect(describeDoor1FileRejection({ name: 'a.wav', size: DOOR1_MAX_BYTES + 1 })).toMatch(
      /use FLAC or a Qobuz link/,
    )
  })
  it('refuses an empty file and another format', () => {
    expect(describeDoor1FileRejection({ name: 'a.wav', size: 0 })).toMatch(/empty/)
    expect(describeDoor1FileRejection({ name: 'a.aac', size: 10 })).toMatch(/MP3, FLAC or WAV/)
  })
})

describe('render knobs', () => {
  it('restore mode defaults to cascade with a voice and zeroshot without', () => {
    expect(defaultRestoreMode('Coffey_Anderson')).toBe('cascade')
    expect(defaultRestoreMode(undefined)).toBe('zeroshot')
  })

  it('refuses cascade with no voice', () => {
    expect(firstError({ restoreMode: 'cascade' })).toMatch(/cascade needs a voice/i)
  })

  it('allows zeroshot with a voice (an explicit choice)', () => {
    expect(parse({ voiceModel: 'Coffey_Anderson', restoreMode: 'zeroshot' }).success).toBe(true)
  })

  it('refuses a voice model name with odd characters', () => {
    expect(parse({ voiceModel: '../etc/passwd' }).success).toBe(false)
    expect(parse({ voiceModel: 'Coffey_Anderson' }).success).toBe(true)
  })

  it('door1Settings resolves the default restore mode and carries vocal_denoise', () => {
    const a = parse({ voiceModel: 'Coffey_Anderson', vocalDenoise: false })
    if (!a.success) throw new Error('parse')
    expect(door1Settings(a.data)).toEqual({ vocal_denoise: false, restore_mode: 'cascade' })
    const b = parse()
    if (!b.success) throw new Error('parse')
    expect(door1Settings(b.data)).toEqual({ vocal_denoise: true, restore_mode: 'zeroshot' })
  })
})

describe('due date', () => {
  it('accepts YYYY-MM-DD and refuses anything else', () => {
    expect(parse({ dueOn: '2026-10-01' }).success).toBe(true)
    expect(parse({ dueOn: '01/10/2026' }).success).toBe(false)
    expect(parse({ dueOn: '2026-02-30' }).success).toBe(false)
  })
})

describe('door1JobRow: THE insert shape (README contract)', () => {
  const NOW = '2026-09-24T02:00:00.000Z'

  it('writes exactly the contract', () => {
    const r = parse({
      enquiryId: ENQUIRY_ID,
      voiceModel: 'Coffey_Anderson',
      lyrics: 'la la',
      notes: 'rush',
      dueOn: '2026-10-01',
      vocalDenoise: true,
    })
    if (!r.success) throw new Error('parse')
    expect(door1JobRow(r.data, { userId: USER_ID, nowIso: NOW })).toEqual({
      id: JOB_ID,
      user_id: USER_ID,
      delivery_profile: 'door1',
      route: 'door1',
      status: 'approved',
      approved_at: NOW,
      pipeline_state: 'queued',
      quota_consumed_at: null,
      title: 'Sweet Home',
      primary_artist: 'Coffey Anderson',
      source_language: 'EN',
      target_language: 'ES',
      lyrics: 'la la',
      notes: 'rush',
      pipeline_voice_model: 'Coffey_Anderson',
      door1_enquiry_id: ENQUIRY_ID,
      door1_due_on: '2026-10-01',
      door1_source_url: QOBUZ,
      door1_settings: { vocal_denoise: true, restore_mode: 'cascade' },
      rights_terms_version: null,
      licence_terms_version: null,
    })
  })

  it('never auto, never a quota stamp, null voice for zero-shot, null link for an upload', () => {
    const r = parse({
      sourceUrl: undefined,
      asset: { path: `${USER_ID}/${JOB_ID}/full_mix-1.wav`, filename: 'x.wav', bytes: 10 },
    })
    if (!r.success) throw new Error('parse')
    const row = door1JobRow(r.data, { userId: USER_ID, nowIso: NOW })
    expect(row.route).not.toBe('auto')
    expect(row.quota_consumed_at).toBeNull()
    expect(row.pipeline_voice_model).toBeNull()
    expect(row.door1_source_url).toBeNull()
    expect(row.lyrics).toBeNull()
  })
})

describe('door1AssetRow', () => {
  it('is one full_mix row under the admin folder, or null for a Qobuz job', () => {
    const up = parse({
      sourceUrl: undefined,
      asset: { path: `${USER_ID}/${JOB_ID}/full_mix-1.wav`, filename: 'x.wav', bytes: 10 },
    })
    if (!up.success) throw new Error('parse')
    expect(door1AssetRow(up.data, USER_ID)).toEqual({
      job_id: JOB_ID,
      user_id: USER_ID,
      kind: 'full_mix',
      path: `${USER_ID}/${JOB_ID}/full_mix-1.wav`,
      filename: 'x.wav',
      bytes: 10,
    })
    const q = parse()
    if (!q.success) throw new Error('parse')
    expect(door1AssetRow(q.data, USER_ID)).toBeNull()
  })
})

describe('labels and the isolation predicate', () => {
  it('downloads are labeled 24-bit FLAC (lossless)', () => {
    expect(DOOR1_FORMAT_LABEL).toBe('24-bit FLAC (lossless)')
  })

  it('isDoor1 is true for the profile or the route', () => {
    expect(isDoor1({ delivery_profile: 'door1' })).toBe(true)
    expect(isDoor1({ route: 'door1' })).toBe(true)
    expect(isDoor1({ delivery_profile: 'door2', route: 'auto' })).toBe(false)
    expect(isDoor1({})).toBe(false)
  })
})

describe('readDoor1Settings: the stored door1_settings JSON, read back for the console', () => {
  it('reads what door1Settings writes', () => {
    expect(readDoor1Settings({ vocal_denoise: false, restore_mode: 'zeroshot' })).toEqual({
      vocal_denoise: false,
      restore_mode: 'zeroshot',
    })
  })

  it('reads nothing from null, a non-object or an array', () => {
    for (const v of [null, 'x', 3, true, [1, 2]]) expect(readDoor1Settings(v)).toEqual({})
  })

  it('leaves out a key that is missing or the wrong type', () => {
    expect(readDoor1Settings({ vocal_denoise: 'yes', restore_mode: 7 })).toEqual({})
    expect(readDoor1Settings({ restore_mode: 'cascade' })).toEqual({ restore_mode: 'cascade' })
  })
})
