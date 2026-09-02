'use server'

import { redirect } from 'next/navigation'
import { renderEmailHtml, renderEmailText, type EmailDoc } from '@/lib/email-shell'
import { mailFounders } from '@/lib/mailer'
import { SITE_URL } from '@/lib/site'
import { currentUser, supabaseServer } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { VoiceSubmitSchema, VoiceTakesSchema, totalSeconds } from '@/lib/voice-schema'
import { VOICE_BUCKET, formatDuration, voicePathBelongsTo } from '@/lib/voice-training'
import { VOICE_CONSENT_VERSION } from '@/lib/terms'

/**
 * Record a set of training vocals whose files are already in storage.
 *
 * The shape mirrors `app/studio/submit-actions.ts` exactly, and for the same reason: uploads go
 * BROWSER DIRECT TO STORAGE because Vercel caps a request body at 4.5MB. So by the time this
 * runs the objects exist and this call is only writing the metadata that makes sense of them.
 *
 * That inverts the trust model, so two checks follow from it:
 *
 *   1. Every path must sit under `{this user}/{this voice}/`. Without it, a caller could attach
 *      somebody else's object to their own voice model and read it back through their own row.
 *      The storage policy already stops them WRITING there; this stops them CLAIMING it.
 *   2. Both rows are inserted with the user's own client, not the admin one, so the RLS checks
 *      have to pass as well. Two independent gates, deliberately.
 */
export type VoiceResult = { ok: false; error: string }

export async function submitVoiceModel(raw: unknown): Promise<VoiceResult | void> {
  const user = await currentUser()
  if (!user) return { ok: false, error: 'Your session expired. Sign in and try again.' }

  const parsed = VoiceSubmitSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Something in the form is not right.',
    }
  }
  const voice = parsed.data

  for (const sample of voice.samples) {
    if (!voicePathBelongsTo(sample.path, user.id, voice.voiceId)) {
      // Not a user error. Either the page is broken or somebody is probing, and neither
      // deserves a message that helps them work out which check failed.
      return { ok: false, error: 'That upload could not be verified. Reload and try again.' }
    }
  }

  const supabase = await supabaseServer()

  const { error: voiceError } = await supabase.from('voice_models').insert({
    id: voice.voiceId,
    user_id: user.id,
    artist_name: voice.artistName,
    notes: voice.notes ?? null,
    // Stamped server-side, so the record of which consent wording was agreed to is ours.
    consent_terms_version: VOICE_CONSENT_VERSION,
    status: 'collecting',
  })

  if (voiceError) {
    return { ok: false, error: 'We could not save that. Try again in a moment.' }
  }

  const { error: sampleError } = await supabase.from('voice_samples').insert(
    voice.samples.map((s) => ({
      voice_id: voice.voiceId,
      user_id: user.id,
      path: s.path,
      filename: s.filename,
      bytes: s.bytes,
      seconds: s.seconds,
    })),
  )

  if (sampleError) {
    // A voice model with no samples attached looks to staff like an empty submission. Better to
    // remove it and have them try again than to leave a row nobody can action.
    await supabase.from('voice_models').delete().eq('id', voice.voiceId)
    return { ok: false, error: 'We could not save the files. Try again in a moment.' }
  }

  /*
   * Founders only. The customer is looking at the page that just told them it worked, and a
   * second "we got it" email for something they are currently watching succeed is noise.
   *
   * Awaited rather than fired and forgotten: a serverless function that returns before its
   * promises settle is killed mid-send and the email silently never goes.
   */
  const minutes = formatDuration(totalSeconds(voice.samples))

  /*
   * Through `email-shell.ts` like every other message, which also means the artist name and the
   * free-text note are escaped once, at render, rather than being remembered here. An artist
   * name is attacker-influenced text and this lands in our own inbox.
   */
  const doc: EmailDoc = {
    preheader: `${voice.artistName}, ${minutes} of clean vocal. Waiting on one of you.`,
    eyebrow: 'New voice model',
    heading: voice.artistName,
    blocks: [
      {
        type: 'rows',
        rows: [
          ['From', user.email ?? 'unknown'],
          ['Audio', `${minutes} across ${voice.samples.length} files`],
        ],
      },
      ...(voice.notes ? [{ type: 'paragraph' as const, text: voice.notes }] : []),
      { type: 'cta', label: 'Open the queue', href: `${SITE_URL}/queue?tab=voices` },
      {
        type: 'note',
        text:
          'Nothing trains until one of you approves it. The files are neither attached nor ' +
          'linked here: open the voice in the queue.',
      },
    ],
  }

  await mailFounders(
    {
      replyTo: user.email ?? undefined,
      subject: `New voice model: ${voice.artistName} (${minutes})`,
      text: renderEmailText(doc),
      html: renderEmailHtml(doc),
    },
    'voice-model',
  )

  redirect('/studio/voices?added=1')
}

const UUID = /^[0-9a-f-]{36}$/i

/**
 * Add more clean takes to a voice that is still being collected.
 *
 * The files are already in storage under `{user}/{voiceId}/` by the time this runs. Two gates,
 * the same pair as every other write here: every path must sit under this user and this voice,
 * and the voice must belong to the caller. A third gate is specific to this action: the voice has
 * to still be `collecting`, because once we have approved it and started training, more takes
 * would change the set the work was started from.
 */
export async function addVoiceTakes(raw: unknown): Promise<VoiceResult | void> {
  const user = await currentUser()
  if (!user) return { ok: false, error: 'Your session expired. Sign in and try again.' }

  const parsed = VoiceTakesSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Something is not right.' }
  }
  const { voiceId, samples } = parsed.data

  for (const sample of samples) {
    if (!voicePathBelongsTo(sample.path, user.id, voiceId)) {
      return { ok: false, error: 'That upload could not be verified. Reload and try again.' }
    }
  }

  const supabase = await supabaseServer()

  // Owned by this user (RLS returns only theirs) and still open to more takes.
  const { data: voice } = await supabase
    .from('voice_models')
    .select('id, status')
    .eq('id', voiceId)
    .maybeSingle()
  if (!voice) return { ok: false, error: 'That voice could not be found.' }
  if (voice.status !== 'collecting') {
    return { ok: false, error: 'This voice is already being worked on, so takes cannot be added.' }
  }

  const { error } = await supabase.from('voice_samples').insert(
    samples.map((s) => ({
      voice_id: voiceId,
      user_id: user.id,
      path: s.path,
      filename: s.filename,
      bytes: s.bytes,
      seconds: s.seconds,
    })),
  )
  if (error) return { ok: false, error: 'We could not save the files. Try again in a moment.' }

  redirect('/studio/voices?added=1')
}

/**
 * Rename a voice, or edit its note.
 *
 * A staff-shaped action: the schema has no customer UPDATE policy on `voice_models` on purpose,
 * so this runs with the service role and enforces ownership itself. Same shape `/queue` uses. A
 * `<form action>` post, so it works with JavaScript off.
 */
export async function renameVoice(formData: FormData): Promise<void> {
  const user = await currentUser()
  if (!user) redirect('/studio/sign-in?next=/studio/voices')

  const id = String(formData.get('id') ?? '')
  const artistName = String(formData.get('artist_name') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim()
  if (!UUID.test(id) || !artistName) redirect('/studio/voices')

  const db = supabaseAdmin()
  const { data: voice } = await db
    .from('voice_models')
    .select('id, user_id')
    .eq('id', id)
    .maybeSingle()
  if (!voice || voice.user_id !== user.id) redirect('/studio/voices')

  await db
    .from('voice_models')
    .update({ artist_name: artistName.slice(0, 200), notes: notes ? notes.slice(0, 2000) : null })
    .eq('id', id)

  redirect('/studio/voices')
}

/**
 * Retire a voice: purge its training audio and keep the record.
 *
 * Deliberately NOT a hard delete. The `voice_models` row and its `consent_warranted_at` stay,
 * because that timestamp is the record that backs "we had the artist's permission", and losing it
 * to free a few megabytes is the wrong trade. What goes is the training audio: every object under
 * `{user}/{voiceId}/` in the bucket, then the `voice_samples` rows, then the status moves to
 * `retired`. Service role, because a customer has no storage-delete policy and no voice update
 * policy, and ownership is checked here instead.
 */
export async function retireVoice(formData: FormData): Promise<void> {
  const user = await currentUser()
  if (!user) redirect('/studio/sign-in?next=/studio/voices')

  const id = String(formData.get('id') ?? '')
  if (!UUID.test(id)) redirect('/studio/voices')

  const db = supabaseAdmin()
  const { data: voice } = await db
    .from('voice_models')
    .select('id, user_id')
    .eq('id', id)
    .maybeSingle()
  if (!voice || voice.user_id !== user.id) redirect('/studio/voices')

  // Remove the objects by their recorded paths rather than by listing the folder: the paths are
  // exactly what we wrote, so there is nothing to page through and nothing to miss.
  const { data: samples } = await db.from('voice_samples').select('path').eq('voice_id', id)
  const paths = (samples ?? []).map((s) => s.path).filter(Boolean)
  if (paths.length) await db.storage.from(VOICE_BUCKET).remove(paths)

  await db.from('voice_samples').delete().eq('voice_id', id)
  await db.from('voice_models').update({ status: 'retired' }).eq('id', id)

  redirect('/studio/voices')
}
