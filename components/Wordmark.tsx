import { Mark } from './Mark'

/**
 * Horizontal utility lockup — nav bars, email signatures, letterheads, contract headers.
 * The STACKED lockup is the primary arrangement; see Footer.
 */
export function Wordmark({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  return (
    <span className="inline-flex items-center gap-3">
      <Mark size={size === 'lg' ? 40 : 26} className="text-indigo" />
      <span
        className={`font-brand tracking-tight ${size === 'lg' ? 'text-4xl' : 'text-2xl'}`}
      >
        lyrical
      </span>
    </span>
  )
}
