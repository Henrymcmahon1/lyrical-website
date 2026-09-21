/**
 * The studio's UI kit, ported from the staff dashboard (lyrical-studio `components/`): Panel,
 * StatChip, Field, plus the class strings for buttons and raw form controls that the dashboard
 * keeps in `formStyles.ts`. Everything here is presentational and server-renderable.
 *
 * The dark treatment's tokens only: ground, ink and accent. Indigo never appears on the dark
 * ground (2.7:1), so the identity colour is reserved for the cream panel. There is no fifth
 * colour: error surfaces use the accent at low alpha rather than the dashboard's `danger`.
 */
import type { ReactNode } from 'react'

const cn = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ')

/** Uppercase tracked label, the eyebrow typography the whole shell shares. */
export const eyebrow = 'font-product text-[11px] uppercase tracking-[0.14em] text-dark-ink/60'

/**
 * A raw text, number, select, file or textarea control on the dark ground: hairline border, a
 * shade lifted off the panel, accent focus ring from `studio.css`. `[&>option]` paints the
 * native select popup so Windows Chrome does not draw ink text on a white system menu.
 */
export const control =
  'w-full rounded-card border border-dark-ink/15 bg-dark-ink/4 px-3 py-2.5 font-product text-sm text-dark-ink ' +
  'placeholder:text-dark-ink/35 transition-colors duration-150 outline-none hover:border-dark-ink/25 ' +
  'focus:border-dark-ink/40 [&>option]:bg-dark-ground [&>option]:text-dark-ink [&>optgroup]:bg-dark-ground ' +
  'file:mr-3 file:rounded-card file:border-0 file:bg-dark-ink/10 file:px-3 file:py-1 file:font-product file:text-xs file:text-dark-ink'

const buttonBase =
  'nudge relative inline-flex min-h-11 items-center justify-center gap-2 rounded-card px-4 py-2 ' +
  'font-product text-sm font-semibold tracking-wide transition-[opacity,transform] duration-150 ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

/** The console's one physical control, in its two weights. */
export const button = {
  primary: `${buttonBase} bg-dark-accent text-dark-ground hover:opacity-90 active:opacity-80`,
  ghost: `${buttonBase} border border-dark-ink/20 bg-transparent text-dark-ink hover:border-dark-ink/40 hover:bg-dark-ink/5`,
} as const

/** A quiet inline link on the dark ground. Ink, never indigo. */
export const link = 'text-sm text-dark-ink/70 underline decoration-dark-ink/30 underline-offset-4 transition-colors hover:text-dark-ink hover:decoration-dark-ink'

/** A chip-style choice (radio or checkbox label) that lights on check. */
export const chip =
  'cursor-pointer rounded-card border border-dark-ink/20 text-dark-ink/80 transition-colors hover:border-dark-ink/40 ' +
  'has-[:checked]:border-dark-accent has-[:checked]:text-dark-ink has-[:checked]:bg-dark-accent/10'

/**
 * The console's surface unit. `dark` is a rack panel lifted a shade off the ground it sits on;
 * `cream` is the paper-and-ink surface for explainer content embedded inside the dark app. No
 * gradients, one hairline border, 4px corners.
 */
export function Panel({
  tone = 'dark',
  title,
  titleId,
  children,
  className,
  as: Tag = 'section',
}: {
  tone?: 'dark' | 'cream'
  title?: ReactNode
  titleId?: string
  children: ReactNode
  className?: string
  as?: 'section' | 'li' | 'div' | 'article'
}) {
  const cream = tone === 'cream'
  return (
    <Tag
      className={cn(
        'rounded-card border p-5',
        cream ? 'border-graphite/10 bg-cream text-graphite' : 'border-dark-ink/10 bg-dark-ink/4 text-dark-ink',
        className,
      )}
    >
      {title ? (
        <h2 id={titleId} className={cn('mb-3 font-brand text-lg font-semibold leading-tight', cream ? 'text-graphite' : 'text-dark-ink')}>
          {title}
        </h2>
      ) : null}
      {children}
    </Tag>
  )
}

/**
 * A compact meter readout: uppercase tracked label, Fraunces value. A row of these reads as one
 * instrument panel, which is how the plan card is drawn.
 */
export function StatChip({
  label,
  value,
  tone = 'neutral',
  className,
}: {
  label: string
  value: ReactNode
  tone?: 'neutral' | 'action'
  className?: string
}) {
  return (
    <div
      className={cn(
        'inline-flex items-baseline gap-2 rounded-card border bg-dark-ink/3 px-3 py-1.5',
        tone === 'action' ? 'border-dark-accent/40 text-dark-accent' : 'border-dark-ink/15 text-dark-ink',
        className,
      )}
    >
      <span className="font-product text-[10px] uppercase tracking-[0.14em] text-dark-ink/50">{label}</span>
      <span className="font-brand text-base font-medium leading-none">{value}</span>
    </div>
  )
}

/** A labelled form field: uppercase Archivo label, the control, an optional hint line. */
export function Field({
  label,
  hint,
  children,
  className,
  as: Tag = 'label',
}: {
  label: ReactNode
  hint?: ReactNode
  children: ReactNode
  className?: string
  /** `label` wraps the control so a click focuses it; `div` for groups of several controls. */
  as?: 'label' | 'div'
}) {
  return (
    <Tag className={cn('flex flex-col gap-1.5', className)}>
      <span className={eyebrow}>{label}</span>
      {children}
      {hint ? <span className="font-product text-xs leading-relaxed text-dark-ink/45">{hint}</span> : null}
    </Tag>
  )
}

/** A status line: a submitted-and-received notice, a paid confirmation, an added voice. */
export function Notice({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'alert' }) {
  return (
    <p
      role={tone === 'alert' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-3 rounded-card border px-4 py-3 font-product text-sm leading-relaxed text-dark-ink',
        tone === 'alert' ? 'border-dark-accent/40 bg-dark-accent/10' : 'border-dark-ink/15 bg-dark-ink/4',
      )}
    >
      <span aria-hidden="true" className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', tone === 'alert' ? 'bg-dark-accent' : 'bg-dark-ink/60')} />
      <span>{children}</span>
    </p>
  )
}

/** The page header inside the shell: eyebrow, Fraunces title, an optional lead. */
export function PageHead({ eyebrow: kicker = 'The studio', title, lead, aside }: { eyebrow?: string; title: ReactNode; lead?: ReactNode; aside?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <span className={eyebrow}>{kicker}</span>
        <h1 className="mt-2 font-brand text-2xl font-semibold leading-tight tracking-tight text-dark-ink sm:text-3xl">{title}</h1>
        {lead ? <p className="mt-3 max-w-xl font-product text-sm leading-relaxed text-dark-ink/70">{lead}</p> : null}
      </div>
      {aside}
    </header>
  )
}
