/**
 * Section rule: the two waves, stroked on as the divider enters view.
 * Uses stroked centrelines rather than the filled outline, because stroke-dasharray
 * needs a stroke. Decorative only.
 */
export function Divider() {
  return (
    <div className="mx-auto my-20 max-w-6xl px-6" aria-hidden="true">
      <svg
        viewBox="0 0 640 26"
        className="h-6 w-full text-indigo/35"
        preserveAspectRatio="none"
      >
        <path
          className="stroke-draw"
          d="M0 9 C 70 -3, 150 -3, 250 9 C 350 21, 430 21, 500 9 C 560 -1, 600 -1, 640 7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          className="stroke-draw"
          style={{ animationDelay: '180ms' }}
          d="M0 19 C 60 11, 160 7, 250 19 C 340 31, 440 27, 500 19 C 555 12, 605 13, 640 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  )
}
