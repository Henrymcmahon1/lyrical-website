import { alreadySentForJob, logSend } from '@/lib/email-log'
import { mailCustomer } from '@/lib/mailer'
import { handleSongJobWebhook, type SongJobWebhookPayload } from '@/lib/song-job-hook'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

/**
 * Where a Supabase Database Webhook on `song_jobs` UPDATE posts. Fires the three self-serve job
 * emails (`track-delivered`, `reroll-delivered`, `track-not-made`) on the transition into
 * `delivered` or `rejected`. See `docs/emails/README.md` and `lib/song-job-hook.ts` for the
 * decision logic, which is unit tested on its own against injected deps.
 *
 * ## Always 200
 *
 * Supabase retries a webhook that does not return 2xx, and a hook that legitimately decided not
 * to send (a no-op transition, an already-logged send, an unknown user) is not a failure. Nor is
 * an internal error worth an infinite retry storm: it is caught, logged, and still answered 200.
 * The one thing that is NOT 200 is the shared-secret gate, because a wrong or missing secret on
 * a configured hook usually means the request is not from Supabase at all.
 *
 * ## Configure in Supabase: Database → Webhooks
 * Table `song_jobs`, event UPDATE, URL `<omega>/api/hooks/song-job`,
 * header `x-hook-secret: <SONG_JOB_HOOK_SECRET>`. For the transition matrix to see the PREVIOUS
 * status, the table needs `REPLICA IDENTITY FULL` (Supabase's webhook UI offers this, or
 * `alter table public.song_jobs replica identity full;` in the SQL editor); without it,
 * `old_record` can arrive without a `status` field, which this route still handles safely (see
 * `classifySlug` in `lib/song-job-hook.ts`) but is worth having anyway.
 */

function secretGate(headerValue: string | null): { ok: true } | { ok: false; status: number; body: string } {
  const expected = process.env.SONG_JOB_HOOK_SECRET
  if (!expected) {
    // A missing secret is a real misconfiguration in production, and fails loud rather than
    // quietly accepting unauthenticated requests. Outside production there is often no secret
    // set at all yet, and refusing every local test would be its own kind of broken.
    if (process.env.NODE_ENV === 'production') {
      return { ok: false, status: 503, body: 'SONG_JOB_HOOK_SECRET must be set' }
    }
    return { ok: true }
  }
  if (headerValue !== expected) {
    return { ok: false, status: 401, body: 'bad secret' }
  }
  return { ok: true }
}

export async function POST(request: Request) {
  const gate = secretGate(request.headers.get('x-hook-secret'))
  if (!gate.ok) return new Response(gate.body, { status: gate.status })

  let payload: SongJobWebhookPayload
  try {
    payload = await request.json()
  } catch {
    // A body Supabase itself would never send. Nothing to retry into working, so 200.
    return new Response('ok', { status: 200 })
  }

  const admin = supabaseAdmin()

  try {
    await handleSongJobWebhook(payload, {
      alreadySentForJob: (jobId, slug) => alreadySentForJob(admin, jobId, slug),
      lookupEmail: async (userId) => {
        const { data, error } = await admin.auth.admin.getUserById(userId)
        if (error) {
          console.error('[hooks/song-job] could not look up the user', error)
          return null
        }
        return data.user?.email ?? null
      },
      childCount: async (originalJobId) => {
        const { count, error } = await admin
          .from('song_jobs')
          .select('id', { count: 'exact', head: true })
          .eq('parent_job_id', originalJobId)
        if (error) throw new Error(error.message)
        return count ?? 0
      },
      sendMail: (mail, label) => mailCustomer(mail, label),
      logSend: (row) => logSend(admin, row),
    })
  } catch (e) {
    console.error('[hooks/song-job] failed', e)
  }

  return new Response('ok', { status: 200 })
}
