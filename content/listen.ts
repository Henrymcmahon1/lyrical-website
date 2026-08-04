/**
 * The three recordings on /listen, as data.
 *
 * NO ARTIST NAMES, on purpose and on Henry's instruction. The locked copy rule against naming
 * artists holds here as it does everywhere else, and it does more work on this page than
 * anywhere: a screenshot of a gated comparison page that names nobody says far less than one
 * that names somebody.
 *
 * Order is fixed and matters. The original establishes the voice, the artist's own release
 * shows what an authorised human version of it sounds like, and ours comes last so it is
 * heard against both rather than in isolation.
 *
 * `hasAudio` follows the same convention as `content/demos.json`: drop the file in, flip the
 * flag. It is not inferred from the filesystem on purpose, because `public/` is served from
 * the CDN and is not reliably readable from a serverless function, so an existence check
 * would report "missing" for a file that is in fact live. An explicit flag cannot be wrong
 * in a way nobody notices.
 */

export type Track = {
  id: string
  label: string
  /** One line on what this recording is and why it is here. */
  note: string
  /** Path under `public/`. */
  file: string
  /** Flip to true once the file is actually in the repo. */
  hasAudio: boolean
  /** Marks the row as Lyrical's own work, which is styled to stand apart. */
  ours?: boolean
}

export const LISTEN_TITLE = 'One song, three recordings'

export const LISTEN_INTRO =
  'The same song in three versions. The original, the artist’s own authorised Spanish release, and ours. Same order every time, so the only thing that changes between them is what you are listening for.'

export const TRACKS: Track[] = [
  {
    id: 'original',
    label: 'The original',
    note: 'The record as released, in English.',
    file: '/audio/listen/original.mp3',
    hasAudio: true,
  },
  {
    id: 'artist-spanish',
    label: 'The artist’s own Spanish release',
    note: 'A separately recorded, authorised Spanish version by the same artist. A professional benchmark, not a reference we produced.',
    file: '/audio/listen/artist-spanish.mp3',
    hasAudio: true,
  },
  {
    id: 'lyrical',
    label: 'Ours',
    note: 'The English master, re-sung in Spanish. Same melody, same phrasing, the original backing untouched.',
    file: '/audio/listen/lyrical-spanish.mp3',
    hasAudio: false,
    ours: true,
  },
]
