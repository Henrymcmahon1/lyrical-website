import { toPath } from '@/lib/mark'
import { APPROX } from '@/lib/mark-states'

// Generated once at module load — the paths are constant.
const TOP = toPath(APPROX.top)
const BOTTOM = toPath(APPROX.bottom)

/**
 * The canonical mark. Static, one colour, never altered.
 * Colour comes from `currentColor`, so set it with a text colour class.
 */
export function Mark({
  size = 40,
  className = '',
  title,
}: {
  size?: number
  className?: string
  title?: string
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path d={TOP} fill="currentColor" />
      <path d={BOTTOM} fill="currentColor" />
    </svg>
  )
}
