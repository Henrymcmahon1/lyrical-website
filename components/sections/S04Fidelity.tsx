import { PinnedClaims, type Claim } from '../PinnedClaims'

const CLAIMS: Claim[] = [
  {
    h: 'The artist’s real voice',
    p: 'Not a cover and not a soundalike. The new vocal carries the artist’s own timbre and character, so it truly sounds like them.',
  },
  {
    h: 'The original melody and feel',
    p: 'We never rewrite the tune. New lyrics are crafted to sing naturally on the exact original melody, rhythm and phrasing.',
  },
  {
    h: 'The backing stays untouched',
    p: 'Only the vocal changes. The original instrumental, groove and production are delivered exactly as they were.',
  },
  {
    h: 'Natural, singable translations',
    p: 'Never literal or robotic. Rewritten to feel native in the new language while staying true to the meaning and emotion of the original.',
  },
]

export default function S04Fidelity() {
  return (
    <section className="pt-24 md:py-0">
      <PinnedClaims claims={CLAIMS} label="What changes" />
    </section>
  )
}
