import { describe, it, expect, beforeEach } from 'vitest'
import { consume, resetAllLimits } from '@/lib/rate-limit'

const T0 = 1_800_000_000_000
const WINDOW = 60_000

beforeEach(() => resetAllLimits())

describe('consume allows traffic up to the limit', () => {
  it('allows the first request', () => {
    expect(consume('a', 3, WINDOW, T0).allowed).toBe(true)
  })

  it('allows exactly `limit` requests in a window', () => {
    for (let i = 0; i < 3; i++) {
      expect(consume('a', 3, WINDOW, T0 + i).allowed, `request ${i + 1}`).toBe(true)
    }
  })

  it('blocks the one after the limit', () => {
    for (let i = 0; i < 3; i++) consume('a', 3, WINDOW, T0)
    expect(consume('a', 3, WINDOW, T0).allowed).toBe(false)
  })

  it('counts down the remaining allowance', () => {
    expect(consume('a', 3, WINDOW, T0).remaining).toBe(2)
    expect(consume('a', 3, WINDOW, T0).remaining).toBe(1)
    expect(consume('a', 3, WINDOW, T0).remaining).toBe(0)
    expect(consume('a', 3, WINDOW, T0).remaining).toBe(0)
  })
})

describe('the window expires', () => {
  it('allows again once the window has passed', () => {
    for (let i = 0; i < 3; i++) consume('a', 3, WINDOW, T0)
    expect(consume('a', 3, WINDOW, T0 + WINDOW - 1).allowed).toBe(false)
    expect(consume('a', 3, WINDOW, T0 + WINDOW + 1).allowed).toBe(true)
  })

  it('reports how long until the caller may retry', () => {
    for (let i = 0; i < 3; i++) consume('a', 3, WINDOW, T0)
    const blocked = consume('a', 3, WINDOW, T0 + 10_000)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterMs).toBe(WINDOW - 10_000)
  })

  it('reports zero retry time when the caller is allowed', () => {
    expect(consume('a', 3, WINDOW, T0).retryAfterMs).toBe(0)
  })
})

describe('keys are independent', () => {
  it('exhausting one key does not affect another', () => {
    for (let i = 0; i < 3; i++) consume('one', 3, WINDOW, T0)
    expect(consume('one', 3, WINDOW, T0).allowed).toBe(false)
    expect(consume('two', 3, WINDOW, T0).allowed).toBe(true)
  })
})

describe('the store cannot grow without bound', () => {
  it('forgets keys whose window has long expired', () => {
    // Without pruning, one request per unique spoofed IP is an unbounded memory leak, which
    // turns a rate limiter into a denial-of-service vector against ourselves.
    for (let i = 0; i < 500; i++) consume(`ip-${i}`, 3, WINDOW, T0)

    // Far in the future: every old entry is stale and should be dropped.
    const stats = consume('trigger-prune', 3, WINDOW, T0 + WINDOW * 100)
    expect(stats.allowed).toBe(true)
    expect(stats.trackedKeys).toBeLessThan(50)
  })

  it('does not prune entries that are still inside their window', () => {
    consume('keep', 3, WINDOW, T0)
    consume('keep', 3, WINDOW, T0)
    // Same window, so the count must survive.
    expect(consume('keep', 3, WINDOW, T0 + 1000).remaining).toBe(0)
    expect(consume('keep', 3, WINDOW, T0 + 1000).allowed).toBe(false)
  })
})
