import { describe, it, expect } from 'vitest'
import { entryProgress, trackProgress } from '@/lib/scroll-progress'

/**
 * These two functions look interchangeable and are not. Confusing them is the single
 * documented cause of this project's blank-screen class of bug: a fade keyed to
 * `trackProgress` reads 0 at the exact moment a sticky panel already fills the screen.
 *
 * The numbers in the mobile case below are measured, not invented. At 375x812 the audience
 * section is 704px tall, so `rect.height - innerHeight` is -108 and `trackProgress` is
 * forced to 1 at every scroll position — which is why the morph resolved instantly on a
 * phone and never animated.
 */

describe('trackProgress — progress through a sticky track', () => {
  it('is 0 when the panel has just stuck', () => {
    expect(trackProgress({ top: 0, height: 2000 }, 800)).toBe(0)
  })

  it('is 1 when the track has travelled its full scrollable distance', () => {
    // scrollable = 2000 - 800 = 1200
    expect(trackProgress({ top: -1200, height: 2000 }, 800)).toBe(1)
  })

  it('is 0.5 halfway through the travel', () => {
    expect(trackProgress({ top: -600, height: 2000 }, 800)).toBeCloseTo(0.5, 5)
  })

  it('clamps to 0 before the panel sticks', () => {
    expect(trackProgress({ top: 500, height: 2000 }, 800)).toBe(0)
  })

  it('clamps to 1 after the track has released', () => {
    expect(trackProgress({ top: -5000, height: 2000 }, 800)).toBe(1)
  })

  it('is forced to 1 when the track is SHORTER than the viewport', () => {
    // The phone case. There is no travel to measure, so there is no gradient to drive
    // anything with. Any animation keyed to this jumps straight to its end state.
    expect(trackProgress({ top: 700, height: 704 }, 812)).toBe(1)
    expect(trackProgress({ top: 0, height: 704 }, 812)).toBe(1)
    expect(trackProgress({ top: -200, height: 704 }, 812)).toBe(1)
  })

  it('is finite when the viewport height is 0', () => {
    // jsdom and a pre-layout first frame both report 0.
    expect(Number.isFinite(trackProgress({ top: 0, height: 0 }, 0))).toBe(true)
  })
})

describe('entryProgress — progress as a section enters the viewport', () => {
  it('is 0 when the section top sits exactly on the bottom edge', () => {
    expect(entryProgress({ top: 800, height: 2000 }, 800)).toBe(0)
  })

  it('is 1 once the section has travelled its span in viewports', () => {
    // span 0.85 of 800 = 680 travelled, so top = 800 - 680 = 120
    expect(entryProgress({ top: 120, height: 2000 }, 800, 0.85)).toBeCloseTo(1, 5)
  })

  it('clamps to 0 below the viewport and to 1 well past it', () => {
    expect(entryProgress({ top: 3000, height: 2000 }, 800)).toBe(0)
    expect(entryProgress({ top: -3000, height: 2000 }, 800)).toBe(1)
  })

  it('never decreases as the section travels upward', () => {
    let previous = -1
    for (let top = 900; top >= -900; top -= 25) {
      const p = entryProgress({ top, height: 704 }, 812)
      expect(p).toBeGreaterThanOrEqual(previous)
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThanOrEqual(1)
      previous = p
    }
  })

  it('gives a real gradient on the section geometry that forces trackProgress to 1', () => {
    // Same rect and viewport as the measured mobile case above. This is the whole reason
    // the mobile driver differs from the desktop one.
    const rect = (top: number) => ({ top, height: 704 })
    expect(entryProgress(rect(700), 812)).toBeCloseTo(0.16, 2)
    expect(entryProgress(rect(400), 812)).toBeCloseTo(0.6, 2)
    expect(entryProgress(rect(200), 812)).toBeCloseTo(0.89, 2)
    expect(entryProgress(rect(0), 812)).toBe(1)
  })

  it('does not depend on the height of the section', () => {
    const short = entryProgress({ top: 300, height: 200 }, 800)
    const tall = entryProgress({ top: 300, height: 9000 }, 800)
    expect(short).toBe(tall)
  })

  it('is finite when the viewport height is 0', () => {
    expect(Number.isFinite(entryProgress({ top: 0, height: 0 }, 0))).toBe(true)
    expect(Number.isFinite(entryProgress({ top: 50, height: 0 }, 0))).toBe(true)
  })
})
