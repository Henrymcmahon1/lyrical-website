import { permanentRedirect } from 'next/navigation'

/**
 * `/queue` became `/admin` on 2026-09-22, folded into the six-tab People/Money/Work/Voice/
 * Relationships/Issues console (`docs/bots/v3/BOT-4-admin-crm.md`).
 *
 * Kept as a redirect rather than deleted, for the same reason `/leads` was kept as a redirect to
 * `/queue` on 2026-08-11: this URL is in bookmarks and in muscle memory, and a 404 here on a
 * Monday morning reads as "the console is gone".
 *
 * `permanentRedirect` is a 308, which preserves the method. Safe here because nothing ever
 * POSTed to this page: the form actions have always had their own endpoints.
 *
 * The old tab names are mapped onto the new ones so a bookmarked `/queue?tab=voices` still lands
 * on the tab that has that content today: songs -> work, voices and feedback -> voice,
 * enquiries -> relationships.
 */
const TAB_MAP: Record<string, string> = {
  songs: 'work',
  voices: 'voice',
  feedback: 'voice',
  enquiries: 'relationships',
}

export default async function QueueRedirect({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; show?: string }>
}) {
  const params = await searchParams
  const tab = params.tab ? (TAB_MAP[params.tab] ?? params.tab) : undefined
  const query = [tab ? `tab=${tab}` : null, params.show === 'all' ? 'show=all' : null]
    .filter(Boolean)
    .join('&')
  permanentRedirect(query ? `/admin?${query}` : '/admin')
}
