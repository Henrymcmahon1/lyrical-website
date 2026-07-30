/**
 * Two ways to turn a scroll position into a 0..1 number, kept apart on purpose.
 *
 * They are not interchangeable, and confusing them is the documented cause of this
 * project's blank-screen bugs. `trackProgress` is 0 at the moment a sticky panel becomes
 * stuck — by which point the panel already fills the screen — so a fade keyed to it starts
 * at `opacity: 0` on a full screen. `entryProgress` is 0 while the section is still below
 * the fold, so anything keyed to it has already arrived by the time it is in view.
 *
 * Rule of thumb: pin choreography uses `trackProgress`; anything that fades, and anything
 * on a viewport with no sticky track at all, uses `entryProgress`.
 *
 * Pure, DOM-free and viewport-agnostic so both are testable without a browser.
 */

/** The parts of a DOMRect these functions read. */
export type Rect = { top: number; height: number }

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  if (n <= 0) return 0 // `<=` rather than `<`, so a negative zero normalises to +0
  return n > 1 ? 1 : n
}

/**
 * Progress through a sticky track: 0 when the panel sticks, 1 when it releases.
 *
 * A track no taller than the viewport has no travel to measure, so there is no gradient
 * available and this returns 1 — the end state. That is correct as a definition and
 * disastrous as a driver: it is exactly what made the audience morph resolve instantly on
 * a phone, where the section is 704px inside an 812px viewport. Below the pinning
 * breakpoint, use `entryProgress`.
 */
export function trackProgress(rect: Rect, vh: number): number {
  const scrollable = rect.height - vh
  if (scrollable <= 0) return 1
  return clamp01(-rect.top / scrollable)
}

/**
 * Progress as a section enters the viewport: 0 when its top touches the bottom edge, 1
 * after it has travelled `span` viewport heights upward.
 *
 * Independent of the section's own height, so it behaves the same whether or not a sticky
 * track exists. This is the formula S09bNow already used to avoid fading a full screen to
 * nothing.
 */
export function entryProgress(rect: Rect, vh: number, span = 0.85): number {
  const travel = vh * span
  // No measurable viewport (pre-layout, or jsdom). Fall back to a binary answer rather
  // than dividing by zero.
  if (travel <= 0) return rect.top <= 0 ? 1 : 0
  return clamp01((vh - rect.top) / travel)
}
