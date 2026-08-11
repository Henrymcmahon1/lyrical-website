'use client'

import { useMemo, useState } from 'react'
import { LANGUAGES, type LanguageCode } from '@/lib/languages'
import { turnaroundNote } from '@/lib/language-pairs'
import {
  ACCEPT_ATTRIBUTE,
  SUBMISSIONS_BUCKET,
  assetPath,
  describeRejection,
} from '@/lib/song-upload'
import type { AssetInput, AssetKind } from '@/lib/song-job-schema'
import { supabaseBrowser } from '@/lib/supabase-client'
import { submitSongJob } from '@/app/studio/submit-actions'

/**
 * The submission form.
 *
 * Files go from here STRAIGHT TO STORAGE and never touch our server, because Vercel caps a
 * request body at 4.5MB and a WAV is 40 to 70MB. Only the metadata is posted afterwards, and
 * the server re-checks that every path it is handed sits under this user's own folder.
 *
 * There is no byte-level progress bar. supabase-js does not expose upload progress, and a fake
 * bar that jumps to 90% and waits is worse than an honest "uploading 2 of 3", especially when
 * the thing being uploaded is somebody's unreleased master and they are watching closely.
 */

const field =
  'w-full rounded-card border border-graphite/20 bg-cream px-4 py-3 text-graphite outline-none transition-colors focus:border-indigo'
const label = 'flex flex-col gap-2'
const labelText = 'text-sm'

type Feature = { name: string; file: File | null }
type Stage = 'idle' | 'uploading' | 'saving' | 'error'

export function SongSubmitForm() {
  const [title, setTitle] = useState('')
  const [primaryArtist, setPrimaryArtist] = useState('')
  const [sourceLanguage, setSourceLanguage] = useState<LanguageCode>('EN')
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode>('ES')
  const [mode, setMode] = useState<'stems' | 'mix'>('stems')
  const [instrumental, setInstrumental] = useState<File | null>(null)
  const [vocal, setVocal] = useState<File | null>(null)
  const [fullMix, setFullMix] = useState<File | null>(null)
  const [features, setFeatures] = useState<Feature[]>([])
  const [notes, setNotes] = useState('')
  const [warranty, setWarranty] = useState(false)

  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')

  const timing = useMemo(
    () => turnaroundNote(sourceLanguage, targetLanguage),
    [sourceLanguage, targetLanguage],
  )

  const busy = stage === 'uploading' || stage === 'saving'

  function collectFiles(): { kind: AssetKind; file: File; artistName?: string }[] {
    const out: { kind: AssetKind; file: File; artistName?: string }[] = []
    if (mode === 'stems') {
      if (instrumental) out.push({ kind: 'instrumental', file: instrumental })
      if (vocal) out.push({ kind: 'vocal', file: vocal, artistName: primaryArtist })
    } else if (fullMix) {
      out.push({ kind: 'full_mix', file: fullMix })
    }
    for (const f of features) {
      if (f.file) out.push({ kind: 'vocal', file: f.file, artistName: f.name })
    }
    return out
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')

    const files = collectFiles()

    if (sourceLanguage === targetLanguage) {
      setError('Choose two different languages.')
      return
    }
    if (mode === 'stems' && (!instrumental || !vocal)) {
      setError('Send both an instrumental and a vocal, or switch to a full mix.')
      return
    }
    if (mode === 'mix' && !fullMix) {
      setError('Choose the mixed file.')
      return
    }
    for (const { file } of files) {
      const rejection = describeRejection(file)
      if (rejection) {
        setError(rejection)
        return
      }
    }
    if (features.some((f) => f.file && !f.name.trim())) {
      setError('Name the artist on each featured vocal, so we know whose is whose.')
      return
    }
    if (!warranty) {
      setError('Confirm you have the right to authorise this before sending it.')
      return
    }

    const supabase = supabaseBrowser()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) {
      setError('Your session expired. Reload the page and sign in again.')
      return
    }

    const jobId = crypto.randomUUID()
    const uploaded: AssetInput[] = []

    setStage('uploading')
    try {
      let n = 0
      for (const { kind, file, artistName } of files) {
        n += 1
        setProgress(`Uploading ${n} of ${files.length}`)
        const path = assetPath(auth.user.id, jobId, kind, n, file.name)
        const { error: upErr } = await supabase.storage
          .from(SUBMISSIONS_BUCKET)
          .upload(path, file, { upsert: false, contentType: file.type || undefined })

        if (upErr) {
          setStage('error')
          setError(`${file.name} did not upload. Check your connection and try again.`)
          return
        }
        uploaded.push({
          kind,
          artistName: artistName?.trim() || undefined,
          path,
          filename: file.name,
          bytes: file.size,
        })
      }
    } catch {
      setStage('error')
      setError('The upload stopped partway. Check your connection and try again.')
      return
    }

    setStage('saving')
    setProgress('')
    const result = await submitSongJob({
      jobId,
      title,
      primaryArtist,
      sourceLanguage,
      targetLanguage,
      assets: uploaded,
      notes: notes.trim() || undefined,
      rightsWarranty: true,
    })

    // A successful action redirects, so anything returned here is a failure.
    if (result && !result.ok) {
      setStage('error')
      setError(result.error)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-7" noValidate>
      <label className={label}>
        <span className={labelText}>Song title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required className={field} />
      </label>

      <label className={label}>
        <span className={labelText}>Artist</span>
        <input
          value={primaryArtist}
          onChange={(e) => setPrimaryArtist(e.target.value)}
          required
          className={field}
        />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className={label}>
          <span className={labelText}>Recorded in</span>
          <select
            value={sourceLanguage}
            onChange={(e) => setSourceLanguage(e.target.value as LanguageCode)}
            className={field}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.english}
              </option>
            ))}
          </select>
        </label>

        <label className={label}>
          <span className={labelText}>You want it in</span>
          <select
            value={targetLanguage}
            onChange={(e) => setTargetLanguage(e.target.value as LanguageCode)}
            className={field}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.english}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Reads from the pair config, so an unguaranteed pair never shows a number. */}
      <p aria-live="polite" className="-mt-3 text-sm text-graphite/60">
        {timing}
      </p>

      <fieldset className="flex flex-col gap-3">
        <legend className={labelText}>What are you sending?</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['stems', 'Separate instrumental and vocal'],
              ['mix', 'One mixed file'],
            ] as const
          ).map(([value, text]) => (
            <label
              key={value}
              className={`cursor-pointer rounded-card border px-4 py-2 text-sm transition-colors ${
                mode === value
                  ? 'border-indigo text-indigo'
                  : 'border-graphite/20 hover:border-graphite/40'
              }`}
            >
              <input
                type="radio"
                name="mode"
                className="sr-only"
                checked={mode === value}
                onChange={() => setMode(value)}
              />
              {text}
            </label>
          ))}
        </div>
        <p className="text-sm leading-relaxed text-graphite/55">
          Stems give the best result, because the original backing stays untouched. If you do
          not have them, send the mix and we will separate it.
        </p>
      </fieldset>

      {mode === 'stems' ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <label className={label}>
            <span className={labelText}>Instrumental</span>
            <input
              type="file"
              accept={ACCEPT_ATTRIBUTE}
              onChange={(e) => setInstrumental(e.target.files?.[0] ?? null)}
              className={field}
            />
          </label>
          <label className={label}>
            <span className={labelText}>Vocal</span>
            <input
              type="file"
              accept={ACCEPT_ATTRIBUTE}
              onChange={(e) => setVocal(e.target.files?.[0] ?? null)}
              className={field}
            />
          </label>
        </div>
      ) : (
        <label className={label}>
          <span className={labelText}>Mixed file</span>
          <input
            type="file"
            accept={ACCEPT_ATTRIBUTE}
            onChange={(e) => setFullMix(e.target.files?.[0] ?? null)}
            className={field}
          />
        </label>
      )}

      {/*
        Features. The name sits next to the file rather than in a list of its own, because the
        thing the person mixing needs to know is whose voice is in which file.
      */}
      <div className="flex flex-col gap-4">
        <span className={labelText}>Featured artists</span>
        {features.map((f, i) => (
          <div key={i} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className={label}>
              <span className="text-xs text-graphite/55">Name</span>
              <input
                value={f.name}
                onChange={(e) =>
                  setFeatures((prev) =>
                    prev.map((p, j) => (j === i ? { ...p, name: e.target.value } : p)),
                  )
                }
                className={field}
              />
            </label>
            <label className={label}>
              <span className="text-xs text-graphite/55">Their vocal</span>
              <input
                type="file"
                accept={ACCEPT_ATTRIBUTE}
                onChange={(e) =>
                  setFeatures((prev) =>
                    prev.map((p, j) =>
                      j === i ? { ...p, file: e.target.files?.[0] ?? null } : p,
                    ),
                  )
                }
                className={field}
              />
            </label>
            <button
              type="button"
              onClick={() => setFeatures((prev) => prev.filter((_, j) => j !== i))}
              className="nudge inline-flex min-h-11 items-center text-sm text-graphite/60 underline decoration-graphite/25 underline-offset-4 hover:text-graphite"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setFeatures((prev) => [...prev, { name: '', file: null }])}
          className="nudge inline-flex min-h-11 w-fit items-center rounded-card border border-graphite/25 px-4 text-sm transition-colors hover:border-indigo hover:text-indigo"
        >
          Add a featured artist
        </button>
      </div>

      <label className={label}>
        <span className={labelText}>Anything we should know</span>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={field}
        />
      </label>

      {/*
        The warranty. Not decoration: this is the statement that makes an agreement enforceable
        later and keeps us out of an infringing release, which is why it is unticked by default
        and why the submit button will not proceed without it.
      */}
      <label className="flex items-start gap-3 rounded-card border border-graphite/15 p-4">
        <input
          type="checkbox"
          checked={warranty}
          onChange={(e) => setWarranty(e.target.checked)}
          className="mt-1"
        />
        <span className="text-sm leading-relaxed text-graphite/75">
          I own or control this recording, and I have the right to authorise a new language
          version of it.
        </span>
      </label>

      {error && (
        <p role="alert" className="text-sm leading-relaxed text-graphite">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="nudge rounded-card bg-ember px-7 py-4 text-cream disabled:opacity-60"
      >
        {/*
          The last button in the journey says the same thing as the first one. Somebody who
          clicked "Make your song multilingual" in the hero should finish on the same verb,
          rather than being handed a different word for the thing they came to do.
        */}
        {stage === 'uploading'
          ? progress
          : stage === 'saving'
            ? 'Finishing…'
            : 'Make it multilingual'}
      </button>

      <p className="text-sm leading-relaxed text-graphite/55">
        Nothing is made until we accept it, and nothing is released without your approval.
      </p>
    </form>
  )
}
