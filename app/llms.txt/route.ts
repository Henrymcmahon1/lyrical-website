import { CONTACT_EMAIL } from '@/lib/enquiry-email'
import { SITE_URL } from '@/lib/site'

/**
 * `/llms.txt`, the emerging convention for handing a language model a clean, factual summary
 * of a site instead of making it infer one from marketing copy.
 *
 * Be honest about what this is worth. It is a proposal, not a standard, and no major model
 * provider has committed to reading it. It is here because it costs one small route and
 * because the failure mode it addresses is real for this site specifically: the visible copy
 * is deliberately atmospheric, so a model that lands on the home page has to work out what
 * the company sells from a tagline and three pinned sections. This states it plainly.
 *
 * What it must NOT become is a second copy of the marketing site that drifts from the first.
 * Every claim here already appears on a public page, in the same words wherever possible.
 *
 * `/hear` and `/listen` are deliberately absent. `/hear` has nothing on it yet, and `/listen`
 * is password gated and disallowed in robots.txt.
 */
export const dynamic = 'force-static'

export function GET() {
  const body = `# lyrical

> lyrical recreates a finished record in another language so it sounds like the artist
> genuinely recorded it that way. The melody, the rhythm and the feel are kept intact, sung
> in the artist's own voice, over the untouched original backing.

lyrical, also written lyrical Global, is a music company at ${SITE_URL}. It is not a cover
version and not a re-recording by a different performer. The same record is re-sung in
another language for the rights holder who owns it, over the original instrumental.

An artist's voice is used only with the artist's or rights holder's permission. Every version
is authorized before it is made, and reviewed by ear before it is delivered. Voice models are
built only from catalogs the company has permission to use. The rights holder provides the
finished master and the approval; lyrical provides the recreation and the stems.

Who it is for: artists, managers, labels, publishers and distributors who own or control a
catalog and want it to work in more than one language.

How to start: make one song multilingual through the studio at ${SITE_URL}/studio. The rights
holder uploads a finished recording and chooses a target language. There is no upfront cost, a
human accepts the job before anything is made, and delivery is within 48 hours of that
acceptance. Nothing is released without the rights holder's approval.

## Pages

- [Home](${SITE_URL}): what the company does and how a release works.
- [About](${SITE_URL}/about): the thesis, the rights position, and the two founders.
- [Contact](${SITE_URL}/contact): the enquiry form, for a catalog rather than a single song.

## Contact

- ${CONTACT_EMAIL}
`

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=86400',
    },
  })
}
