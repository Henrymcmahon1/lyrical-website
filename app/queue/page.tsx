import type { Metadata } from 'next'
import { hasAdminSession } from '@/lib/admin-session'
import { EnquiriesTab } from './EnquiriesTab'
import { SongsTab } from './SongsTab'
import { login, logout } from './actions'

/**
 * The internal console. Two tabs: Songs and Enquiries.
 *
 * It replaces `/leads`, which is now a redirect so nothing bookmarked breaks. The enquiry half
 * is the same code moved across; the songs half is new and is the thing that was missing, because
 * without it nothing could move a submitted job past "Received" and the customer's status rail
 * described a process with nobody driving it.
 *
 * Shows real people's names, addresses, messages and their unreleased recordings, so: password
 * gated, `noindex`, disallowed in robots.txt, never static, never cached.
 *
 * One password, `ADMIN_PASSWORD`, through the existing `lib/admin-auth.ts`. No second secret was
 * invented for the songs tab: two passwords for one console is two things to rotate and one of
 * them will be the one that gets forgotten.
 */
export const metadata: Metadata = {
  title: 'Queue',
  robots: { index: false, follow: false, nocache: true },
}

export const dynamic = 'force-dynamic'

const SHELL = 'mx-auto w-full max-w-4xl px-6'

type Tab = 'songs' | 'enquiries'

function Login({ error }: { error?: string }) {
  return (
    <section className={`${SHELL} py-24`}>
      <h1 className="font-brand text-4xl tracking-tight">Queue</h1>
      <p className="mt-4 max-w-md text-graphite/70">
        Songs and enquiries. Password protected because this page shows other people&rsquo;s
        contact details and their recordings.
      </p>

      <form action={login} className="mt-10 flex max-w-sm flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm">Password</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            autoFocus
            className="w-full rounded-card border border-graphite/25 bg-transparent px-4 py-3 outline-none transition-colors focus-visible:border-indigo"
          />
        </label>

        {error === '1' && (
          <p role="alert" className="text-sm text-ember">
            That password is not right.
          </p>
        )}
        {error === 'rate' && (
          <p role="alert" className="text-sm text-ember">
            Too many attempts. Wait ten minutes and try again.
          </p>
        )}

        <button
          type="submit"
          className="nudge self-start rounded-card bg-indigo px-6 py-3 text-cream"
        >
          Open
        </button>
      </form>
    </section>
  )
}

export default async function QueuePage({
  searchParams,
}: {
  // Async in Next.js 16.
  searchParams: Promise<{
    tab?: string
    error?: string
    show?: string
    /** The id of the row currently asking to be confirmed for a destructive move. */
    confirm?: string
    deleted?: string
    moved?: string
  }>
}) {
  const [signedIn, params] = await Promise.all([hasAdminSession(), searchParams])

  if (!signedIn) return <Login error={params.error} />

  // Songs is the default because it is the tab with a clock running on it.
  const tab: Tab = params.tab === 'enquiries' ? 'enquiries' : 'songs'
  const showAll = params.show === 'all'

  const tabHref = (t: Tab) => `/queue?tab=${t}${showAll ? '&show=all' : ''}`
  const viewHref = (all: boolean) => `/queue?tab=${tab}${all ? '&show=all' : ''}`

  return (
    <section className={`${SHELL} py-16`}>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-brand text-4xl tracking-tight">Queue</h1>
        <form action={logout}>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center text-sm text-graphite/55 underline underline-offset-4"
          >
            Sign out
          </button>
        </form>
      </div>

      {/* Tabs. Plain links, so the whole console works with JavaScript disabled. */}
      <nav
        aria-label="Queue sections"
        className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-2 border-b border-graphite/15 pb-4"
      >
        <a
          href={tabHref('songs')}
          aria-current={tab === 'songs' ? 'page' : undefined}
          className={`font-brand text-xl tracking-tight ${
            tab === 'songs' ? 'text-indigo' : 'text-graphite/45 hover:text-indigo'
          }`}
        >
          Songs
        </a>
        <a
          href={tabHref('enquiries')}
          aria-current={tab === 'enquiries' ? 'page' : undefined}
          className={`font-brand text-xl tracking-tight ${
            tab === 'enquiries' ? 'text-indigo' : 'text-graphite/45 hover:text-indigo'
          }`}
        >
          Enquiries
        </a>
      </nav>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 font-mono text-[11px] uppercase tracking-[0.16em]">
        <a
          href={viewHref(false)}
          className={showAll ? 'text-graphite/45 hover:text-indigo' : 'text-indigo'}
        >
          To handle
        </a>
        <a
          href={viewHref(true)}
          className={showAll ? 'text-indigo' : 'text-graphite/45 hover:text-indigo'}
        >
          Everything
        </a>
        <a
          href={`/queue/export?tab=${tab}`}
          className="ml-auto text-graphite/45 hover:text-indigo"
        >
          Download CSV
        </a>
      </div>

      {params.error === 'stale' && (
        <p role="status" className="mt-6 text-sm text-ember">
          That job had already moved. Somebody else got there first, so nothing was changed.
        </p>
      )}
      {params.error === 'move' && (
        <p role="status" className="mt-6 text-sm text-ember">
          That is not a move this job can make.
        </p>
      )}
      {params.moved === 'approved' && (
        <p role="status" className="mt-6 text-sm text-graphite/70">
          Accepted. The clock is running and they have been emailed.
        </p>
      )}
      {params.moved === 'delivered' && (
        <p role="status" className="mt-6 text-sm text-graphite/70">
          Marked delivered and they have been emailed. Send them the files.
        </p>
      )}
      {params.moved === 'rejected' && (
        <p role="status" className="mt-6 text-sm text-graphite/70">
          Rejected. No email was sent, so tell them yourself.
        </p>
      )}
      {params.moved === 'in_progress' && (
        <p role="status" className="mt-6 text-sm text-graphite/70">
          Marked as being made. No email goes out for this one.
        </p>
      )}

      {tab === 'songs' ? (
        <SongsTab showAll={showAll} confirming={params.confirm} />
      ) : (
        <EnquiriesTab
          showAll={showAll}
          confirming={params.confirm}
          deleted={params.deleted === '1'}
        />
      )}
    </section>
  )
}
