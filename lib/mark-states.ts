import {
  outline,
  sampleCentreline,
  POWER_BAR,
  POWER_WAVE,
  SAMPLES,
  WMAX,
  type Pt,
  type Seg,
} from './mark'

/** Upper wave — rises then falls, spanning x 7..57 about y = 20. */
const UPPER: Seg[] = [
  [{ x: 7, y: 20 }, { x: 14, y: 8 }, { x: 22, y: 8 }, { x: 32, y: 20 }],
  [{ x: 32, y: 20 }, { x: 42, y: 32 }, { x: 50, y: 32 }, { x: 57, y: 20 }],
]

/**
 * Lower wave at 6% divergence — APPROVED, do not "tidy" these control points to
 * match UPPER. The asymmetry is the whole claim: same envelope, different signal.
 * A symmetrical pair would mean `=`, which is the one thing the brand never says.
 */
const LOWER: Seg[] = [
  [{ x: 7, y: 44 }, { x: 12.9, y: 38.2 }, { x: 23.6, y: 34.3 }, { x: 32, y: 44 }],
  [{ x: 32, y: 44 }, { x: 41.4, y: 53.7 }, { x: 50.8, y: 50.9 }, { x: 57, y: 42.9 }],
]

/**
 * Straight bars — the `=` beat, and (rotated 90 degrees) the pause beat.
 *
 * Deliberately SHORTER than the waves: x 17..47 rather than 7..57. At full wave length a
 * bar is 9 x 50 units, a 1:5.5 sliver that doesn't read as a pause symbol; at 30 units it
 * is roughly 1:3, which does. Point count is set by SAMPLES and is unaffected by length,
 * so the morph still works — and the bars growing outward into the waves reads as the
 * catalogue opening up, which is the point of the animation.
 */
const BAR_TOP: Seg[] = [
  [{ x: 17, y: 20 }, { x: 27, y: 20 }, { x: 37, y: 20 }, { x: 47, y: 20 }],
]
const BAR_BOTTOM: Seg[] = [
  [{ x: 17, y: 44 }, { x: 27, y: 44 }, { x: 37, y: 44 }, { x: 47, y: 44 }],
]

export type MarkStateShape = { top: Pt[]; bottom: Pt[] }

/** The canonical mark. This is the logo. */
export const APPROX: MarkStateShape = {
  top: outline(sampleCentreline(UPPER, SAMPLES), WMAX, POWER_WAVE),
  bottom: outline(sampleCentreline(LOWER, SAMPLES), WMAX, POWER_WAVE),
}

/** Two straight bars — reads as `=` horizontally, as a pause when rotated 90 degrees. */
export const EQUAL: MarkStateShape = {
  top: outline(sampleCentreline(BAR_TOP, SAMPLES), WMAX, POWER_BAR),
  bottom: outline(sampleCentreline(BAR_BOTTOM, SAMPLES), WMAX, POWER_BAR),
}
