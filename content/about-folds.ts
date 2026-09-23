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
    summary: 'How lyrical started, and the idea it was built around.',
    paragraphs: [
      'lyrical did not begin as a music company. Jordan and Henry were building technology together, and music was not the plan.',
      'What kept pulling them back was a simple observation: a great song only reaches the people who happen to share its language, and that is a limit of distribution, not of the song. Most catalogs treat a finished recording as an archive. It can still grow.',
      'lyrical is the company built around that idea, expanding songs that already work into the languages their audiences actually speak, with the artist in control the whole way.',
    ],
    pull: 'The reach is already there. The words are the only thing missing.',
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
    summary: 'Two doors: a signed release, or the self-serve studio. They are different jobs.',
    paragraphs: [
      'There are two ways to work with us, and it is worth knowing which one you are having before we talk.',
    ],
    points: [
      {
        h: 'Sign with us',
        p: 'For artists, managers and labels releasing a catalog. Selected songs, an authorized release in a new language, delivered ready to put out. Coffey Anderson went through this door first.',
      },
      {
        h: 'The self-serve studio',
        p: 'For musicians working on their own songs, or songs they hold the rights to. Live now, self-served from upload to delivery, and built on proprietary voice models trained in the artist’s own voice.',
      },
    ],
    actions: [{ label: 'Tell us about it', href: '/contact' }],
  },
]
