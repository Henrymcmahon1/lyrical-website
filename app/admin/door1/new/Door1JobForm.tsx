'use client'

import { useState } from 'react'
import { LANGUAGES } from '@/lib/languages'
import {
  DOOR1_ACCEPT_ATTRIBUTE,
  Door1JobSchema,
  NO_PACK_TARGETS,
  defaultRestoreMode,
  describeDoor1FileRejection,
} from '@/lib/door1-schema'
import { SUBMISSIONS_BUCKET } from '@/lib/song-upload'
import { supabaseBrowser } from '@/lib/supabase-client'
import { createDoor1Job, door1UploadTicket } from '../actions'

/**
 * The Door 1 create form. Plain data in (enquiries, past voice names), server actions imported
 * directly (never passed as props).
 *
 * The full mix goes browser to storage on a signed upload URL the server mints, because Vercel
 * caps a request body at 4.5 MB. The form validates with the same zod schema the server uses
 * BEFORE uploading, so a bad form never leaves a file behind.
 */

export type EnquiryOption = { id: string; name: string; label: string; signed: boolean }

const field =
  'w-full rounded-card border border-graphite/25 bg-transparent px-4 py-3 outline-none transition-colors focus-visible:border-indigo'
const labelText = 'text-sm'
const hint = 'text-xs text-graphite/55'

type Stage = 'idle' | 'uploading' | 'saving' | 'error'

export function Door1JobForm({ enquiries, voices }: { enquiries: EnquiryOption[]; voices: string[] }) {
  const [enquiryId, setEnquiryId] = useState('')
  const [primaryArtist, setPrimaryArtist] = useState('')
  const [title, setTitle] = useState('')
  const [sourceLanguage, setSourceLanguage] = useState('EN')
  const [targetLanguage, setTargetLanguage] = useState('ES')
  const [voiceModel, setVoiceModel] = useState('')
  const [restoreMode, setRestoreMode] = useState('')
  const [vocalDenoise, setVocalDenoise] = useState(true)
  const [lyrics, setLyrics] = useState('')
  const [notes, setNotes] = useState('')
  const [dueOn, setDueOn] = useState('')
  const [sourceMode, setSourceMode] = useState<'upload' | 'qobuz'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [sourceUrl, setSourceUrl] = useState('')
  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState('')

  const busy = stage === 'uploading' || stage === 'saving'
  const autoMode = defaultRestoreMode(voiceModel.trim() || undefined)

  function pickEnquiry(id: string) {
    setEnquiryId(id)
    const e = enquiries.find((x) => x.id === id)
    if (e) setPrimaryArtist(e.name)
  }

  function payload(jobId: string, asset?: { path: string; filename: string; bytes: number }) {
    return {
      jobId,
      enquiryId,
      primaryArtist,
      title,
      sourceLanguage,
      targetLanguage,
      voiceModel,
      restoreMode,
      vocalDenoise,
      lyrics,
      notes,
      dueOn,
      sourceUrl: sourceMode === 'qobuz' ? sourceUrl : '',
      asset: sourceMode === 'upload' ? asset : undefined,
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError('')

    if (sourceMode === 'upload') {
      if (!file) return fail('Choose the full mix to upload, or paste a Qobuz link instead.')
      const rejection = describeDoor1FileRejection(file)
      if (rejection) return fail(rejection)
    }

    // Validate the whole form before a byte moves. The placeholder asset stands in for the file.
    const draft = Door1JobSchema.safeParse(
      payload(crypto.randomUUID(), file ? { path: 'pending', filename: file.name, bytes: file.size } : undefined),
    )
    if (!draft.success) return fail(draft.error.issues[0]?.message ?? 'Something in the form is not right.')

    let jobId = crypto.randomUUID()
    let asset: { path: string; filename: string; bytes: number } | undefined

    if (sourceMode === 'upload' && file) {
      setStage('uploading')
      const ticket = await door1UploadTicket({ filename: file.name, bytes: file.size })
      if (!ticket.ok) return fail(ticket.error)
      const { error: upError } = await supabaseBrowser()
        .storage.from(SUBMISSIONS_BUCKET)
        .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type || undefined })
      if (upError) return fail(`${file.name} did not upload: ${upError.message}`)
      jobId = ticket.jobId
      asset = { path: ticket.path, filename: file.name, bytes: file.size }
    }

    setStage('saving')
    const result = await createDoor1Job(payload(jobId, asset))
    if (!result.ok) return fail(result.error)
    window.location.assign(`/admin/door1/${result.jobId}?created=1`)
  }

  function fail(message: string) {
    setStage('error')
    setError(message)
  }

  return (
    <form onSubmit={submit} className="mt-10 flex max-w-2xl flex-col gap-6" noValidate>
      <fieldset className="flex flex-col gap-4">
        <legend className="font-brand text-2xl tracking-tight">Artist</legend>
        <label className="flex flex-col gap-2">
          <span className={labelText}>CRM enquiry</span>
          <select className={field} value={enquiryId} onChange={(e) => pickEnquiry(e.target.value)} name="enquiryId">
            <option value="">No CRM link (type the artist below)</option>
            {enquiries.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
          <span className={hint}>Signed artists are listed first. Picking one fills the artist name.</span>
        </label>
        <label className="flex flex-col gap-2">
          <span className={labelText}>Artist name</span>
          <input
            className={field}
            name="primaryArtist"
            value={primaryArtist}
            onChange={(e) => setPrimaryArtist(e.target.value)}
            required
            maxLength={200}
          />
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="font-brand text-2xl tracking-tight">Song</legend>
        <label className="flex flex-col gap-2">
          <span className={labelText}>Song title</span>
          <input
            className={field}
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
          />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className={labelText}>Sung in</span>
            <select className={field} name="sourceLanguage" value={sourceLanguage} onChange={(e) => setSourceLanguage(e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.english}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className={labelText}>Translate into</span>
            <select className={field} name="targetLanguage" value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.english}
                  {NO_PACK_TARGETS.includes(l.code) ? ' (no language pack yet)' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="font-brand text-2xl tracking-tight">Source</legend>
        <div className="flex flex-wrap gap-6 text-sm">
          <label className="inline-flex min-h-11 items-center gap-2">
            <input type="radio" name="sourceMode" checked={sourceMode === 'upload'} onChange={() => setSourceMode('upload')} />
            Upload the full mix
          </label>
          <label className="inline-flex min-h-11 items-center gap-2">
            <input type="radio" name="sourceMode" checked={sourceMode === 'qobuz'} onChange={() => setSourceMode('qobuz')} />
            Qobuz link
          </label>
        </div>
        {sourceMode === 'upload' ? (
          <label className="flex flex-col gap-2">
            <span className={labelText}>Full mix (MP3, FLAC or WAV, up to 50 MB)</span>
            <input
              className={field}
              type="file"
              name="file"
              accept={DOOR1_ACCEPT_ATTRIBUTE}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <span className={hint}>Over 50 MB? Export it as FLAC, or use a Qobuz link.</span>
          </label>
        ) : (
          <label className="flex flex-col gap-2">
            <span className={labelText}>Qobuz link</span>
            <input
              className={field}
              type="url"
              name="sourceUrl"
              placeholder="https://open.qobuz.com/track/..."
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
            />
          </label>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="font-brand text-2xl tracking-tight">Voice and render</legend>
        <label className="flex flex-col gap-2">
          <span className={labelText}>Voice model</span>
          <input
            className={field}
            name="voiceModel"
            list="door1-voices"
            value={voiceModel}
            onChange={(e) => setVoiceModel(e.target.value)}
            placeholder="e.g. Coffey_Anderson"
            maxLength={100}
          />
          <datalist id="door1-voices">
            {voices.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
          <span className={hint}>
            The render PC voice name, exactly. Leave empty for zero-shot. An unknown name fails the job on the render PC.
          </span>
        </label>
        <label className="flex flex-col gap-2">
          <span className={labelText}>Restore mode</span>
          <select className={field} name="restoreMode" value={restoreMode} onChange={(e) => setRestoreMode(e.target.value)}>
            <option value="">Automatic ({autoMode})</option>
            <option value="cascade">Cascade (needs a voice model)</option>
            <option value="zeroshot">Zero-shot</option>
          </select>
        </label>
        <label className="inline-flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" name="vocalDenoise" checked={vocalDenoise} onChange={(e) => setVocalDenoise(e.target.checked)} />
          Vocal denoise
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="font-brand text-2xl tracking-tight">For the team</legend>
        <label className="flex flex-col gap-2">
          <span className={labelText}>Lyrics (optional, reference only)</span>
          <textarea
            className={`${field} min-h-40 font-mono text-sm`}
            name="lyrics"
            dir="auto"
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
          />
          <span className={hint}>
            Stored with the job for reference. The render does not use them today: the pipeline transcribes the source itself.
          </span>
        </label>
        <label className="flex flex-col gap-2">
          <span className={labelText}>Internal notes</span>
          <textarea className={`${field} min-h-24`} name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} />
        </label>
        <label className="flex flex-col gap-2">
          <span className={labelText}>Due date</span>
          <input className={field} type="date" name="dueOn" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
        </label>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-ember">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="nudge self-start rounded-card bg-indigo px-6 py-3 text-cream disabled:opacity-60"
      >
        {stage === 'uploading' ? 'Uploading the full mix' : stage === 'saving' ? 'Queuing' : 'Create and queue'}
      </button>
    </form>
  )
}
