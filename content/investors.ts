/** The /investors page, rebuilt from the v6 vision. The $8,000 is a placeholder and says so. */
export const INVESTORS = {
  title: 'One technology, two doors.', // (deck)
  frame: 'Not a tool. A rights catalog with an engine.', // (deck)
  placeholder: 'The $8,000 per master per year is a placeholder until one real release reports.', // (deck)
}

export type InvestorSection = { n: string; h: string; p: string[] }

export const SECTIONS: InvestorSection[] = [
  { n: '01', h: 'The atom', p: [
    'One re-sung track costs about $0.50 to make, a margin near 95% at any price above a few dollars.',
    'The anchor the market already accepts: Controlla charges $2,000 per language for a human singer.' ] },
  { n: '02', h: 'The two doors', p: [
    'Door 1, the moat: signed career artists, 30% of net streaming receipts, perpetual and exclusive, $0 upfront, lossless stems, human QA.',
    'Door 2, the toy: fans and hobbyists, self-serve, one flattened MP3, inaudible watermark, personal use only, no human QA. In beta.' ] },
  { n: '03', h: 'Door 2 priced', p: [
    'Single $9 a track, Fan $19 a month for 5 tracks, Superfan $39 a month for 15. Founding prices, grandfathered. Standard prices $12, $29 and $59.',
    'The caps are format, licence and watermark, not quality tiers. Same engine, same default profile. The table below is the one /pricing shows.' ] },
  { n: '04', h: 'Launching in beta, honestly', p: [
    'Buy, rate, re-roll, upsell. Every delivered track gets a one-tap rating. A thumbs-down requires a written note and unlocks a free re-roll, two per track.',
    'The ratings are labelled data: song, language, voice, human verdict. That is the training set for the placement engine.' ] },
  { n: '05', h: 'The cap is the funnel', p: [
    'A fan who wants stems or commercial rights hits a wall and is pointed to Door 1.',
    'The bridge is a Studio Single at roughly $499 to $999: human QA, lossless, commercial, sold by hand, under the $2,000 anchor.' ] },
  { n: '06', h: 'Door 1 modelled', p: [
    'lyrical takes 30% of net receipts on each new-language master.',
    'Illustrative only: 16 masters at $8,000 net royalty a year each is about $38,000 a year to lyrical. The $8,000 per master per year is a placeholder until one real release reports.' ] },
  { n: '07', h: 'The flywheel', p: [
    'Fans make songs. Ratings become data. The engine improves. Better output signs more artists. Their reach brings more fans.' ] },
  { n: '08', h: 'Valuation frame', p: [
    'Music rights trade at roughly 10 to 18 times net royalty. AI application SaaS at roughly 8 to 20 times ARR. Legacy SaaS at 4 to 5 times.',
    'Catalog funds buy rights at 10 to 20 times. lyrical creates rights at $0.50 marginal cost.' ] },
]

export const COMPS: string[][] = [
  ['Controlla', '$2,000 per language, human singer'],
  ['ElevenLabs', 'Free tier is non-commercial'],
  ['HeyGen', 'Free tier carries a watermark'],
  ['DistroKid', 'From about $2 a month'],
]
