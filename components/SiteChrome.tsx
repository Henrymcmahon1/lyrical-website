'use client'

import { usePathname } from 'next/navigation'
import { isStudioShellPath } from '@/lib/studio-shell'

/**
 * Decides whether a route wears the public site's chrome.
 *
 * The root layout is the only layout in the app, and a nested layout cannot remove what its
 * parent draws, so the Nav and Footer are handed in here as elements and the pathname decides
 * whether they render. Shell routes (see `lib/studio-shell.ts`) get the children bare and
 * `app/studio/layout.tsx` supplies its own `<main id="main">`; everything else keeps the site
 * frame exactly as before. Nav and Footer stay server components: only the switch is client.
 *
 * `usePathname` resolves during server rendering too, so a visitor with JavaScript off still
 * gets the right frame in the HTML.
 */
export function SiteChrome({
  nav,
  footer,
  children,
}: {
  nav: React.ReactNode
  footer: React.ReactNode
  children: React.ReactNode
}) {
  const pathname = usePathname()
  if (isStudioShellPath(pathname)) return <>{children}</>
  return (
    <>
      {nav}
      <main id="main" className="flex-1">
        {children}
      </main>
      {footer}
    </>
  )
}
