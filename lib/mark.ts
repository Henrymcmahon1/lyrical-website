/**
 * The Lyrical mark, generated rather than drawn.
 *
 * Everything is derived from cubic Bezier centrelines that are sampled at a FIXED
 * point count, then offset along their normals by a taper function. Two consequences
 * matter:
 *
 *   1. It is pure — no DOM, no `getPointAtLength` — so it runs on the server and in tests.
 *   2. Every state of the mark has an identical point count by construction, which is
 *      what makes morphing plain array interpolation instead of a morph library.
 *
 * Geometry is LOCKED by the brand spec. Do not adjust WMAX, SAMPLES or the powers.
 */

export type Pt = { x: number; y: number }
export type Seg = [Pt, Pt, Pt, Pt]

/** Artboard is 64 x 64 units. */
export const ART = 64
/** Points sampled along each centreline. Must be identical for every state. */
export const SAMPLES = 58
/** Maximum half-width of the stroke at its belly. */
export const WMAX = 4.6
/** Taper exponent for a wave: pronounced belly, sharp tips. */
export const POWER_WAVE = 0.62
/** Taper exponent for a pause bar: near-uniform, so it reads as a bar not a leaf. */
export const POWER_BAR = 0.1

/** Evaluate a cubic Bezier at t. */
export function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  }
}

/**
 * Sample `n` points across a chain of segments, evenly in t within each segment.
 * Uniform-t rather than uniform arc length: the segments here are of similar
 * length, and uniform t keeps the result exactly reproducible.
 */
export function sampleCentreline(segs: Seg[], n: number): Pt[] {
  if (segs.length === 0) throw new Error('sampleCentreline needs at least one segment')
  if (n < 2) throw new Error('sampleCentreline needs n >= 2')
  const out: Pt[] = []
  for (let i = 0; i < n; i++) {
    const g = (i / (n - 1)) * segs.length
    const si = Math.min(Math.floor(g), segs.length - 1)
    const t = g - si
    const s = segs[si]
    out.push(cubic(s[0], s[1], s[2], s[3], t))
  }
  return out
}

/**
 * Offset a centreline along its normal by w(t) = wmax * sin(pi*t)^power, returning a
 * closed outline: forward down one side, back along the other. Width reaches zero at
 * both tips, so the stroke comes to a point — this is the "modulated" stroke that
 * answers the "looks hand-drawn" objection.
 */
export function outline(centre: Pt[], wmax: number = WMAX, power: number = POWER_WAVE): Pt[] {
  const n = centre.length
  const up: Pt[] = []
  const dn: Pt[] = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const a = centre[Math.max(0, i - 1)]
    const b = centre[Math.min(n - 1, i + 1)]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const m = Math.hypot(dx, dy) || 1
    const nx = -dy / m
    const ny = dx / m
    const w = wmax * Math.pow(Math.sin(Math.PI * t), power)
    up.push({ x: centre[i].x + nx * w, y: centre[i].y + ny * w })
    dn.push({ x: centre[i].x - nx * w, y: centre[i].y - ny * w })
  }
  return [...up, ...dn.reverse()]
}

/** Serialise an outline to an SVG path string, rounded to 2dp. */
export function toPath(pts: Pt[]): string {
  if (pts.length === 0) throw new Error('toPath needs points')
  const f = (v: number) => Math.round(v * 100) / 100
  let d = `M ${f(pts[0].x)} ${f(pts[0].y)}`
  for (let i = 1; i < pts.length; i++) d += ` L ${f(pts[i].x)} ${f(pts[i].y)}`
  return `${d} Z`
}

/**
 * Linearly interpolate two outlines. Requires equal length — which every state
 * satisfies because they all come from `outline(sampleCentreline(..., SAMPLES))`.
 */
export function lerpOutline(a: Pt[], b: Pt[], t: number): Pt[] {
  if (a.length !== b.length) {
    throw new Error(`outline length mismatch: ${a.length} vs ${b.length}`)
  }
  if (t <= 0) return a
  if (t >= 1) return b
  return a.map((p, i) => ({
    x: p.x + (b[i].x - p.x) * t,
    y: p.y + (b[i].y - p.y) * t,
  }))
}
