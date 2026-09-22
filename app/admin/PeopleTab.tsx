import { listNotes, listTasks, type CrmNote, type CrmTask } from '@/lib/crm'
import { getBillingSummary } from '@/lib/entitlement-db'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { addPersonNote, addPersonTask } from './people-actions'

/**
 * Every account: the auth user, their profile, their plan and usage, their sign-in method, and
 * staff notes/next-actions against them.
 *
 * Reads with `supabaseAdmin()`, the service role client, exactly like every other `/admin` tab.
 * `auth.users` is not a PostgREST table, so the user list and the sign-in method both come from
 * the admin auth API (`listUsers`), the same call `SongsTab`/`VoicesTab` already make to resolve
 * an email address.
 */

type Profile = {
  id: string
  name: string | null
  company: string | null
  role: string | null
  stripe_customer_id: string | null
  licence_terms_version: string | null
}

function signInMethod(identities: { provider: string }[] | undefined): string {
  if (!identities?.length) return 'unknown'
  return identities.map((i) => (i.provider === 'email' ? 'email code' : i.provider)).join(', ')
}

function when(iso: string | null | undefined): string {
  if (!iso) return 'never'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export async function PeopleTab() {
  const db = supabaseAdmin()

  const [usersResult, profilesResult] = await Promise.all([
    db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    db
      .from('profiles')
      .select('id, name, company, role, stripe_customer_id, licence_terms_version'),
  ])

  if (usersResult.error) {
    return (
      <p className="mt-12 max-w-xl text-graphite/70">
        Accounts could not be read.
        <span className="mt-3 block font-mono text-xs text-graphite/50">
          {usersResult.error.message}
        </span>
      </p>
    )
  }

  const profileById = new Map<string, Profile>()
  for (const p of (profilesResult.data ?? []) as Profile[]) profileById.set(p.id, p)

  const users = usersResult.data.users

  if (!users.length) {
    return <p className="mt-12 text-graphite/60">No accounts yet.</p>
  }

  const rows = await Promise.all(
    users.map(async (u) => {
      const [billing, notes, tasks] = await Promise.all([
        getBillingSummary(u.id, db).catch(() => null),
        listNotes({ userId: u.id }, db).catch(() => [] as CrmNote[]),
        listTasks({ userId: u.id, openOnly: true }, db).catch(() => [] as CrmTask[]),
      ])
      return { user: u, profile: profileById.get(u.id) ?? null, billing, notes, tasks }
    }),
  )

  return (
    <>
      <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-graphite/45">
        {rows.length} {rows.length === 1 ? 'account' : 'accounts'}
      </p>

      <ol className="mt-2">
        {rows.map(({ user, profile, billing, notes, tasks }) => (
          <li key={user.id} className="border-b border-graphite/12 py-7">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="font-brand text-2xl tracking-tight">
                {profile?.name || user.email || 'Unknown'}
              </h3>
              {user.email && (
                <a href={`mailto:${user.email}`} className="text-sm text-indigo hover:underline">
                  {user.email}
                </a>
              )}
              <time className="ml-auto font-mono text-[11px] tabular-nums text-graphite/45">
                last seen {when(user.last_sign_in_at)}
              </time>
            </div>

            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/50">
              <div>
                <dt className="sr-only">Plan</dt>
                <dd>
                  {billing?.entitlement.ok
                    ? billing.entitlement.source === 'subscription'
                      ? `${billing.sub?.tier ?? 'plan'} (${billing.usedThisPeriod} used)`
                      : `credit (${billing.creditBalance} left)`
                    : 'no plan'}
                </dd>
              </div>
              <div>
                <dt className="sr-only">Sign-in method</dt>
                <dd>{signInMethod(user.identities)}</dd>
              </div>
              {profile?.licence_terms_version && (
                <div>
                  <dt className="sr-only">Licence accepted</dt>
                  <dd>terms {profile.licence_terms_version}</dd>
                </div>
              )}
              {profile?.company && (
                <div>
                  <dt className="sr-only">Company</dt>
                  <dd>{profile.company}</dd>
                </div>
              )}
            </dl>

            {tasks.length > 0 && (
              <ul className="mt-4 flex flex-col gap-1.5">
                {tasks.map((t) => (
                  <li key={t.id} className="text-sm text-ember">
                    Next: {t.title}
                    {t.due_on ? ` (due ${t.due_on})` : ''}
                  </li>
                ))}
              </ul>
            )}

            {notes.length > 0 && (
              <ul className="mt-4 flex flex-col gap-2">
                {notes.map((n) => (
                  <li key={n.id} className="text-sm text-graphite/80">
                    <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.14em] text-graphite/40">
                      {when(n.created_at)}
                    </span>
                    {n.body}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-5 flex flex-wrap gap-6">
              <form action={addPersonNote} className="flex flex-wrap items-start gap-3">
                <input type="hidden" name="userId" value={user.id} />
                <textarea
                  name="body"
                  rows={2}
                  placeholder="Add a note"
                  className="min-h-11 w-full max-w-xs rounded-card border border-graphite/20 bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-indigo"
                />
                <button
                  type="submit"
                  className="min-h-11 rounded-card border border-graphite/25 px-3 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/60 transition-colors hover:border-indigo hover:text-indigo"
                >
                  Save note
                </button>
              </form>

              <form action={addPersonTask} className="flex flex-wrap items-start gap-3">
                <input type="hidden" name="userId" value={user.id} />
                <input
                  name="title"
                  type="text"
                  placeholder="Next action"
                  className="min-h-11 w-full max-w-xs rounded-card border border-graphite/20 bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-indigo"
                />
                <input
                  name="dueOn"
                  type="date"
                  className="min-h-11 rounded-card border border-graphite/20 bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-indigo"
                />
                <button
                  type="submit"
                  className="min-h-11 rounded-card border border-graphite/25 px-3 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/60 transition-colors hover:border-indigo hover:text-indigo"
                >
                  Add task
                </button>
              </form>
            </div>
          </li>
        ))}
      </ol>
    </>
  )
}
