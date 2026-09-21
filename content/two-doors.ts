/**
 * Creator-facing copy (Door 2) and the Door-1 block. (deck) = verbatim from docs/v2/copy-deck.md.
 *
 * The home hero is not here: `S01Hero` carries its original copy inline, restored 2026-09-22.
 * Two words left every visitor-facing string the same day, on Henry's instruction. "Beta"
 * survives only in the personal-use licence text in lib/terms.ts, which is a legal document
 * and not marketing. "Fan" is gone everywhere: it reads as unauthorised material, and Door 2
 * is for your own songs, or songs you have the rights to.
 */
import type { PlanId } from '@/lib/plans'

export const FOUNDING_LINE = 'Founding prices for early sign-ups, kept for life.' // (deck)
export const REROLL_LINE = 'Every track comes with 2 free re-rolls.' // (deck)
export const ANCHOR_WEDGE = 'We never charge that for automated output.' // (deck, second sentence of the anchor line)
export const MOST_POPULAR = 'Most popular' // (deck)

/** One line per card, under the plan name. Keyed by plan id; the ids never changed. (deck) */
export const GOOD_FOR: Record<PlanId, string> = {
  single: 'Good for trying it once, or a one-off gift.',
  fan: 'Good for a few tracks a month.',
  superfan: 'Good for making tracks every week.',
}

/** The feature list every card carries, after the track count and the re-rolls. (deck) */
export const PLAN_FEATURES = ['One MP3 download per track', 'Personal-use licence', 'Made in the same voice']

export const STEPS = [
  { h: 'Upload your stems', p: 'The instrumental and the lead vocal, or the full mix if that is what you have.' },
  { h: 'Pick a language', p: 'Nine to choose from. The melody, the phrasing and the backing stay exactly as they are.' },
  { h: 'Get your MP3, then rate it', p: 'One 192k MP3, re-sung in the same voice. One tap to rate it. A thumbs-down unlocks a free re-roll.' },
]

/** Kept for `S05Beta`, which is off the home page since 2026-09-22 and stays on disk. */
export const HONEST = {
  h: 'Rough edges, honestly',
  p: [
    'Every track you get back has a thumbs-up and a thumbs-down under it. Thumbs-down asks you to say what is wrong, then gives you a free re-roll, up to two per track.',
    'Nobody checks each track by ear before it reaches you. That is what keeps the price where it is, and it is why your rating matters: every note you write is what the engine learns from next.',
  ],
}

export const DOOR1 = {
  label: 'For artists',
  h: 'Your songs, in every language, in your voice.', // (deck)
  /**
   * The terms sentence. Since Henry's second review on 2026-09-22 it carries no royalty
   * figure: the 30% lives on the gated investor page only. Public copy says what the deal
   * is shaped like, not what it pays.
   */
  p: 'Your songs, released in new languages with us, in your own voice. No upfront cost. You keep control of what is released.', // (deck)
  precedent: 'Our first signed artist is Coffey Anderson.', // (deck)
  cta: 'Read the terms',
  /** The three Door 1 benefits, everywhere they are listed. Never "human in the loop". (deck) */
  benefits: ['Streaming quality', 'Proprietary voice models built for you', 'You can be as involved in the process as you like'],
}

export const CLOSE = { h: 'Pick a song. Pick a language.', p: 'No free tier, no commitment past the track in front of you.', cta: 'See plans' }

/**
 * The two doors on the home page (`S09cDoors`), the closing section since 2026-09-22.
 *
 * Each door says who it is for in one sentence, because Henry watched the two get confused.
 * Door 2 is for MUSICIANS making tracks from their own songs, or songs they have the rights
 * to. Door 1 is for ARTISTS releasing a catalog with us. The enquiry link ("Tell us about it",
 * to /contact) lives in the Door 1 half now that `S10Start` is off the home page. (deck)
 */
export const DOORS = {
  h: 'Two ways in.',
  doors: [
    {
      h: 'For musicians',
      p: 'Make tracks from your own songs, or songs you have the rights to, in any language, in the same voice.',
      points: [] as string[],
      cta: 'Make a track',
      href: '/pricing',
    },
    {
      h: 'For artists',
      p: 'Release your catalog in new languages with us, in your own voice.',
      points: DOOR1.benefits,
      cta: 'Sign with us',
      href: '/artists',
      secondary: { cta: 'Tell us about it', href: '/contact' },
    },
  ],
}

/** What self-serve delivers against what a signed artist gets. Used on /investors only; the comparison left /pricing on 2026-09-22. */
export const CAP_ROWS: { what: string; capped: string; unlocked: string }[] = [
  { what: 'Delivery format', capped: 'One 192k MP3', unlocked: '24-bit WAV stems' },
  { what: 'Watermark', capped: 'Inaudible provenance mark', unlocked: 'None' },
  { what: 'Licence', capped: 'Personal use only', unlocked: 'Commercial release' },
  { what: 'Voice', capped: 'Zero-shot, 50 steps', unlocked: 'Trained voice plus RVC cascade' },
  { what: 'Repair', capped: 'Default polish', unlocked: 'Full repair pass' },
  { what: 'Human QA', capped: 'No', unlocked: 'Yes, every track by ear' },
]

export const FAQ: { q: string; a: string }[] = [
  { q: 'What do I upload?', a: 'Your own songs, or songs you have the rights to, as stems: the instrumental and the lead vocal. If all you have is the full mix, upload that and we separate it.' },
  { q: 'What do I get?', a: 'One 192k MP3 of your song re-sung in the language you picked, in the same voice, over the untouched backing. It carries an inaudible provenance mark.' },
  { q: 'Can I release it?', a: 'No. Self-serve tracks are for personal use only, not for upload to streaming or sales platforms. Artists who want release rights and streaming-quality stems sign through the artist door.' },
  { q: 'What is a re-roll?', a: 'A fresh take of the same song in the same language with a different render seed. Give a thumbs-down with a note that says what was wrong and the re-roll button appears. Two per track, free.' },
  { q: 'Will the price go up?', a: 'Not for you. Early sign-ups keep their founding price for as long as they stay. Your track is made automatically and you rate it, with two free re-rolls, and every rating you leave makes the next track better.' },
]
