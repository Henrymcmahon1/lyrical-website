import { LANGUAGES } from '@/lib/languages'
import { Mark } from './Mark'

/**
 * Ambient language reels. The left column drifts down, the right drifts up, so the pair
 * either side of the mark keeps recombining as you watch.
 *
 * Purely CSS: the list is duplicated once and translated by exactly -50%, which loops
 * seamlessly. No JS, no rAF, nothing to leak. It is decorative, so it is aria-hidden and
 * the real language list lives in the enquiry form.
 *
 * The reels only ever contain the eight languages we actually offer. A blur of unnamed
 * words would imply unlimited capability, which is a claim we do not make.
 */
function Column({ direction }: { direction: 'down' | 'up' }) {
  const items = [...LANGUAGES, ...LANGUAGES]
  return (
    <div className="drift-window">
      <ul className={`drift-list ${direction === 'down' ? 'drift-down' : 'drift-up'}`}>
        {items.map((l, i) => (
          <li
            key={`${l.code}-${i}`}
            className="flex h-14 items-center justify-center font-brand text-2xl text-dark-ink/70 sm:h-16 sm:text-3xl"
          >
            {l.endonym}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function DriftingPairs() {
  return (
    <div
      className="relative flex items-center justify-center gap-4 sm:gap-10"
      aria-hidden="true"
    >
      <Column direction="down" />
      <Mark size={48} className="h-9 w-9 shrink-0 text-dark-accent sm:h-12 sm:w-12" />
      <Column direction="up" />
    </div>
  )
}
