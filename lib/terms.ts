/**
 * The rights warranty a customer agrees to, prepared by counsel.
 *
 * ## The wording is verbatim and is not ours to edit
 *
 * Points 1 to 4 and the lead-in are the lawyer's text, reproduced word for word. Do not
 * paraphrase, shorten, or "improve" them: the value of a warranty is that it says exactly what
 * counsel intended, and a well-meaning edit is how that protection quietly weakens.
 *
 * ## The legal name is a deliberate exception to the lowercase brand rule
 *
 * The site renders the brand as lowercase `lyrical` everywhere a visitor reads it. This one place
 * names the incorporated entity, **Lyrical Global Technologies, Inc.**, because a representation
 * and warranty has to bind to the actual legal person, the way a signature block does. That is a
 * documented exception, not drift, and it must not be lowercased.
 *
 * ## Versioning is the point of storing it
 *
 * Each version constant is stamped onto the row at the moment of agreement (`rights_terms_version`
 * on a song, `consent_terms_version` on a voice). When counsel changes the wording, bump the
 * version here; old rows keep the version they actually agreed to, so what any given customer
 * accepted stays provable. Bump the version whenever ANY of the text below changes.
 */

/** Bump whenever the rights-warranty text changes. Stored on every song at submit. */
export const RIGHTS_TERMS_VERSION = '2026-08-31'

/** Bump whenever the voice-consent text changes. Stored on every voice model at submit. */
export const VOICE_CONSENT_VERSION = '2026-08-31'

/** The lead-in above the four representations. Counsel's wording. */
export const RIGHTS_TERMS_INTRO =
  'By submitting audio content to Lyrical Global Technologies, Inc. (the "Company"), you represent and warrant that:'

/** The four representations, verbatim from counsel. */
export const RIGHTS_TERMS_POINTS = [
  'You either own all rights in the submitted content, or you have obtained all necessary licenses, consents, and permissions from any co-writers, performers, producers, sample owners, and other rights holders to submit this content to the Company.',
  'The content does not infringe upon or violate any copyright, trademark, right of publicity, or other intellectual property or proprietary right of any third party.',
  'If the content contains samples, interpolations, or contributions from other artists, all necessary clearances and licenses for those elements have been obtained.',
  'You will indemnify and hold the Company harmless from any claims, damages, or liabilities arising from a breach of these representations.',
]

/**
 * The voice-model consent.
 *
 * Handing over an artist's isolated vocal so a model can be built from it is a bigger permission
 * than sending one song, so this keeps the voice-specific permission line as a preface, then the
 * same four representations. The preface is the existing, already-agreed wording; nothing here is
 * newly drafted legal language. If counsel wants voice-specific representations, they replace the
 * points below and the version is bumped.
 */
export const VOICE_CONSENT_PREFACE =
  'I hold the rights to these recordings, and I have the artist’s permission to have a model of their voice built from them and used for the versions I ask for.'
export const VOICE_CONSENT_INTRO = RIGHTS_TERMS_INTRO
export const VOICE_CONSENT_POINTS = RIGHTS_TERMS_POINTS
