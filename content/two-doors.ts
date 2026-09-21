/** Fan-facing copy (Door 2) and the Door-1 block. (deck) = verbatim from docs/v2/copy-deck.md. */
export const HERO = {
  headline: 'Sing your favorite song in any language.', // (deck)
  sub: 'Upload your song, pick a language, and hear it re-sung in the same voice. Founding beta: rough edges, honest prices, two free re-rolls on every track.', // (deck)
  primary: 'See plans', // (deck)
  secondary: 'For artists', // (deck)
}
export const BETA_LINE = 'Beta output. Personal use only.' // (deck)
export const FOUNDING_LINE = 'Founding beta prices. Sign up now and keep them for life.' // (deck)
export const REROLL_LINE = 'Every track comes with 2 free re-rolls.' // (deck)
export const ANCHOR_WEDGE = 'We never charge that for automated output.' // (deck, second sentence of the anchor line)
export const MOST_FANS = 'Most fans' // (deck)

export const STEPS = [
  { h: 'Upload your stems', p: 'The instrumental and the lead vocal, or the full mix if that is what you have.' },
  { h: 'Pick a language', p: 'Nine to choose from. The melody, the phrasing and the backing stay exactly as they are.' },
  { h: 'Get your MP3, then rate it', p: 'One 192k MP3, re-sung in the same voice. One tap to rate it. A thumbs-down unlocks a free re-roll.' },
]

export const BETA = {
  h: 'Beta, honestly',
  p: [
    'Every track you get back has a thumbs-up and a thumbs-down under it. Thumbs-down asks you to say what is wrong, then gives you a free re-roll, up to two per track.',
    'Nobody checks each track by ear before it reaches you. That is what keeps the price where it is, and it is why your rating matters: every note you write is what the engine learns from next.',
  ],
}

export const DOOR1 = {
  label: 'For artists',
  h: 'Your songs, in every language, in your voice.', // (deck)
  p: '30% of net streaming receipts on the new-language masters, perpetual and exclusive, $0 upfront. You get lossless stems and a human in the loop.', // (deck)
  precedent: 'Our first signed artist is Coffey Anderson.', // (deck)
  cta: 'Read the terms',
}

export const CLOSE = { h: 'Pick a song. Pick a language.', p: 'Founding beta, no free tier, no commitment past the track in front of you.', cta: 'See plans' }

/** What self-serve delivers against what a signed artist gets. */
export const CAP_ROWS: { what: string; capped: string; unlocked: string }[] = [
  { what: 'Delivery format', capped: 'One 192k MP3', unlocked: '24-bit WAV stems' },
  { what: 'Watermark', capped: 'Inaudible provenance mark', unlocked: 'None' },
  { what: 'Licence', capped: 'Personal use only', unlocked: 'Commercial release' },
  { what: 'Voice', capped: 'Zero-shot, 50 steps', unlocked: 'Trained voice plus RVC cascade' },
  { what: 'Repair', capped: 'Default polish', unlocked: 'Full repair pass' },
  { what: 'Human QA', capped: 'No', unlocked: 'Yes, every track by ear' },
]

export const FAQ: { q: string; a: string }[] = [
  { q: 'What do I upload?', a: 'Your song as stems: the instrumental and the lead vocal. If all you have is the full mix, upload that and we separate it.' },
  { q: 'What do I get?', a: 'One 192k MP3 of your song re-sung in the language you picked, in the same voice, over the untouched backing. It carries an inaudible provenance mark.' },
  { q: 'Can I release it?', a: 'No. Self-serve tracks are for personal use only, not for upload to streaming or sales platforms. Artists who want release rights, lossless stems and a human ear sign through the artist door.' },
  { q: 'What is a re-roll?', a: 'A fresh take of the same song in the same language with a different render seed. Give a thumbs-down with a note that says what was wrong and the re-roll button appears. Two per track, free.' },
  { q: 'What does beta mean?', a: 'Rough edges. No human listens to each track before you do. Founding prices stay yours for life, and every rating you leave makes the next track better.' },
]
