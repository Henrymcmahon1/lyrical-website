'use server'

import { redirect } from 'next/navigation'
import { renderEmailHtml, renderEmailText, type EmailDoc } from '@/lib/email-shell'
import { mailFounders } from '@/lib/mailer'
import { SITE_URL } from '@/lib/site'
import { currentUser, supabaseServer } from '@/lib/supabase-server'
import { VoiceSubmitSchema, totalSeconds } from '@/lib/voice-schema'
import { formatDuration, voicePathBelongsTo } from '@/lib/voice-training'

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
