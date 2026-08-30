import { describe, expect, it } from 'vitest'
import { FREE_STORAGE_BYTES, storageSummary } from '@/lib/voice-training'

/**
 * The staff meter. The 1GB free tier is a single global cap, so this is what tells whoever runs
 * the queue that the ceiling is coming before an upload starts failing for a customer.
 */

describe('the storage meter', () => {
  it('reports an empty tier as room for several artists', () => {
    const s = storageSummary(0)
    expect(s.fraction).toBe(0)
    expect(s.near).toBe(false)
    // ~7 artists at 30 min mono FLAC in 1GB. The exact figure is not pinned, only that it is a
    // useful handful rather than zero.
    expect(s.artistsLeft).toBeGreaterThanOrEqual(6)
    expect(s.message).toMatch(/1 GB used/)
  })

  it('never divides past full', () => {
    const s = storageSummary(FREE_STORAGE_BYTES + 5_000_000)
    expect(s.fraction).toBe(1)
    expect(s.artistsLeft).toBe(0)
    expect(s.near).toBe(true)
  })

  it('flags the tier as near full past ~85 percent', () => {
    expect(storageSummary(FREE_STORAGE_BYTES * 0.8).near).toBe(false)
    expect(storageSummary(FREE_STORAGE_BYTES * 0.9).near).toBe(true)
  })

  it('counts fewer artists left as the tier fills', () => {
    const empty = storageSummary(0).artistsLeft
    const half = storageSummary(FREE_STORAGE_BYTES * 0.5).artistsLeft
    expect(half).toBeLessThan(empty)
    expect(half).toBeGreaterThan(0)
  })
})
