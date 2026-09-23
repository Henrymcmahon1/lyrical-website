import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { breakGlassEnabled } from '@/lib/admin-identity'
import { requireAdmin } from '@/lib/admin-session'
import { EnquiriesTab } from './EnquiriesTab'
import { FeedbackTab } from './FeedbackTab'
import { IssuesTab } from './IssuesTab'
import { MoneyTab } from './MoneyTab'
import { PeopleTab } from './PeopleTab'
import { SongsTab } from './SongsTab'
import { VoicesTab } from './VoicesTab'
import { login, logout } from './actions'
import { MfaRequired, NotAuthorized } from './Refused'

/**
 * The internal console. Six tabs: People, Money, Work, Voice, Relationships, Issues.
 *
 * This is `/queue` folded into one console, per the v3 admin-CRM brief
 * (`docs/bots/v3/BOT-4-admin-crm.md`). `/queue` itself is now a redirect here (see
 * `app/queue/page.tsx`), the same way `/leads` became a redirect to `/queue` on 2026-08-11.
 *
 * Tab mapping from the old four-tab console: Songs -> Work, Voices + Feedback -> Voice (voice
 * model approval and voice/quality ratings are both "Voice" concerns), Enquiries ->
 * Relationships. People, Money and Issues are new: People is every account, Money is
 * subscriptions/credits/Stripe events, Issues is `crm_issues` plus the worker heartbeat and the
 * storage figure.
 *
 * Shows real people's names, addresses, messages, recordings and account data, so: gated,
 * `noindex`, disallowed in robots.txt, never static, never cached.
 *
 * The gate (since 24 Sep 2026) is `requireAdmin()`: a Supabase identity on the `ADMIN_EMAILS`
 * allowlist, signed in at `/admin/sign-in` with the studio's 6-digit email code. A signed-out
 * visitor is sent there. The old `ADMIN_PASSWORD` form is drawn here ONLY while
 * `ADMIN_BREAK_GLASS=on` (see `lib/admin-identity.ts`).
 */
export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false, nocache: true },
}

export const dynamic = 'force-dynamic'

const SHELL = 'mx-auto w-full max-w-4xl px-6'

type Tab = 'people' | 'money' | 'work' | 'voice' | 'relationships' | 'issues'

const TAB_LABEL: Record<Tab, string> = {
  people: 'People',
  money: 'Money',
  work: 'Work',
  voice: 'Voice',
  relationships: 'Relationships',
  issues: 'Issues',
}

const TAB_ORDER: Tab[] = ['people', 'money', 'work', 'voice', 'relationships', 'issues']

function isTab(value: string | undefined): value is Tab {
  return Boolean(value) && (TAB_ORDER as string[]).includes(value as string)
}

/** The BREAK-GLASS password form. Only ever rendered while `breakGlassEnabled()`. */
function BreakGlassLogin({ error }: { error?: string }) {
  return (
    <section className={`${SHELL} py-24`}>
      <h1 className="font-brand text-4xl tracking-tight">Admin</h1>
      <p className="mt-4 max-w-md text-graphite/70">
        Break-glass sign-in is switched on. The normal way in is{' '}
        <a href="/admin/sign-in" className="underline underline-offset-4">
          signing in with your email
        </a>
        . Use the shared password only if that is unavailable.
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

export default async function AdminPage({
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
    /** Voice tab feedback filters. */
    tag?: string
    rating?: string
    /** Issues tab status filter. */
    status?: string
  }>
}) {
  const [admin, params] = await Promise.all([requireAdmin(), searchParams])

  if (!admin.ok) {
    if (admin.reason === 'not-allowlisted') return <NotAuthorized />
    if (admin.reason === 'mfa-required') return <MfaRequired />
    if (breakGlassEnabled()) return <BreakGlassLogin error={params.error} />
    redirect('/admin/sign-in')
  }

  // Work is the default because it is the tab with a clock running on it.
  const tab: Tab = isTab(params.tab) ? params.tab : 'work'
  const showAll = params.show === 'all'

  const tabHref = (t: Tab) => `/admin?tab=${t}${showAll ? '&show=all' : ''}`
  const viewHref = (all: boolean) => `/admin?tab=${tab}${all ? '&show=all' : ''}`

  return (
    <section className={`${SHELL} py-16`}>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-brand text-4xl tracking-tight">Admin</h1>
        <form action={logout} className="flex items-baseline gap-4">
          <span className="text-sm text-graphite/55">
            {admin.via === 'identity' ? admin.user.email : 'Break-glass session'}
          </span>
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
        aria-label="Admin sections"
        className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-2 border-b border-graphite/15 pb-4"
      >
        {TAB_ORDER.map((t) => (
          <a
            key={t}
            href={tabHref(t)}
            aria-current={tab === t ? 'page' : undefined}
            className={`font-brand text-xl tracking-tight ${
              tab === t ? 'text-indigo' : 'text-graphite/45 hover:text-indigo'
            }`}
          >
            {TAB_LABEL[t]}
          </a>
        ))}
        {/* Door 1 lives on its own pages, inside the same admin area and the same sign-in. */}
        <a href="/admin/door1" className="font-brand text-xl tracking-tight text-graphite/45 hover:text-indigo">
          Door 1
        </a>
      </nav>

      {(tab === 'work' || tab === 'voice' || tab === 'relationships') && (
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
            href={`/admin/export?tab=${tab}`}
            className="ml-auto text-graphite/45 hover:text-indigo"
          >
            Download CSV
          </a>
        </div>
      )}

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
      {params.moved === 'approved' && tab === 'work' && (
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
      {params.moved === 'requeued' && (
        <p role="status" className="mt-6 text-sm text-graphite/70">
          Sent back through the pipeline. The poller will pick it up.
        </p>
      )}
      {params.moved === 'training' && (
        <p role="status" className="mt-6 text-sm text-graphite/70">
          Marked as training.
        </p>
      )}
      {params.moved === 'in_progress' && (
        <p role="status" className="mt-6 text-sm text-graphite/70">
          Marked as being made. No email goes out for this one.
        </p>
      )}
      {params.moved === 'approved' && tab === 'voice' && (
        <p role="status" className="mt-6 text-sm text-graphite/70">
          Voice approved. No email goes out for this one.
        </p>
      )}
      {params.moved === 'ready' && (
        <p role="status" className="mt-6 text-sm text-graphite/70">
          Marked ready. Songs by this artist can use it now.
        </p>
      )}

      {tab === 'work' ? (
        <SongsTab showAll={showAll} confirming={params.confirm} />
      ) : tab === 'voice' ? (
        <>
          <VoicesTab showAll={showAll} />
          <div className="mt-10 flex items-baseline justify-between gap-4 border-t border-graphite/15 pt-6">
            <h2 className="font-brand text-2xl tracking-tight">Feedback</h2>
            <a
              href="/admin/export?tab=feedback"
              className="font-mono text-[11px] uppercase tracking-[0.16em] text-graphite/45 hover:text-indigo"
            >
              Download CSV
            </a>
          </div>
          <FeedbackTab
            tag={params.tag}
            rating={params.rating === 'up' || params.rating === 'down' ? params.rating : undefined}
          />
        </>
      ) : tab === 'relationships' ? (
        <EnquiriesTab
          showAll={showAll}
          confirming={params.confirm}
          deleted={params.deleted === '1'}
        />
      ) : tab === 'people' ? (
        <PeopleTab />
      ) : tab === 'money' ? (
        <MoneyTab />
      ) : (
        <IssuesTab
          status={
            params.status === 'open' || params.status === 'ack' || params.status === 'resolved'
              ? params.status
              : undefined
          }
        />
      )}
    </section>
  )
}
