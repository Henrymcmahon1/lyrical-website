/**
 * Monoline glyphs for the studio rail, on the dashboard's 20x20 grid with the same 1.6 stroke:
 * quiet linework that sits next to the wave mark without competing with it. Create, Songs and
 * Voices are the dashboard's own; Billing and Sign out are drawn to the same rules.
 */
export type NavIconProps = { className?: string }

const stroke = {
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
}

/** An empty channel waiting for input: start a new song. */
export function CreateIcon({ className }: NavIconProps) {
  return (
    <svg {...stroke} className={className}>
      <rect x="3.5" y="3.5" width="13" height="13" rx="2" />
      <path d="M10 7v6M7 10h6" />
    </svg>
  )
}

/** A shelf of tracks: the song library. */
export function SongsIcon({ className }: NavIconProps) {
  return (
    <svg {...stroke} className={className}>
      <path d="M3.5 5.5h13M3.5 10h13M3.5 14.5h8" />
    </svg>
  )
}

/** A mic capsule on a stand: voice models. */
export function VoicesIcon({ className }: NavIconProps) {
  return (
    <svg {...stroke} className={className}>
      <rect x="7.5" y="3.5" width="5" height="8" rx="2.5" />
      <path d="M5 9.5a5 5 0 0 0 10 0M10 14.5v2.2M7.5 16.7h5" />
    </svg>
  )
}

/** A card with its stripe: the plan and what is left on it. */
export function BillingIcon({ className }: NavIconProps) {
  return (
    <svg {...stroke} className={className}>
      <rect x="3" y="5" width="14" height="10" rx="1.5" />
      <path d="M3 8.5h14M6 12.5h3" />
    </svg>
  )
}

/** The way out: an arrow leaving the frame. */
export function SignOutIcon({ className }: NavIconProps) {
  return (
    <svg {...stroke} className={className}>
      <path d="M8 3.5H5a1.5 1.5 0 0 0-1.5 1.5v10A1.5 1.5 0 0 0 5 16.5h3M12.5 13.5 16 10l-3.5-3.5M16 10H8" />
    </svg>
  )
}
