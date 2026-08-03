# Friction and clarity — design

**Date:** 2026-08-03 · **Approved by:** Henry · Option A on the form.

Four changes, one deploy. All of them apply at every breakpoint; none of them is
mobile-only or desktop-only.

---

## 1. The enquiry form asks for too much

**Today.** Six fields on the full form. Three carry the `required` attribute: name, email
and role. Role also carries `defaultValue="artist"`, so it is pre-answered for everybody
and the answer is a guess. A required field with a default is not a required field, it is a
silent assumption that lands in the database looking like a fact.

**Change.** Name and email are the only required fields. Everything else moves inside a
native `<details>` labelled as optional, closed by default, so the form a visitor first sees
is two inputs and a button.

`<details>` rather than a JavaScript disclosure for the reason the rest of this site uses
native elements: the form must submit with JavaScript disabled, and inputs inside a closed
`<details>` are still submitted. Nothing is lost by collapsing them.

Role and catalogue size gain an empty first option. The schema maps an empty string back to
a safe value rather than rejecting it, because the database column is not nullable and a
visitor skipping a question is not a validation error.

**Trade-off, accepted.** Fewer enquiries will carry role and catalogue size. The reply can
ask. A lead that arrives unqualified is worth more than one that never arrives.

**The examples gate is unchanged.** It already asks for an email and nothing else.

## 2. Nothing tells a reader the pinned sections advance by scrolling down

**Today.** Three sections pin: `S04Fidelity`, `S05How`, `S06Receive`. All three render
through `PinnedStepper`. While pinned, the panel holds still and the steps change. A tester
on a phone read the changing cards as a carousel and swiped sideways, which does nothing.

**Change.** A small downward chevron at the foot of the pinned panel. It drifts vertically,
and fades out permanently once that section advances past its first step, so it teaches the
gesture and then stops competing with the content.

Built into `PinnedStepper`, so all three sections get it from one place.

**Constraints it respects.** Transform and opacity only. Scoped to `.js-motion`. Tied to the
existing `pinned` state, which is already false under `prefers-reduced-motion`, so the cue
never renders when the section is not pinning. `aria-hidden`, because it describes a
scroll direction that assistive technology conveys already.

## 3. The About folds were built as full pages

**Today.** Four `<details>` folds wrap four section components that were each written to be
a standalone full-width section:

| Fold | Component | Width | Alignment | Heading |
|---|---|---|---|---|
| Why it matters | `S06bMaster` | `max-w-4xl` | centred | `3xl / 4xl` |
| Origin | `Origin` | `max-w-3xl` | left | `4xl / 5xl` |
| Beliefs | `Beliefs` | `max-w-5xl` | left | `4xl / 5xl` |
| Ways in | `S07Doors` | `max-w-6xl` | left, two columns | `3xl` |

All four sit inside a `max-w-3xl` parent, so three of them are constrained to a width they
were not designed for. Each also carries `py-24` on top of the fold's own padding, and each
repeats its own heading immediately under the fold summary that just named it.

**Change.** One shared body renderer, one width, one heading scale, one paragraph style, no
inner `<section>` and no inner heading. Content moves to `content/about-folds.ts` as data.

The copy is rewritten to roughly 100 to 150 words per fold, down from about 1,400 words
across the four. A fold is opened by somebody with one specific doubt. It should answer that
doubt and stop.

The renderer supports paragraphs, an optional list and optional links, because *Beliefs* is
a list and *Ways in* carries two calls to action. Prose-only would lose both.

`S06bMaster`, `Origin` (which also exports `Beliefs`) and `S07Doors` are deleted. Nothing
outside `/about` imports them, so this removes dead code rather than orphaning it.

**Not changed.** `S09Team`, `S08Rights` and `S10Enquire` stay as they are. They are the part
of the page a buyer came for and they are not folded.

## 4. An honest review of the site

Delivered as a shareable HTML page, written after the changes above so it describes the site
as it actually is. Ranked by commercial impact: what to cut, what to keep, what is missing.

---

## Verification

`npm test`, `npx eslint .`, `npx tsc --noEmit`, `npm run build`, `npm audit --omit=dev`,
then `audit-enquiry` against a local server for the form, and `audit-responsive` and
`audit-motion` against the deployed site for the cue and the About page.

The copy tests apply to the new About text automatically: they walk the whole tree, so the
banned wording and the em-dash rule are enforced on `content/about-folds.ts` without any new
test being written.

## Out of scope

Audio, social proof, pricing, the rights-first home page argument, the tagline and Jordan's
revenue claim. All still open, all raised, none actioned here.
