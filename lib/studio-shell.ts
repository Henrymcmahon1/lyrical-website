/**
 * The studio shell's tab list and path rules, kept pure so the layout, the nav and the root
 * chrome switch all read one source and the tests can pin it without rendering anything.
 *
 * Mirrors `features/registry.ts` in the staff dashboard (lyrical-studio): sidebar order, labels
 * and routes come from this list and nothing in the shell components changes when a tab does.
 */
export type StudioTabId = 'create' | 'songs' | 'voices' | 'billing' | 'account'

export type StudioTab = {
  id: StudioTabId
  label: string
  href: string
}

export const STUDIO_TABS: readonly StudioTab[] = [
  { id: 'create', label: 'Create', href: '/studio/new' },
  { id: 'songs', label: 'Songs', href: '/studio' },
  { id: 'voices', label: 'Voices', href: '/studio/voices' },
  { id: 'billing', label: 'Billing', href: '/studio/billing' },
  { id: 'account', label: 'Account', href: '/studio/account' },
]

const SIGN_IN = '/studio/sign-in'

/**
 * Whether a pathname is drawn inside the studio shell. Everything under /studio is, except the
 * sign-in page, which keeps the public site's Nav and Footer: it is the door between the two.
 */
export function isStudioShellPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  if (pathname === SIGN_IN || pathname.startsWith(`${SIGN_IN}/`)) return false
  return pathname === '/studio' || pathname.startsWith('/studio/')
}

/** The tab a pathname lights, or null when none does (the sign-in page, a public page). */
export function activeStudioTab(pathname: string | null | undefined): StudioTabId | null {
  if (!isStudioShellPath(pathname) || !pathname) return null
  // Longest href first, so /studio/voices/new lights Voices and never Songs.
  const ordered = [...STUDIO_TABS].sort((a, b) => b.href.length - a.href.length)
  for (const tab of ordered) {
    if (pathname === tab.href || pathname.startsWith(`${tab.href}/`)) return tab.id
  }
  return null
}
