import { describe, it, expect } from 'vitest'
import {
  cubic,
  sampleCentreline,
  outline,
  toPath,
  lerpOutline,
  SAMPLES,
  ART,
  type Seg,
} from '@/lib/mark'
import { APPROX, EQUAL } from '@/lib/mark-states'

describe('cubic', () => {
  it('hits both endpoints exactly', () => {
    const p: Seg = [{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 0 }]
    expect(cubic(p[0], p[1], p[2], p[3], 0)).toEqual({ x: 0, y: 0 })
    expect(cubic(p[0], p[1], p[2], p[3], 1)).toEqual({ x: 10, y: 0 })
  })
})

describe('sampleCentreline', () => {
  const seg: Seg = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 0 }]

  it('returns exactly n points', () => {
    expect(sampleCentreline([seg, seg], SAMPLES)).toHaveLength(SAMPLES)
  })

  it('is deterministic', () => {
    expect(sampleCentreline([seg], 12)).toEqual(sampleCentreline([seg], 12))
  })
})

describe('outline', () => {
  const centre = sampleCentreline(
    [
      [{ x: 7, y: 20 }, { x: 14, y: 8 }, { x: 22, y: 8 }, { x: 32, y: 20 }],
      [{ x: 32, y: 20 }, { x: 42, y: 32 }, { x: 50, y: 32 }, { x: 57, y: 20 }],
    ] as Seg[],
    SAMPLES,
  )

  it('produces two points per sample (both sides of the stroke)', () => {
    expect(outline(centre)).toHaveLength(SAMPLES * 2)
  })

  it('tapers to zero width at both tips', () => {
    const o = outline(centre)
    const firstUp = o[0]
    const lastDn = o[o.length - 1]
    expect(Math.hypot(firstUp.x - lastDn.x, firstUp.y - lastDn.y)).toBeLessThan(0.01)
  })

  it('is widest near the middle', () => {
    const o = outline(centre)
    const width = (i: number) =>
      Math.hypot(o[i].x - o[o.length - 1 - i].x, o[i].y - o[o.length - 1 - i].y)
    expect(width(Math.floor(SAMPLES / 2))).toBeGreaterThan(width(3))
  })
})

describe('artboard containment', () => {
  it('every state stays inside the 64-unit artboard', () => {
    for (const [name, state] of Object.entries({ APPROX, EQUAL })) {
      for (const pts of [state.top, state.bottom]) {
        for (const p of pts) {
          expect(p.x, `${name} x`).toBeGreaterThanOrEqual(0)
          expect(p.x, `${name} x`).toBeLessThanOrEqual(ART)
          expect(p.y, `${name} y`).toBeGreaterThanOrEqual(0)
          expect(p.y, `${name} y`).toBeLessThanOrEqual(ART)
        }
      }
    }
  })
})

describe('morph compatibility', () => {
  it('every state has identical point counts — this is what makes lerp work', () => {
    expect(APPROX.top).toHaveLength(EQUAL.top.length)
    expect(APPROX.bottom).toHaveLength(EQUAL.bottom.length)
    expect(APPROX.top).toHaveLength(SAMPLES * 2)
  })

  it('lerp at 0 and 1 returns the endpoints', () => {
    expect(lerpOutline(EQUAL.top, APPROX.top, 0)).toEqual(EQUAL.top)
    expect(lerpOutline(EQUAL.top, APPROX.top, 1)).toEqual(APPROX.top)
  })

  it('throws rather than silently producing junk on a length mismatch', () => {
    expect(() => lerpOutline(APPROX.top, APPROX.top.slice(1), 0.5)).toThrow(/mismatch/)
  })
})

describe('the mark means approximately equal, not equal', () => {
  it('the lower wave is not merely the upper wave shifted down', () => {
    const shifted = APPROX.top.map((p) => ({ x: p.x, y: p.y + 24 }))
    const maxDelta = Math.max(
      ...APPROX.bottom.map((p, i) => Math.hypot(p.x - shifted[i].x, p.y - shifted[i].y)),
    )
    expect(maxDelta).toBeGreaterThan(0.4)
  })

  it('but the divergence stays subtle — refined, not sloppy', () => {
    const shifted = APPROX.top.map((p) => ({ x: p.x, y: p.y + 24 }))
    const maxDelta = Math.max(
      ...APPROX.bottom.map((p, i) => Math.hypot(p.x - shifted[i].x, p.y - shifted[i].y)),
    )
    expect(maxDelta).toBeLessThan(8)
  })
})

describe('the bar state is flatter than the wave state', () => {
  it('holds, so the Unlock animation reads as bars becoming waves', () => {
    const spread = (pts: { y: number }[]) =>
      Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y))
    expect(spread(EQUAL.top)).toBeLessThan(spread(APPROX.top))
  })
})

describe('toPath', () => {
  it('emits a closed path with no NaN', () => {
    const d = toPath(APPROX.top)
    expect(d.startsWith('M')).toBe(true)
    expect(d.endsWith('Z')).toBe(true)
    expect(d).not.toContain('NaN')
  })

  it('stays valid at every step of the Unlock morph', () => {
    for (let i = 0; i <= 20; i++) {
      const d = toPath(lerpOutline(EQUAL.top, APPROX.top, i / 20))
      expect(d).not.toContain('NaN')
      expect(d.startsWith('M')).toBe(true)
    }
  })
})

describe('the Unlock always resolves to the real logo', () => {
  it('its final frame is byte-identical to the canonical mark', () => {
    // MarkUnlock renders toPath(lerpOutline(EQUAL, APPROX, t)); Mark renders toPath(APPROX).
    // At t = 1 those must be the same string, or the animation ends on a lie.
    expect(toPath(lerpOutline(EQUAL.top, APPROX.top, 1))).toBe(toPath(APPROX.top))
    expect(toPath(lerpOutline(EQUAL.bottom, APPROX.bottom, 1))).toBe(toPath(APPROX.bottom))
  })

  it('its first frame is the pause bars, not the waves', () => {
    expect(toPath(lerpOutline(EQUAL.top, APPROX.top, 0))).toBe(toPath(EQUAL.top))
    expect(toPath(lerpOutline(EQUAL.top, APPROX.top, 0))).not.toBe(toPath(APPROX.top))
  })
})

describe('the pause bars read as a pause symbol', () => {
  it('each bar is roughly 1:3, not a sliver', () => {
    const xs = EQUAL.top.map((p) => p.x)
    const ys = EQUAL.top.map((p) => p.y)
    const length = Math.max(...xs) - Math.min(...xs)
    const thickness = Math.max(...ys) - Math.min(...ys)
    const ratio = length / thickness
    expect(ratio).toBeGreaterThan(2.5)
    expect(ratio).toBeLessThan(4.5)
  })

  it('the bars are shorter than the waves, so the morph opens outward', () => {
    const span = (pts: { x: number }[]) =>
      Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x))
    expect(span(EQUAL.top)).toBeLessThan(span(APPROX.top))
  })
})
