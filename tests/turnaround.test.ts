import { describe, expect, it } from 'vitest'
import { TURNAROUND_BUSY, TURNAROUND_PROMISE, turnaroundLine } from '@/lib/turnaround'

/**
 * The single source of truth for the Door-2 self-serve turnaround promise (CONFIRMED 22 Sep):
 * one line for every plan, "usually within 1 hour", with the exception "up to 3 hours at busy
 * times". Every place that states the studio's speed reads from here, so the number can never
 * drift between a plan card, a notice and an email.
 */
describe('lib/turnaround', () => {
  it('exports the exact promise and busy-time strings, with no em dashes', () => {
    expect(TURNAROUND_PROMISE).toBe('usually within 1 hour')
    expect(TURNAROUND_BUSY).toBe('up to 3 hours at busy times')
    expect(TURNAROUND_PROMISE).not.toMatch(/—/)
    expect(TURNAROUND_BUSY).not.toMatch(/—/)
  })

  it('combines both into one sentence for copy', () => {
    const line = turnaroundLine()
    expect(line).toContain(TURNAROUND_PROMISE)
    expect(line).toContain(TURNAROUND_BUSY)
    expect(line).not.toMatch(/—/)
  })
})
