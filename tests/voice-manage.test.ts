import { describe, expect, it } from 'vitest'
import { VOICE_STATUSES, VoiceTakesSchema } from '@/lib/voice-schema'

/**
 * The contracts the manager relies on: retiring is a real lifecycle state, and adding takes to an
 * existing voice needs a voice id and at least one sample but no fresh artist name or consent.
 */

describe('the voice lifecycle', () => {
  it('includes retired, which is what a purge sets', () => {
    expect(VOICE_STATUSES).toContain('retired')
  })
})

describe('adding takes to an existing voice', () => {
  const sample = {
    path: 'u/v/sample-9.flac',
    filename: 'take.flac',
    bytes: 5_000_000,
    seconds: 120,
  }

  it('accepts a voice id and at least one sample, with no artist name or consent', () => {
    const r = VoiceTakesSchema.safeParse({
      voiceId: '11111111-1111-4111-8111-111111111111',
      samples: [sample],
    })
    expect(r.success).toBe(true)
  })

  it('refuses an empty set: there is nothing to add', () => {
    const r = VoiceTakesSchema.safeParse({
      voiceId: '11111111-1111-4111-8111-111111111111',
      samples: [],
    })
    expect(r.success).toBe(false)
  })

  it('refuses a non-UUID voice id', () => {
    const r = VoiceTakesSchema.safeParse({ voiceId: 'nope', samples: [sample] })
    expect(r.success).toBe(false)
  })
})
