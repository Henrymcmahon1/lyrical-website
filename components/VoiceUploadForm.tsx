'use client'

import { useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase-client'
import { addVoiceTakes, submitVoiceModel } from '@/app/studio/voices/actions'
import type { VoiceSampleInput } from '@/lib/voice-schema'
import { RightsWarranty } from '@/components/RightsWarranty'
import { VOICE_CONSENT_INTRO, VOICE_CONSENT_POINTS, VOICE_CONSENT_PREFACE } from '@/lib/terms'
import {
  MAX_UPLOAD_BYTES,
  VOICE_ACCEPT_ATTRIBUTE,
  VOICE_BUCKET,
  describeVoiceRejection,
  formatDuration,
  formatMegabytes,
  readAudioFacts,
  trainingProgress,
  voiceSamplePath,
} from '@/lib/voice-training'
import { button, control, eyebrow } from '@/components/studio/ui'

/**
 * Collecting clean vocals to train an artist's voice model.
 *
 * Files go from here STRAIGHT TO STORAGE and never touch our server, because Vercel caps a
 * request body at 4.5MB. Only the metadata is posted afterwards, and the server re-checks that
 * every path it is handed sits under this user's own folder.
 *
 * ## Everything is checked BEFORE anything uploads
 *
 * A training set is twenty to thirty minutes across eight to twelve files, so an upload run can
 * take minutes. Discovering on file nine that file three was stereo, or 60MB, would mean the
 * whole run was wasted. So each file is read as it is CHOSEN: the header comes out of the first
 * few hundred bytes, which gives the exact duration and channel count without decoding audio,
 * and anything wrong is refused on the spot with a way out.
 *
 * ## Why the running total matters more than it looks
 *
 * "20 to 30 minutes" is meaningless while somebody is staring at a file picker. A total that
 * climbs as they add takes, against a bar that fills at the twenty minute minimum, is the
 * difference between knowing they are finished and guessing.
 */

// The dashboard's Field language (components/studio/ui.tsx). Nothing below changed in what it
// does; only the classes moved to the dark ground.
const field = control

type Picked = {
  file: File
  seconds: number | null
  channels: number | null
}

type Stage = 'idle' | 'reading' | 'uploading' | 'saving' | 'error'

/**
 * `existingVoiceId` switches the form into add-takes mode: no artist field, no fresh consent (both
 * were given when the voice was created), and the uploads land under the existing voice with their
 * index offset past `startIndex` so they cannot collide with takes already there.
 */
export function VoiceUploadForm({
  existingVoiceId,
  existingArtist,
  startIndex = 0,
}: {
  existingVoiceId?: string
  existingArtist?: string
  startIndex?: number
} = {}) {
  const isAdd = Boolean(existingVoiceId)
  const [artistName, setArtistName] = useState(existingArtist ?? '')
  const [notes, setNotes] = useState('')
  const [consent, setConsent] = useState(false)
  const [picked, setPicked] = useState<Picked[]>([])

  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')

  const busy = stage === 'reading' || stage === 'uploading' || stage === 'saving'
  const total = picked.reduce((sum, p) => sum + (p.seconds ?? 0), 0)
  const status = trainingProgress(total)

  /**
   * Read each chosen file's header, then keep or refuse it.
   *
   * `slice(0, 65536)` is the whole trick: a WAV's chunk list and a FLAC's STREAMINFO both live
   * in the first few hundred bytes, so 64KB is generous and costs nothing even when the file
   * is 50MB. Reading the entire file to learn its channel count would stall the browser on
   * every pick.
   */
  async function addFiles(list: FileList | null) {
    if (!list?.length) return
    setError('')
    setStage('reading')

    const next: Picked[] = []
    for (const file of Array.from(list)) {
      let seconds: number | null = null
      let channels: number | null = null

      try {
        const head = await file.slice(0, 65536).arrayBuffer()
        const facts = readAudioFacts(file.name, head)
        if (facts) {
          seconds = facts.seconds
          channels = facts.channels
        }
      } catch {
        // An unreadable header is not a reason to refuse a file we said we accept. It just
        // means this one does not count toward the running total.
      }

      const rejection = describeVoiceRejection(
        file,
        channels === null ? null : { channels, sampleRate: 0, seconds: seconds ?? 0 },
      )
      if (rejection) {
        setError(rejection)
        setStage('idle')
        return
      }

      // Same name twice is nearly always the same take picked twice, and storage is the one
      // resource this feature is short of.
      if (picked.some((p) => p.file.name === file.name && p.file.size === file.size)) continue

      next.push({ file, seconds, channels })
    }

    setPicked((current) => [...current, ...next])
    setStage('idle')
  }

  function remove(index: number) {
    setPicked((current) => current.filter((_, i) => i !== index))
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')

    if (!isAdd && !artistName.trim()) {
      setError('Tell us whose voice this is.')
      return
    }
    if (!picked.length) {
      setError('Add at least one file of clean vocal.')
      return
    }
    if (!isAdd && !consent) {
      setError('Confirm you have the right to have this voice modelled before sending it.')
      return
    }

    const supabase = supabaseBrowser()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) {
      setError('Your session expired. Reload the page and sign in again.')
      return
    }

    const voiceId = existingVoiceId ?? crypto.randomUUID()
    const uploaded: VoiceSampleInput[] = []

    setStage('uploading')
    try {
      let n = 0
      for (const item of picked) {
        n += 1
        setProgress(`Uploading ${n} of ${picked.length}`)

        // Offset past any takes already on this voice, so an added take never collides with one
        // that is already stored. For a new voice `startIndex` is 0 and this is just `n`.
        const path = voiceSamplePath(auth.user.id, voiceId, startIndex + n, item.file.name)
        const { error: upErr } = await supabase.storage
          .from(VOICE_BUCKET)
          .upload(path, item.file, {
            upsert: false,
            contentType: item.file.type || undefined,
          })

        if (upErr) {
          setStage('error')
          /*
           * The free plan is 1GB in total, so "out of space" is a real and reachable outcome
           * here rather than a theoretical one. The message names both plausible causes,
           * because the customer cannot tell them apart and either way the next step is to
           * tell us rather than to keep retrying.
           */
          setError(
            `${item.file.name} did not upload. Either the connection dropped or we are out of storage. Try again, and if it keeps failing tell us rather than retrying.`,
          )
          return
        }

        uploaded.push({
          path,
          filename: item.file.name,
          bytes: item.file.size,
          seconds: item.seconds,
        })
      }

      setStage('saving')
      setProgress('')

      const result = isAdd
        ? await addVoiceTakes({ voiceId, samples: uploaded })
        : await submitVoiceModel({
            voiceId,
            artistName: artistName.trim(),
            notes: notes.trim() || undefined,
            consent: true,
            samples: uploaded,
          })

      // Only returns on failure: the success path redirects, which throws.
      if (result && !result.ok) {
        setStage('error')
        setError(result.error)
      }
    } catch (e) {
      // A redirect from the server action throws by design. Anything else is real.
      if (e && typeof e === 'object' && 'digest' in e) throw e
      setStage('error')
      setError('Something went wrong sending that. Try again in a moment.')
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-8">
      {!isAdd && (
        <label className="flex flex-col gap-1.5">
          <span className={eyebrow}>Whose voice is this?</span>
          <input
            value={artistName}
            onChange={(e) => setArtistName(e.target.value)}
            required
            maxLength={200}
            placeholder="The artist's name"
            className={field}
          />
        </label>
      )}

      {/* ── The files ── */}
      <div className="flex flex-col gap-4">
        <div>
          <span className={eyebrow}>Clean vocal</span>
          <p className="mt-2 font-product text-sm leading-relaxed text-dark-ink/65">
            Isolated vocal only: no instrumental, no reverb tail from another track, no other
            singer. <strong className="font-semibold text-dark-ink">Mono</strong>, and{' '}
            <strong className="font-semibold text-dark-ink">FLAC</strong> if you can, which is
            lossless and roughly half the size of the same WAV. Up to{' '}
            {formatMegabytes(MAX_UPLOAD_BYTES)} per file, so send a few takes rather than one
            long bounce.
          </p>
        </div>

        <label className={`cursor-pointer self-start ${button.ghost}`}>
          <input
            type="file"
            multiple
            accept={VOICE_ACCEPT_ATTRIBUTE}
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              void addFiles(e.target.files)
              // Cleared so choosing the same file again still fires a change event.
              e.target.value = ''
            }}
          />
          {picked.length ? 'Add more takes' : 'Choose files'}
        </label>

        {stage === 'reading' && (
          <p className="font-product text-sm text-dark-ink/60" role="status">
            Reading&hellip;
          </p>
        )}

        {picked.length > 0 && (
          <>
            <ul className="flex flex-col divide-y divide-dark-ink/10 border-y border-dark-ink/10">
              {picked.map((p, i) => (
                <li key={`${p.file.name}-${i}`} className="flex items-center gap-3 py-3">
                  <span className="min-w-0 flex-1 truncate font-product text-sm text-dark-ink">{p.file.name}</span>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-dark-ink/50">
                    {p.seconds ? formatDuration(p.seconds) : 'unknown'}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-dark-ink/40">
                    {formatMegabytes(p.file.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    disabled={busy}
                    aria-label={`Remove ${p.file.name}`}
                    className="nudge inline-flex min-h-11 shrink-0 items-center px-1 font-product text-[11px] uppercase tracking-[0.14em] text-dark-ink/45 transition-colors hover:text-dark-accent"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>

            {/*
              The running total, which is the one number that tells somebody whether they are
              finished. The fill scales on transform (the site never animates width), a plain
              transition rather than anything scroll-driven, in the dashboard's ProgressBar
              language: an ink track, an accent fill while short, ink once there is enough.
            */}
            <div>
              <div
                className="h-2 w-full overflow-hidden rounded-card bg-dark-ink/10"
                role="progressbar"
                aria-valuenow={Math.round(status.fraction * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Training audio collected"
              >
                <div
                  className={`h-full origin-left rounded-card transition-transform duration-500 ${
                    status.enough ? 'bg-dark-ink' : 'bg-dark-accent'
                  }`}
                  style={{ transform: `scaleX(${status.fraction})` }}
                />
              </div>
              <p className="mt-3 font-product text-sm text-dark-ink/70">
                <span className="font-semibold text-dark-ink tabular-nums">
                  {formatDuration(total)}
                </span>{' '}
                collected. {status.message}
              </p>
            </div>
          </>
        )}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={eyebrow}>
          Anything we should know <span className="text-dark-ink/40">(optional)</span>
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Which songs these came from, how they were separated, anything unusual"
          className={field}
        />
      </label>

      {/*
        Its own consent, separate from the per-song rights warranty. It keeps the voice-specific
        permission line as a preface, then the same warranty counsel prepared. The record behind
        the site's promise that voice models are built only from catalogs we have permission to
        use is this agreement plus `consent_warranted_at` and the stamped `consent_terms_version`.
        Skipped in add-takes mode: consent was given when the voice was created, and these are more
        takes of the same already-consented artist.
      */}
      {!isAdd && (
        <RightsWarranty
          preface={VOICE_CONSENT_PREFACE}
          intro={VOICE_CONSENT_INTRO}
          points={VOICE_CONSENT_POINTS}
          checked={consent}
          onChange={setConsent}
        />
      )}

      {error && (
        <p role="alert" className="font-product text-sm leading-relaxed text-dark-accent">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={busy}
          className={`${button.primary} px-6 py-3`}
        >
          {stage === 'uploading'
            ? progress
            : stage === 'saving'
              ? 'Finishing…'
              : isAdd
                ? 'Add these takes'
                : 'Send these vocals'}
        </button>
        {busy && (
          <span className="font-product text-sm text-dark-ink/55" role="status">
            Keep this tab open.
          </span>
        )}
      </div>

      <p className="font-product text-sm leading-relaxed text-dark-ink/55">
        Nothing is trained until we accept it. These recordings are used to build this
        artist&rsquo;s voice and nothing else.
      </p>
    </form>
  )
}
