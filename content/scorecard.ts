/**
 * What lyrical measures on every delivery, as data.
 *
 * Words live here, never in the component, the same arrangement `content/about-folds.ts` uses.
 * A criterion is a commitment about how the work is judged, and it should be editable without
 * anyone opening a file full of markup.
 *
 * ## The argument this section exists to make
 *
 * A score in isolation is meaningless. Speech recognition fails on a fast reggaeton track even
 * when it is fed the real, original, human recording, so an intelligibility number for our
 * version is only worth reading next to the number the original scores on the same test. Every
 * criterion below is therefore expressed as a comparison against the artist's own recording,
 * which is the ceiling and the reference at once.
 *
 * ⚠️ NO NUMBERS, AND NO CLAIM OF A RESULT. The scorecard is in build and produces nothing yet.
 * Henry's instruction, 2026-08-11: describe the method, claim nothing. Benchmark data is coming
 * separately and has not arrived. Do not state or imply that we reach the original's standard,
 * on this page or anywhere else, until it does. That is the same trap as the intelligibility
 * claim that had to be pulled once already.
 */

export type Criterion = {
  /** What is being judged. */
  name: string
  /** How it is measured, in plain words, and always relative to the original. */
  how: string
}

export const SCORECARD_CRITERIA: Criterion[] = [
  {
    name: 'Intelligibility',
    how: 'Can the words be made out? Speech recognition is run against the lyric sheet, and our version is read against the score the original recording gets on the same test.',
  },
  {
    name: 'Translation quality',
    how: 'Does it mean the same thing and still sing? Meaning, rhyme density and singability are scored, and a native speaker reads it against a rubric rather than a vibe.',
  },
  {
    name: 'Artist timbre',
    how: 'Does it sound like them? Voice similarity is measured against the artist’s real stem, with their own verse-to-verse variation setting the ceiling, because no two takes are identical either.',
  },
  {
    name: 'Melody fidelity',
    how: 'Is it the same tune? The pitch curve of the new vocal is compared against the original performance, note for note.',
  },
  {
    name: 'Naturalness',
    how: 'Does it sound like singing rather than assembly? A predictor scores it, and what is reported is the gap to the original rather than a number on its own.',
  },
  {
    name: 'Mix seat',
    how: 'Does the vocal sit where it did? Level, tone and stereo width are checked against the place the original vocal occupied in the record.',
  },
  {
    name: 'Completeness',
    how: 'Is all of it there? Material covered, words dropped and lines that ran over their space, counted rather than estimated.',
  },
]
