/**
 * Item typography for the two pinned sections, in one place.
 *
 * `PinnedClaims` and `PinnedStepper` are separate components with near-identical item markup,
 * and their type scales drifted apart: the stepper ended up one step larger on both the
 * heading and the body, so "How it works" read noticeably heavier than "Our technology"
 * directly above it. Two sections doing the same job should not look like two designs.
 *
 * Kept as shared class strings rather than a shared component, because the two differ in what
 * surrounds the item (a numbered step against a claim) and merging them would trade a small
 * duplication for a component with two modes.
 *
 * Change these and both sections move together. That is the point.
 */

/** The item heading. Smaller than the section title above it, which is 3xl / 4xl. */
export const PIN_ITEM_HEADING =
  'mt-3 font-brand text-2xl leading-tight tracking-tight md:text-3xl'

/** The item body. `max-w-md` holds the line length near 65 characters at both breakpoints. */
export const PIN_ITEM_BODY = 'mt-3 max-w-md leading-relaxed text-graphite/75'
