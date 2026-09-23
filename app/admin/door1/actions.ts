'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-session'
import {
  Door1JobSchema,
  describeDoor1FileRejection,
  door1AssetRow,
  door1JobRow,
} from '@/lib/door1-schema'
import { SUBMISSIONS_BUCKET, assetPath, pathBelongsTo } from '@/lib/song-upload'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * Door 1 writes. Both actions are POST endpoints reachable without the page, so each one calls
 * `requireAdmin()` first (a refused caller is redirected before anything is read or written).
 *
 * Both also refuse a BREAK-GLASS session: a Door 1 job is owned by the signed-in admin's auth
 * uid (`user_id`), and the source upload sits under that uid's folder. Break-glass has no
 * identity, so it may read the console but never create a job.
 */

const BREAK_GLASS_REFUSAL =
  'Creating a Door 1 job needs you signed in as yourself (info@), not the break-glass password. Sign in at /admin/sign-in.'

async function adminIdentity(): Promise<{ id: string } | { error: string }> {
  const admin = await requireAdmin()
  if (!admin.ok) redirect('/admin')
  if (admin.via !== 'identity') return { error: BREAK_GLASS_REFUSAL }
  return { id: admin.user.id }
}

export type Door1UploadTicket =
  | { ok: true; jobId: string; path: string; token: string }
  | { ok: false; error: string }

/**
 * A signed upload URL for the full mix, so the file goes browser to storage directly (Vercel
 * caps a request body at 4.5 MB). The server picks the job id and the path, so the path is
 * always `{admin uid}/{job id}/full_mix-1.{ext}`, Door 2's layout.
 */
export async function door1UploadTicket(raw: { filename?: unknown; bytes?: unknown }): Promise<Door1UploadTicket> {
  const who = await adminIdentity()
  if ('error' in who) return { ok: false, error: who.error }

  const filename = typeof raw?.filename === 'string' ? raw.filename : ''
  const bytes = typeof raw?.bytes === 'number' ? raw.bytes : 0
  const rejection = describeDoor1FileRejection({ name: filename, size: bytes })
  if (rejection) return { ok: false, error: rejection }

  const jobId = crypto.randomUUID()
  const path = assetPath(who.id, jobId, 'full_mix', 1, filename)
  const { data, error } = await supabaseAdmin().storage.from(SUBMISSIONS_BUCKET).createSignedUploadUrl(path)
  if (error || !data?.token) {
    console.error('[door1] could not mint an upload URL', error)
    return { ok: false, error: 'Storage would not accept an upload right now. Try again in a moment.' }
  }
  return { ok: true, jobId, path, token: data.token }
}

export type CreateDoor1Result = { ok: true; jobId: string } | { ok: false; error: string }

/**
 * Create one Door 1 job, exactly per the README contract (`door1JobRow`). The poller picks it
 * up on `pipeline_state='queued'`. No credit, no plan quota, no email, ever.
 */
export async function createDoor1Job(raw: unknown): Promise<CreateDoor1Result> {
  const who = await adminIdentity()
  if ('error' in who) return { ok: false, error: who.error }

  const parsed = Door1JobSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Something in the form is not right.' }
  }
  const input = parsed.data

  // The path is re-checked, never trusted: a forged one would attach somebody else's upload.
  if (input.asset && !pathBelongsTo(input.asset.path, who.id, input.jobId)) {
    return { ok: false, error: 'That upload could not be verified. Reload and try again.' }
  }

  const db = supabaseAdmin()
  const removeUpload = async () => {
    if (!input.asset) return
    const { error } = await db.storage.from(SUBMISSIONS_BUCKET).remove([input.asset.path])
    if (error) console.error('[door1] could not remove an orphaned upload', input.asset.path, error)
  }

  const { error: jobError } = await db
    .from('song_jobs')
    .insert(door1JobRow(input, { userId: who.id, nowIso: new Date().toISOString() }))
  if (jobError) {
    console.error('[door1] job insert failed', jobError)
    await removeUpload()
    return { ok: false, error: `The job could not be saved: ${jobError.message}` }
  }

  const assetRow = door1AssetRow(input, who.id)
  if (assetRow) {
    const { error: assetError } = await db.from('song_job_assets').insert(assetRow)
    if (assetError) {
      console.error('[door1] asset insert failed, rolling the job back', assetError)
      await db.from('song_jobs').delete().eq('id', input.jobId)
      await removeUpload()
      return { ok: false, error: `The source file could not be recorded: ${assetError.message}` }
    }
  }

  revalidatePath('/admin/door1')
  return { ok: true, jobId: input.jobId }
}
