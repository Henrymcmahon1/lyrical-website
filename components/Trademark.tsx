/**
 * The trademark symbol, attached to the wordmark.
 *
 * **™, never ®.** ® may only be used for a mark that is actually registered; claiming
 * registration you do not hold is a false representation and an offence under the Australian
 * Trade Marks Act 1995 s151, with equivalents in the US and UK. Lyrical has not run a
 * trademark search yet, let alone filed one. ™ carries no such requirement: it asserts an
 * unregistered claim and anyone may use it.
 *
 * If a registration is ever granted, this is the single place to change.
 *
 * On the LOCKUP, not on every sentence. Convention is to mark the first or most prominent
 * use, and marking every mention reads as inexperience to exactly the audience this site is
 * written for: people who handle intellectual property professionally every day. The nav and
 * the footer put it on every page, which is what "throughout" needs to mean.
 *
 * `aria-hidden` because a screen reader announcing "lyrical trademark" every time the
 * wordmark appears is noise, and the symbol carries no information a listener needs. The
 * legal notice it stands for is text elsewhere, not this glyph.
 */
export function Trademark() {
  return (
    <span
      aria-hidden="true"
      // 0.42em keeps it proportional at every wordmark size rather than fixed at one.
      // `tracking-normal` because the wordmark sets tracking-tight, which would pull the
      // symbol into the final letter.
      className="ml-[0.15em] align-super text-[0.42em] tracking-normal"
    >
      &trade;
    </span>
  )
}
