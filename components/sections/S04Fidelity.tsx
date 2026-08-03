import { PinnedClaims, type Claim } from '../PinnedClaims'

/**
 * The product section: what actually happens to the record.
 *
 * Three points, not four. The previous version separated "the original melody and feel" from
 * "the backing stays untouched", which a rights holder reads as one reassurance rather than
 * two: my record survives. Merging them frees a slot and makes each remaining point answer a
 * different fear.
 *
 * The three fears, in the order they arrive:
 *   1. Will it sound like my artist, or like a soundalike?
 *   2. Will it damage the record I already have?
 *   3. Will the lyric embarrass us in that market?
 *
 * Framed by what changes rather than by how it is done. The site sells trust, not technology,
 * and describing the machinery invites exactly the questions a rights holder's lawyer asks.
 */
const CLAIMS: Claim[] = [
  {
    h: 'The artist’s own voice',
    p: 'Not a cover, not a soundalike, and not a session singer doing an impression. The new vocal carries the artist’s own timbre and character, so a listener who knows them hears them.',
  },
  {
    h: 'The record stays the record',
    p: 'The melody, the rhythm and the phrasing are the ones the artist performed, and the original instrumental is handed back exactly as it was. Only the vocal changes. Nothing is re-recorded.',
  },
  {
    h: 'A lyric that actually sings',
    p: 'Never literal, never machine-flat. The words are rewritten to land naturally in the new language and to sit on the original melody syllable by syllable, while keeping what the song meant.',
  },
]

export default function S04Fidelity() {
  return (
    <section id="what-we-do" className="pt-24 md:py-0">
      <PinnedClaims claims={CLAIMS} label="What we do" />
    </section>
  )
}
