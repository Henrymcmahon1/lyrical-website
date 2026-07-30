import { toPath } from '@/lib/mark'
import { APPROX } from '@/lib/mark-states'

const TOP = toPath(APPROX.top)
const BOTTOM = toPath(APPROX.bottom)

/**
 * The breathing mark. Canonical geometry, animated only by transform — the paths are
 * never regenerated, so the drawing is untouched.
 *
 * Use ONLY where the mark is the subject (a hero, a feature panel). Never in the nav,
 * footer, favicon or on a document: there the mark is an identifier and must be still.
 */
export function MarkLiving({ size = 150 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <path
        d={TOP}
        fill="currentColor"
        style={{
          transformOrigin: '32px 20px',
          animation: 'sway 6s cubic-bezier(.45,0,.55,1) infinite alternate',
        }}
      />
      <path
        d={BOTTOM}
        fill="currentColor"
        style={{
          transformOrigin: '32px 44px',
          animation: 'sway 6s cubic-bezier(.45,0,.55,1) 0.4s infinite alternate-reverse',
        }}
      />
    </svg>
  )
}
