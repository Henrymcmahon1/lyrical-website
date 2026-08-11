import { LANGUAGES, type LanguageCode } from './languages'

/**
 * Which language pairs the portal accepts, and which of them carry the turnaround promise.
 *
 * This file exists because of a distinction that only appears once there is a portal.
 *
 * The marketing site claiming eight languages is a positioning stretch, already on the record
 * and already settled. A DROPDOWN claiming eight languages is a different thing entirely: it
 * lets a named rights holder select a pair, upload an unreleased master, and receive a written
 * delivery promise. If the capability is not there, the failure is not an awkward email. It is
 * somebody's property sitting in our storage against a commitment we cannot meet.
 *
 * So the two questions are separated:
 *
 *   OFFERED     what a visitor may submit at all
 *   GUARANTEED  which of those carry the "delivered within N hours" promise
 *
 * Everything offered but not guaranteed still works. It just says we will confirm timing
 * rather than naming a number, which is true and costs nothing.
 */

export const TURNAROUND_HOURS = 48

/**
 * Every language is offered as a source and as a target. Henry's instruction, 2026-08-09.
 * Sourced from `lib/languages.ts` rather than a second list, because a portal and a marketing
 * page disagreeing about what exists is exactly the drift that list was centralised to stop.
 */
export const OFFERED: readonly LanguageCode[] = LANGUAGES.map((l) => l.code)

export type PairKey = `${LanguageCode}>${LanguageCode}`

export const pairKey = (from: LanguageCode, to: LanguageCode): PairKey => `${from}>${to}`

/**
 * ⚠️ HENRY SETS THIS LIST. It is the only thing in the codebase that makes a promise about
 * delivery time to somebody who has already handed over a master.
 *
 * **Changed 2026-08-11, on Henry's explicit instruction after the trade-off was put to him
 * twice.** It was English and Spanish in both directions, matching the internal capability
 * document, on the principle that understating is the safe failure. It is now EVERY offered
 * pair in both directions: 56 of them.
 *
 * What that means in practice, stated plainly because the next person to read this file needs
 * to know what it costs. A rights holder can now select any two of the eight languages, upload
 * an unreleased master, and receive a written promise of delivery within `TURNAROUND_HOURS`.
 * That promise is made in `timingLine()` and lands in their inbox.
 *
 * The brake is that the clock starts at ACCEPTANCE, not at submission. A job sits at
 * `submitted` until a human moves it, and nothing is promised until they do. So the control on
 * an undeliverable pair is the accept button in `/queue`, which is why that button names the
 * pair and the promise it is about to start. Read it before clicking it.
 *
 * Derived rather than written out as 56 literals, so adding a language to `lib/languages.ts`
 * cannot leave this list silently half-updated.
 */
export const GUARANTEED: readonly PairKey[] = OFFERED.flatMap((from) =>
  OFFERED.filter((to) => to !== from).map((to) => pairKey(from, to)),
)

export function isGuaranteed(from: LanguageCode, to: LanguageCode): boolean {
  return GUARANTEED.includes(pairKey(from, to))
}

/** A pair is only submittable if both ends are offered and they differ. */
export function isSubmittable(from: string, to: string): boolean {
  return (
    from !== to &&
    OFFERED.includes(from as LanguageCode) &&
    OFFERED.includes(to as LanguageCode)
  )
}

/**
 * What the visitor is told about timing, before they commit anything.
 *
 * The clock starts at APPROVAL, not at submit, on Henry's instruction: every job is approved
 * by a human before it processes, so a submission at 6pm on a Friday would otherwise start a
 * promise burning while nobody is looking at it. Saying "from the moment we accept it" is the
 * honest version of that and does not require us to promise an approval time we have not set.
 */
export function turnaroundNote(from: LanguageCode, to: LanguageCode): string {
  return isGuaranteed(from, to)
    ? `Delivered within ${TURNAROUND_HOURS} hours of us accepting it.`
    : 'We will confirm timing with you when we accept it.'
}
