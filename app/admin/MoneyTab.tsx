import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * Subscriptions, the credits ledger, and recent Stripe events. Read-only: nothing here writes,
 * because the money paths are already driven by the Stripe webhook and by `submitSelfServeJob`
 * (see `docs/superpowers/specs/2026-09-22-two-doors-v2-design.md` section 5). This tab is for
 * seeing what happened, not for changing it.
 */

type Subscription = {
  id: string
  user_id: string
  tier: string
  status: string
  current_period_start: string | null
  current_period_end: string | null
}

type CreditRow = {
  id: string
  created_at: string
  user_id: string
  delta: number
  reason: string
  job_id: string | null
}

type StripeEvent = {
  id: string
  type: string
  received_at: string
  processed_at: string | null
}

function when(iso: string | null | undefined): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export async function MoneyTab() {
  const db = supabaseAdmin()

  const [subsResult, creditsResult, eventsResult, usersResult] = await Promise.all([
    db
      .from('subscriptions')
      .select('id, user_id, tier, status, current_period_start, current_period_end')
      .order('current_period_start', { ascending: false }),
    db
      .from('song_credits')
      .select('id, created_at, user_id, delta, reason, job_id')
      .order('created_at', { ascending: false })
      .limit(500),
    db
      .from('stripe_events')
      .select('id, type, received_at, processed_at')
      .order('received_at', { ascending: false })
      .limit(100),
    db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ])

  if (subsResult.error || creditsResult.error || eventsResult.error) {
    const message = subsResult.error?.message ?? creditsResult.error?.message ?? eventsResult.error?.message
    return (
      <p className="mt-12 max-w-xl text-graphite/70">
        Money data could not be read.
        <span className="mt-3 block font-mono text-xs text-graphite/50">{message}</span>
      </p>
    )
  }

  const emailById = new Map<string, string>()
  for (const u of usersResult.data?.users ?? []) if (u.email) emailById.set(u.id, u.email)

  const subs = (subsResult.data ?? []) as Subscription[]
  const credits = (creditsResult.data ?? []) as CreditRow[]
  const events = (eventsResult.data ?? []) as StripeEvent[]

  // The running total is the whole point of a ledger: it is the number a founder actually wants,
  // and every row on its own is just an entry toward it.
  const ledgerTotal = credits.reduce((sum, c) => sum + c.delta, 0)
  const refunds = credits.filter((c) => c.reason === 'refund')

  return (
    <div className="mt-8 flex flex-col gap-12">
      <section>
        <h2 className="font-brand text-xl tracking-tight">Subscriptions</h2>
        {subs.length === 0 ? (
          <p className="mt-3 text-sm text-graphite/60">No subscriptions yet.</p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <thead>
              <tr className="font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/45">
                <th className="pb-2 pr-4">Account</th>
                <th className="pb-2 pr-4">Tier</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2">Period</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id} className="border-t border-graphite/10">
                  <td className="py-2 pr-4">{emailById.get(s.user_id) ?? s.user_id}</td>
                  <td className="py-2 pr-4">{s.tier}</td>
                  <td className="py-2 pr-4">{s.status}</td>
                  <td className="py-2 font-mono text-xs text-graphite/55">
                    {when(s.current_period_start)} to {when(s.current_period_end)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-brand text-xl tracking-tight">Credits ledger</h2>
          <span className="font-mono text-sm tabular-nums text-graphite/70" data-testid="ledger-total">
            total {ledgerTotal >= 0 ? `+${ledgerTotal}` : ledgerTotal}
          </span>
        </div>
        {refunds.length > 0 && (
          <p className="mt-2 text-sm text-ember">
            {refunds.length} {refunds.length === 1 ? 'refund' : 'refunds'} issued.
          </p>
        )}
        {credits.length === 0 ? (
          <p className="mt-3 text-sm text-graphite/60">No credit activity yet.</p>
        ) : (
          <ol className="mt-3">
            {credits.map((c) => (
              <li
                key={c.id}
                className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-graphite/10 py-2 text-sm ${
                  c.reason === 'refund' ? 'text-ember' : ''
                }`}
              >
                <span className="font-mono tabular-nums">
                  {c.delta >= 0 ? '+' : ''}
                  {c.delta}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/50">
                  {c.reason}
                </span>
                <span>{emailById.get(c.user_id) ?? c.user_id}</span>
                <time className="ml-auto font-mono text-[11px] tabular-nums text-graphite/45">
                  {when(c.created_at)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <h2 className="font-brand text-xl tracking-tight">Stripe events</h2>
        {events.length === 0 ? (
          <p className="mt-3 text-sm text-graphite/60">No events recorded yet.</p>
        ) : (
          <ol className="mt-3">
            {events.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-graphite/10 py-2 text-sm"
              >
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/50">
                  {e.type}
                </span>
                <span className={e.processed_at ? 'text-graphite/60' : 'text-ember'}>
                  {e.processed_at ? 'processed' : 'received, not processed'}
                </span>
                <time className="ml-auto font-mono text-[11px] tabular-nums text-graphite/45">
                  {when(e.received_at)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
