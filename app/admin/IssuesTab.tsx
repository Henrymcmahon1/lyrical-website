import { clockNow } from '@/lib/jobs/states'
import { listIssues, type CrmIssueStatus } from '@/lib/crm'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { changeIssueStatus, createIssue } from './issue-actions'

/**
 * Failed jobs not yet acknowledged, refunds, complaints (`crm_issues`), the render worker's
 * heartbeat age, and the Supabase storage figure. The last one is deliberately best-effort: the
 * Storage API has no cheap aggregate-bucket-size call, so this shows a manual number rather than
 * pretending to measure it live. See HANDOVER-v3-2026-09-22.md section 0.
 */

const ISSUE_STATUS_LABEL: Record<CrmIssueStatus, string> = {
  open: 'Open',
  ack: 'Acknowledged',
  resolved: 'Resolved',
}

const KIND_LABEL: Record<string, string> = {
  failed_job: 'Failed job',
  refund: 'Refund',
  complaint: 'Complaint',
  other: 'Other',
}

/**
 * How stale is too stale. The poller upserts every loop; the design spec's watchdog trigger
 * checks it every 5 minutes, so a heartbeat older than three of those cycles is a worker that
 * has actually stopped, not one between two ordinary loops.
 */
const STALE_MINUTES = 15

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function heartbeatAge(seenAtIso: string, nowMs: number): { minutes: number; stale: boolean } {
  const minutes = Math.round((nowMs - new Date(seenAtIso).getTime()) / 60000)
  return { minutes, stale: minutes > STALE_MINUTES }
}

export async function IssuesTab({ status }: { status?: CrmIssueStatus } = {}) {
  const db = supabaseAdmin()

  const [issues, heartbeatResult] = await Promise.all([
    listIssues({ status }, db).catch((e) => ({ error: (e as Error).message }) as const),
    db.from('worker_heartbeat').select('worker, seen_at, version'),
  ])

  const nowMs = clockNow()
  const heartbeats = heartbeatResult.data ?? []

  const base = '/admin?tab=issues'
  const statusHref = (s?: CrmIssueStatus) => `${base}${s ? `&status=${s}` : ''}`

  return (
    <div className="mt-8 flex flex-col gap-12">
      <section>
        <h2 className="font-brand text-xl tracking-tight">Render workers</h2>
        {heartbeats.length === 0 ? (
          <p className="mt-3 text-sm text-graphite/60">No heartbeat recorded yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {heartbeats.map((h) => {
              const age = heartbeatAge(h.seen_at, nowMs)
              return (
                <li key={h.worker} className="flex flex-wrap items-baseline gap-x-3 text-sm">
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/50">
                    {h.worker}
                  </span>
                  <span className={age.stale ? 'text-ember' : 'text-graphite/70'}>
                    {age.stale ? `paused, last seen ${age.minutes} min ago` : `running, ${age.minutes} min ago`}
                  </span>
                  {h.version && <span className="text-graphite/40">{h.version}</span>}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-brand text-xl tracking-tight">Storage</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-graphite/70">
          Best-effort: the Supabase Storage API has no cheap way to total bucket size, so this is
          a manual figure rather than a live measurement. Check the Supabase dashboard, Storage,
          for the current number (1.72 GB of the 1 GB free tier on 22 Sep 2026).
        </p>
      </section>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="font-brand text-xl tracking-tight">Issues</h2>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 font-mono text-[11px] uppercase tracking-[0.16em]">
          <a href={statusHref(undefined)} className={status ? 'text-graphite/45 hover:text-indigo' : 'text-indigo'}>
            All
          </a>
          <a href={statusHref('open')} className={status === 'open' ? 'text-indigo' : 'text-graphite/45 hover:text-indigo'}>
            Open
          </a>
          <a href={statusHref('ack')} className={status === 'ack' ? 'text-indigo' : 'text-graphite/45 hover:text-indigo'}>
            Acknowledged
          </a>
          <a href={statusHref('resolved')} className={status === 'resolved' ? 'text-indigo' : 'text-graphite/45 hover:text-indigo'}>
            Resolved
          </a>
        </div>

        {'error' in issues ? (
          <p className="mt-6 max-w-xl text-graphite/70">
            Issues could not be read.
            <span className="mt-3 block font-mono text-xs text-graphite/50">{issues.error}</span>
          </p>
        ) : issues.length === 0 ? (
          <p className="mt-6 text-graphite/60">Nothing to show.</p>
        ) : (
          <ol className="mt-2">
            {issues.map((i) => (
              <li key={i.id} className="border-b border-graphite/12 py-6">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/50">
                    {KIND_LABEL[i.kind] ?? i.kind}
                  </span>
                  <span
                    className={`font-mono text-[10px] uppercase tracking-[0.16em] ${
                      i.status === 'open' ? 'text-ember' : i.status === 'ack' ? 'text-indigo' : 'text-graphite/45'
                    }`}
                  >
                    {ISSUE_STATUS_LABEL[i.status]}
                  </span>
                  <time className="ml-auto font-mono text-[11px] tabular-nums text-graphite/45">
                    {when(i.created_at)}
                  </time>
                </div>
                {i.detail && (
                  <p className="mt-3 max-w-2xl whitespace-pre-line leading-relaxed text-graphite/80">
                    {i.detail}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] text-graphite/45">
                  {i.job_id && <span>job {i.job_id}</span>}
                  {i.user_id && <span>user {i.user_id}</span>}
                </div>
                <form action={changeIssueStatus} className="mt-4 flex flex-wrap items-center gap-3">
                  <input type="hidden" name="id" value={i.id} />
                  {i.status !== 'ack' && (
                    <button
                      type="submit"
                      name="status"
                      value="ack"
                      className="min-h-11 rounded-card border border-graphite/25 px-3 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/60 transition-colors hover:border-indigo hover:text-indigo"
                    >
                      Acknowledge
                    </button>
                  )}
                  {i.status !== 'resolved' && (
                    <button
                      type="submit"
                      name="status"
                      value="resolved"
                      className="min-h-11 rounded-card bg-indigo px-3 font-mono text-[11px] uppercase tracking-[0.14em] text-cream"
                    >
                      Resolve
                    </button>
                  )}
                  {i.status !== 'open' && (
                    <button
                      type="submit"
                      name="status"
                      value="open"
                      className="min-h-11 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/40 underline underline-offset-4 hover:text-ember"
                    >
                      Reopen
                    </button>
                  )}
                </form>
              </li>
            ))}
          </ol>
        )}

        <form action={createIssue} className="mt-8 flex flex-col gap-3 rounded-card border border-graphite/15 p-4">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/50">
            Log an issue
          </span>
          <div className="flex flex-wrap gap-3">
            <select
              name="kind"
              defaultValue="other"
              className="min-h-11 rounded-card border border-graphite/20 bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-indigo"
            >
              <option value="failed_job">Failed job</option>
              <option value="refund">Refund</option>
              <option value="complaint">Complaint</option>
              <option value="other">Other</option>
            </select>
            <input
              name="jobId"
              type="text"
              placeholder="Job id (optional)"
              className="min-h-11 w-48 rounded-card border border-graphite/20 bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-indigo"
            />
            <input
              name="userId"
              type="text"
              placeholder="User id (optional)"
              className="min-h-11 w-48 rounded-card border border-graphite/20 bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-indigo"
            />
          </div>
          <textarea
            name="detail"
            rows={2}
            placeholder="What happened"
            className="min-h-11 w-full rounded-card border border-graphite/20 bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-indigo"
          />
          <button
            type="submit"
            className="min-h-11 self-start rounded-card border border-graphite/25 px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/60 transition-colors hover:border-indigo hover:text-indigo"
          >
            Log issue
          </button>
        </form>
      </section>
    </div>
  )
}
