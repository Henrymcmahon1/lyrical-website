/**
 * The four collapsible sections on /about, as data.
 *
 * These were previously four full-page section components, each with its own width,
 * alignment and heading scale, rendered inside a container narrower than any of them. As
 * content they render through one body component instead, so the folds agree with each
 * other and a change to the reading style happens in one place.
 *
 * They are deliberately short. A fold is opened by somebody with one specific doubt, and it
 * should answer that doubt rather than deliver an essay. The long-form versions are gone
 * on purpose, not mislaid.
 *
 * Copy rules apply here and are enforced by tests/copy.test.ts, which walks this directory:
 * no em-dashes, no banned wording, and no artist names anywhere.
 */

export type AboutFold = {
  /** The short label in the left column when the fold is closed. */
  label: string
  /** One line describing what is inside. Not a repeat of the heading, because there is none. */
  summary: string
  paragraphs?: string[]
  /** A single line given weight. Use sparingly, at most one per fold. */
  pull?: string
  points?: { h?: string; p: string }[]
  /** Numbers the points. For a list that reads as a set rather than a sequence, leave it off. */
  numbered?: boolean
  actions?: { label: string; href: string }[]
}

export const ABOUT_FOLDS: AboutFold[] = [
  {
    label: 'Why it matters',
    summary: 'What a master recording actually is, and why it is the safest place to start.',
    paragraphs: [
      'A master recording is not a finished product. It is the foundation for everything that comes next, and most catalogs treat it as an archive rather than an asset that can still grow.',
      'Music went global. Catalogs did not. The best songs in the world are still largely confined to the language they were written in, and that is one of the last real barriers between a great song and the audience it was always going to find.',
      'Starting from a record that already works is the lowest risk version of expansion there is. The song has proven it connects. What changes is who can understand it.',
    ],
  },
  {
    label: 'Origin',
    summary: 'How lyrical started, and the song that started it.',
    paragraphs: [
      'lyrical did not begin as a music company. Jordan and Henry were building technology together, and music was not the plan.',
      'It started with a reinterpretation. Jordan heard a song he had loved for years performed by somebody else, and it landed completely differently. Same song, same words, a different voice, an entirely different feeling. He wanted that to happen on purpose rather than by chance.',
      'Then came the Super Bowl. Watching a stadium sing along to an artist performing in a language most of the audience did not speak, Henry saw something bigger. The reach was already there. The words were not.',
    ],
    pull: 'Jordan had seen how a different voice could transform a song. Henry saw that the voice did not have to change at all. The language could.',
  },
  {
    label: 'Beliefs',
    summary: 'The rules we hold ourselves to, in writing.',
    paragraphs: [
      'These are the positions the work is built on. They are here so you can hold us to them.',
    ],
    numbered: true,
    points: [
      { p: 'Technology should expand creativity, not compete with it.' },
      { p: 'Language should never limit an artist’s audience.' },
      { p: 'Artists and rights holders stay in control of how their work is used.' },
      { p: 'Software makes possible what traditional production could not.' },
      { p: 'A great creative work should not stop evolving the day it was released.' },
    ],
  },
  {
    label: 'Ways in',
    summary: 'One flagship release, or catalog infrastructure. They are different jobs.',
    paragraphs: [
      'Most conversations start one of two ways, and it is worth knowing which one you are having before we talk.',
    ],
    points: [
      {
        h: 'One flagship release',
        p: 'For artists and managers. Open a song to a new market without re-recording it. Artist approved, delivered ready for release, and yours to mix.',
      },
      {
        h: 'A catalog program',
        p: 'For labels and catalog owners. Selected high performing songs, priority territories, authorized asset creation, and reporting that feeds the next round of decisions.',
      },
    ],
    actions: [{ label: 'Start the conversation', href: '#enquire' }],
  },
]
