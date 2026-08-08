import type { Metadata } from 'next'
import { hasAdminSession } from '@/lib/admin-session'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { deleteLead, login, logout, setHandled } from './actions'

/**
 * The enquiry inbox.
 *
 * Shows real people's names, addresses and messages, so: password-gated, `noindex`, and
 * disallowed in robots.txt. It is never rendered statically and never cached.
 */
export const metadata: Metadata = {
  title: 'Leads',
  robots: { index: false, follow: false, nocache: true },
}

export const dynamic = 'force-dynamic'

type Lead = {
  id: string
  created_at: string
  name: string
  email: string
  role: string
  company: string | null
  catalogue_size: string | null
  target_languages: string[] | null
  message: string | null
  source: string | null
  unlocked_audio: boolean
  handled: boolean
}

const SHELL = 'mx-auto w-full max-w-4xl px-6'

/**
 * How many enquiries one page shows.
 *
 * There is no pagination yet, so this is a ceiling rather than a page size. It is only safe
 * because the page now says when it has hit it. If that message ever disappears, this cap
 * becomes silent data loss from the operator's point of view.
 */
const PAGE_SIZE = 500

/**
 * Readable form of the catalog-size answer.
 *
 * The raw values are form option keys, so rendering `${value} songs` produced "unsure songs",
 * which reads as though somebody is unsure what a song is.
 */
const CATALOGUE_LABEL: Record<string, string> = {
  '1': 'One song',
  '2-10': '2 to 10 songs',
  '11-100': '11 to 100 songs',
  '100+': '100+ songs',
  unsure: 'Size not known',
}

function Login({ error }: { error?: string }) {
  return (
    <section className={`${SHELL} py-24`}>
      <h1 className="font-brand text-4xl tracking-tight">Leads</h1>
      <p className="mt-4 max-w-md text-graphite/70">
        Enquiries from the site. Password protected because this page shows other
        people&rsquo;s contact details.
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

function Setup({ detail }: { detail: string }) {
  return (
    <section className={`${SHELL} py-24`}>
      <h1 className="font-brand text-4xl tracking-tight">Nearly there</h1>
      <p className="mt-5 max-w-xl text-graphite/75">
        The password worked, but the enquiries table cannot be read yet. Run{' '}
        <code className="font-mono text-sm">supabase/schema.sql</code> in the Supabase SQL
        editor and reload this page.
      </p>
      <p className="mt-4 max-w-xl font-mono text-xs leading-relaxed text-graphite/55">{detail}</p>
    </section>
  )
}

export default async function LeadsPage({
  searchParams,
}: {
  // Async in Next.js 16.
  searchParams: Promise<{
    error?: string
    show?: string
    /** The id of the lead currently asking to be confirmed for deletion. */
    confirm?: string
    deleted?: string
  }>
}) {
  const [signedIn, params] = await Promise.all([hasAdminSession(), searchParams])

  if (!signedIn) return <Login error={params.error} />

  const showAll = params.show === 'all'
  const confirming = params.confirm

  /**
   * `count: 'exact'` counts every matching row, not just the page returned.
   *
   * Without it the cap below is invisible: at 501 enquiries the oldest simply stopped
   * appearing and nothing said so, which is the kind of thing you find out at the worst
   * possible moment. The count is what lets the page admit it is showing a subset.
   */
  let query = supabaseAdmin()
    .from('enquiries')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE)
  if (!showAll) query = query.eq('handled', false)

  const { data, error, count } = await query
  if (error) return <Setup detail={`${error.code ?? ''} ${error.message}`.trim()} />

  const leads = (data ?? []) as Lead[]
  const total = count ?? leads.length
  const truncated = total > leads.length

  return (
    <section className={`${SHELL} py-16`}>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-brand text-4xl tracking-tight">Leads</h1>
        <form action={logout}>
          <button type="submit" className="text-sm text-graphite/55 underline underline-offset-4">
            Sign out
          </button>
        </form>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-graphite/15 pb-5 font-mono text-[11px] uppercase tracking-[0.16em]">
        <a
          href="/leads"
          className={showAll ? 'text-graphite/45 hover:text-indigo' : 'text-indigo'}
        >
          To handle
        </a>
        <a
          href="/leads?show=all"
          className={showAll ? 'text-indigo' : 'text-graphite/45 hover:text-indigo'}
        >
          Everything
        </a>
        <span className="text-graphite/45 tabular-nums">
          {truncated
            ? `Newest ${leads.length} of ${total}`
            : `${total} ${total === 1 ? 'lead' : 'leads'}`}
        </span>
        <a href="/leads/export" className="ml-auto text-graphite/45 hover:text-indigo">
          Download CSV
        </a>
      </div>

      {params.deleted === '1' && (
        <p role="status" className="mt-6 text-sm text-graphite/70">
          Enquiry deleted.
        </p>
      )}

      {leads.length === 0 ? (
        <p className="mt-12 text-graphite/60">
          {showAll
            ? 'Nothing has come through yet.'
            : 'Nothing waiting. Every enquiry has been handled.'}
        </p>
      ) : (
        <ol className="mt-2">
          {leads.map((l) => (
            <li key={l.id} className="border-b border-graphite/12 py-6">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="font-brand text-2xl tracking-tight">{l.name}</h2>
                <a
                  href={`mailto:${l.email}`}
                  className="text-indigo underline underline-offset-4"
                >
                  {l.email}
                </a>
                {l.handled && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-graphite/40">
                    Handled
                  </span>
                )}
                <time
                  dateTime={l.created_at}
                  className="ml-auto font-mono text-[11px] tabular-nums text-graphite/45"
                >
                  {new Date(l.created_at).toLocaleString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              </div>

              <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/50">
                <div className="flex gap-2">
                  <dt className="sr-only">Role</dt>
                  <dd>{l.role}</dd>
                </div>
                {l.company && (
                  <div className="flex gap-2">
                    <dt className="sr-only">Company</dt>
                    <dd>{l.company}</dd>
                  </div>
                )}
                {l.catalogue_size && (
                  <div className="flex gap-2">
                    <dt className="sr-only">Catalog</dt>
                    <dd>{CATALOGUE_LABEL[l.catalogue_size] ?? l.catalogue_size}</dd>
                  </div>
                )}
                {l.target_languages?.length ? (
                  <div className="flex gap-2">
                    <dt className="sr-only">Languages</dt>
                    <dd>{l.target_languages.join(', ')}</dd>
                  </div>
                ) : null}
                {l.source === 'gate' && (
                  <div className="flex gap-2">
                    <dt className="sr-only">Source</dt>
                    <dd className="text-ember">Asked for examples</dd>
                  </div>
                )}
              </dl>

              {l.message && (
                <p className="mt-4 max-w-2xl whitespace-pre-line leading-relaxed text-graphite/80">
                  {l.message}
                </p>
              )}

              {/*
                Confirm as a page state, not a browser dialog.

                `confirm()` would not exist with JavaScript disabled, and this deletion cannot
                be undone. A link into a confirm state and a second, explicit submit works
                everywhere and makes the destructive step deliberate. The real guard is the
                session check inside the action; this only stops an accidental click.
              */}
              {confirming === l.id ? (
                <div className="mt-4 rounded-card border border-ember/40 p-4">
                  <p className="text-sm text-graphite">
                    Delete this enquiry permanently? This cannot be undone, and it removes
                    what {l.name} wrote as well as their contact details.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <form action={deleteLead}>
                      <input type="hidden" name="id" value={l.id} />
                      <input type="hidden" name="show" value={showAll ? 'all' : ''} />
                      <button
                        type="submit"
                        className="rounded-card bg-ember px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-cream"
                      >
                        Yes, delete it
                      </button>
                    </form>
                    <a
                      href={showAll ? '/leads?show=all' : '/leads'}
                      className="font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/55 underline underline-offset-4 hover:text-indigo"
                    >
                      Cancel
                    </a>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <form action={setHandled}>
                    <input type="hidden" name="id" value={l.id} />
                    <input type="hidden" name="handled" value={String(!l.handled)} />
                    <button
                      type="submit"
                      className="rounded-card border border-graphite/25 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/60 transition-colors hover:border-indigo hover:text-indigo"
                    >
                      {l.handled ? 'Move back to handle' : 'Mark handled'}
                    </button>
                  </form>
                  <a
                    href={`${showAll ? '/leads?show=all&' : '/leads?'}confirm=${l.id}`}
                    className="font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/40 underline underline-offset-4 hover:text-ember"
                  >
                    Delete
                  </a>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
