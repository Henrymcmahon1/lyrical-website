'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { STUDIO_TABS, activeStudioTab, type StudioTabId } from '@/lib/studio-shell'
import { AccountIcon, BillingIcon, CreateIcon, SongsIcon, VoicesIcon, type NavIconProps } from './NavIcons'

const ICONS: Record<StudioTabId, (p: NavIconProps) => React.JSX.Element> = {
  create: CreateIcon,
  songs: SongsIcon,
  voices: VoicesIcon,
  billing: BillingIcon,
  account: AccountIcon,
}

/**
 * The rail's tabs. Ported from the dashboard's `Sidebar.tsx`: the active tab carries an accent
 * rail on its left edge and the accent glyph, the rest sit at 45% ink and brighten on hover.
 * Client only for `usePathname`; the list itself lives in `lib/studio-shell.ts`.
 *
 * Below `sm` the rail is a bar across the top and the tabs sit in a row, glyph above label, so
 * five of them fit in 375px with no sideways scroll. The layout for that is in `studio.css`.
 */
export function StudioNav() {
  const active = activeStudioTab(usePathname())
  return (
    <nav aria-label="Studio" className="studio-tabs">
      {STUDIO_TABS.map((tab) => {
        const Icon = ICONS[tab.id]
        const isActive = active === tab.id
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={isActive ? 'page' : undefined}
            className={`studio-tab ${isActive ? 'text-dark-ink' : 'text-dark-ink/45 hover:text-dark-ink/70'}`}
          >
            <span aria-hidden="true" className={`studio-tab-rail ${isActive ? 'bg-dark-accent' : 'bg-transparent'}`} />
            <Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-dark-accent' : ''}`} />
            <span>{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
