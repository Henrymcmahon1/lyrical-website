'use client'

import { useState } from 'react'
import { updateLyrics } from '@/app/studio/lyrics-actions'
import {
  LYRICS_ACCEPT_ATTRIBUTE,
  MAX_LYRICS_CHARS,
  decodeLyricsFile,
  describeLyricsFileRejection,
  lyricStats,
  normaliseLyrics,
} from '@/lib/lyrics'

/**
 * The lyric sheet on a song already submitted, editable until we accept it.
 *
 * Collapsed by default. Somebody opening the studio is checking where their song has got to,
 * not re-reading forty lines they typed yesterday, and a page that opens with every sheet
 * expanded buries the status rail that is the reason they came.
 *
 * The server action is what actually decides whether a save is allowed: three database gates,
 * argued in `app/studio/lyrics-actions.ts`. The `locked` prop here only controls whether the
 * form is offered, and a customer who forges a request past it is refused by the policy.
 */
export function LyricsEditor({
  jobId,
  initial,
  locked,
}: {
  jobId: string
  initial: string
  locked: boolean
}) {
  const [open, setOpen] = useState(false)
  const [lyrics, setLyrics] = useState(initial)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const stats = lyricStats(lyrics)
  const dirty = normaliseLyrics(lyrics) !== normaliseLyrics(initial)

  async function save() {
    setBusy(true)
    setError('')
    setSaved(false)

    const fd = new FormData()
    fd.set('jobId', jobId)
    fd.set('lyrics', lyrics)

    const result = await updateLyrics(fd)
    setBusy(false)

    if (result.ok) setSaved(true)
    else setError(result.error ?? 'That did not save.')
  }

  return (
    <div className="mt-5 border-t border-graphite/12 pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="nudge inline-flex min-h-11 items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite/55 transition-colors hover:text-indigo"
      >
        {initial ? `Lyrics, ${stats.lines} lines` : 'No lyrics yet'}
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>

      {!initial && !open && (
        /*
          The nudge, on the page they come back to. Lyrics are optional at submit, and this is
          where somebody who did not have them to hand is most likely to be able to fix that.
        */
        <p className="mt-1 text-sm leading-relaxed text-graphite/60">
          {locked
            ? 'This song was accepted without a lyric sheet.'
            : 'Adding the words is the single thing that most improves what comes back.'}
        </p>
      )}

      {open && (
        <div className="mt-4 flex flex-col gap-3">
          {locked ? (
            <>
              <pre
                dir="auto"
                className="max-h-80 overflow-auto whitespace-pre-wrap font-mono text-sm leading-relaxed text-graphite/80"
              >
                {initial || 'Nothing was sent with this song.'}
              </pre>
              <p className="text-sm text-graphite/55">
                We have accepted this song, so the sheet is locked to what the work started
                from. Write to us if it needs changing.
              </p>
            </>
          ) : (
            <>
              <textarea
                rows={10}
                dir="auto"
                value={lyrics}
                maxLength={MAX_LYRICS_CHARS}
                onChange={(e) => {
                  setLyrics(e.target.value)
                  setSaved(false)
                }}
                className="w-full rounded-card border border-graphite/20 bg-cream px-4 py-3 font-mono text-sm leading-relaxed text-graphite outline-none transition-colors focus:border-indigo"
              />

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <button
                  type="button"
                  onClick={save}
                  disabled={busy || !dirty}
                  className="nudge inline-flex min-h-11 items-center rounded-card bg-indigo px-5 text-sm text-cream disabled:opacity-50"
                >
                  {busy ? 'Saving…' : 'Save lyrics'}
                </button>

                <label className="nudge inline-flex min-h-11 cursor-pointer items-center rounded-card border border-graphite/25 px-4 text-sm transition-colors hover:border-indigo hover:text-indigo">
                  <input
                    type="file"
                    accept={LYRICS_ACCEPT_ATTRIBUTE}
                    className="sr-only"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ''
                      if (!file) return

                      const rejection = describeLyricsFileRejection(file)
                      if (rejection) {
                        setError(rejection)
                        return
                      }
                      try {
                        // Decoded from bytes, not `file.text()`: see `lib/lyrics.ts` for what
                        // Notepad does to a "Unicode" save.
                        setLyrics(normaliseLyrics(decodeLyricsFile(await file.arrayBuffer())))
                        setSaved(false)
                        setError('')
                      } catch {
                        setError('That file could not be read. Paste the words in instead.')
                      }
                    }}
                  />
                  Upload a .txt
                </label>

                {lyrics.trim() && (
                  <span className="font-mono text-[11px] tabular-nums text-graphite/45">
                    {stats.lines} lines
                  </span>
                )}
              </div>

              {saved && (
                <p role="status" className="text-sm text-indigo">
                  Saved.
                </p>
              )}
              {error && (
                <p role="alert" className="text-sm leading-relaxed text-ember">
                  {error}
                </p>
              )}
              <p className="text-sm leading-relaxed text-graphite/55">
                You can change this until we accept the song. After that it is what the work
                started from.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
