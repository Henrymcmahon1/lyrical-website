# Lyrical website — handover

**Date:** 2026-08-04 · **Live:** https://lyricalglobal.com ·
**Repo:** https://github.com/Henrymcmahon1/lyrical-website · **Vercel team:** `hjam`

Read this before touching anything. Most of what follows was learned by breaking something,
and none of it is obvious from the code.

---

## 0. Read these four things first

1. **THE REPO IS PUBLIC.** `"private": false`. Anything you commit is world-readable the
   instant it is pushed. In this session I hardcoded the `/leads` password into a throwaway
   probe script, `git add -A` swept it up, and it went to a public repo. It had to be rotated.
   **Never put a credential in a file here, even for one command.** Pass it via `process.argv`
   or an environment variable. `*-probe.mjs` and `*-e2e.mjs` are gitignored for this reason.
2. **Secrets are unreadable from an agent sandbox.** `vercel env pull` returns the literal
   string `[SENSITIVE]` (13 bytes with quotes) for every secret value. If you send that to an
   API it will be rejected, and that is a fact about the sandbox, **not** about the key. Do not
   report it as a bad key. I did, once, and it was wrong.
3. **You cannot create accounts or enter API keys.** Henry does that. You can do everything
   either side of it, including all DNS via the Vercel CLI.
4. **Everything is verified by running it, never by assuming.** Four separate times this
   session, something that looked right was wrong, and twice my *test* was wrong rather than
   the code. Run the audits in §6.

---

## 1. What this is

A funnel-first marketing site for **Lyrical**, which re-sings existing recordings in another
language in the original artist's voice, keeping the melody, phrasing and the untouched
original instrumental.

**The site has one job: convert a rights holder into an enquiry.** Lyrical's own strategy says
*authorization, not production capability, is the binding constraint*. So the site sells
**trust**, not technology.

Founders: **Jordan Brock** (brand, commercial) and **Henry McMahon** (engineering, the user).

---

## 2. Current state — what works

| | |
|---|---|
| Stack | Next.js 16.2, React 19, Tailwind 4, TypeScript |
| Tests | **216**, all passing (`npm test`) |
| Email host | **Zoho Mail**, US data centre. MX, SPF and DKIM live. `info@` is a GROUP reaching Jordan and Henry |
| Sending | **Resend**, own account owned by `info@lyricalglobal.com`, domain verified. SPF lives on the `send.` subdomain so it does not collide with Zoho's at the apex |
| Confirmation email | **LIVE.** `ENQUIRY_FROM_EMAIL` is `info@lyricalglobal.com`, so `canEmailStrangers()` turns it on |
| Notifications | Go to **both founders**. `ENQUIRY_TO_EMAIL` is a comma separated list, parsed to an array |
| `npm audit` | **0 vulnerabilities** |
| Domain | **https://lyricalglobal.com**, TLS live, `www` 308s to apex |
| DNS | Nameservers moved to Vercel, so **all DNS is CLI-manageable** (`vercel dns add`) |
| Database | **Working.** Supabase `enquiries` table exists, RLS on, no anon policy |
| Enquiry form | **Working.** Live POST returns 200, row written, notification email sent |
| `/leads` | **Working.** Password gated, list, mark handled, CSV export |
| Analytics | Vercel Web Analytics live (`window.vam === 'production'`) |
| Deploy | ⚠️ **`git push origin main` DEPLOYS TO PRODUCTION.** GitHub IS connected to Vercel. This entry said the opposite until 2026-08-09 and it was wrong. See §5 |

### Verified end to end on production

Submit → 200 → row in Supabase → notification to **both founders** AND a confirmation to the
enquirer, both `Delivered` → visible on `/leads` → CSV export contains it → mark handled moves
it between views → sign out makes the export 404.

---

## 3. What is NOT done

### 3.1 Email is DONE. This section is kept as the record of how.

Completed 2026-08-03 and verified by a live send: both founders received the notification and
the enquirer received the confirmation, both `Delivered` in the Resend log.

The address is `info@`, not `hello@`, and it is a Zoho **group** reaching Jordan and Henry
rather than a mailbox. Zoho is on the **US** data centre, so the records are `mx.zoho.com`,
`mx2`, `mx3` and `v=spf1 include:zohomail.com ~all`.

Two things worth keeping in your head:

- **Resend's SPF is on `send.lyricalglobal.com`, not the apex.** That is why there is no
  collision with Zoho. Two `v=spf1` records on one name invalidate **both**, and all mail
  fails. If anything ever moves Resend to the apex, they must be merged into one record.
- **Never add Resend's "Enable Receiving" record.** It is an MX at the apex with priority
  **9**, and Zoho's best is **10**. Lower wins, so it would silently take over every inbound
  message to the domain. Sending and receiving are deliberately split.

`canEmailStrangers()` in `lib/enquiry-email.ts` still derives the confirmation switch from the
sender address. If `ENQUIRY_FROM_EMAIL` ever goes back to an `@resend.dev` address, the
confirmation turns itself off again with no other signal.

### 3.2 Two addresses, two jobs. Do not merge them.

- `ENQUIRY_TO_EMAIL` is server-only, and is now a **comma separated list**. Adding or removing
  a founder is an environment change with no deploy. It is parsed by `enquiryRecipients()`
  into an array before it reaches Resend: handed the raw string, Resend treats it as one
  malformed address and rejects the send, which fails quietly and loses the lead.
- `CONTACT_EMAIL` in `lib/enquiry-email.ts` is **public**. It ships in the client bundle and is
  rendered on the page, so it is the shared company address and never a founder's personal one.

`audit-enquiry` asserts the mailto fallback points at whatever address the page displays,
rather than at a literal copied into the script, so changing one cannot silently drift.

### 3.3 Still open, no decision yet

- **No audio anywhere.** Every `hasAudio` in `content/demos.json` is `false`. The hero says
  "Hear a before and after" and leads to a page with nothing to play. This is the single
  largest conversion lever on the site and the only one that cannot be faked. Blocked on rights.
- **No social proof.** No client names, testimonials or case studies on any route.
- **No pricing signal at all.**
- **Settled 2026-08-03:** the tagline is **"Every song. Any language. Same soul."** Henry
  confirmed the site's wording over the brand document's "One song". It appears in the hero,
  the footer, the page title and the confirmation email, so change all four together.
- **Resolved 2026-08-03 by restructure:** "un-pin *What you receive* on desktop" no longer
  applies. That section was folded into the last step of *How it works*.
- **Settled 2026-08-03:** the name is **Lyrical**, one L. Confirmed by Henry. The site already
  spelt it that way; the brand kit and README no longer carry it as an open question.
- **Raised 2026-08-03, awaiting Henry.** Two recommendations remain open, both argued in the
  site review artifact along with the missing price signal and the language framing:
  rights-first on the home page, and Jordan's "$100 million" claim. Nothing was actioned.
- **Audio is still the blocker, and the rights answer is now known.** Henry confirmed nothing
  is cleared, and that a fully consented original could be commissioned. The production route
  was scoped and then deliberately parked. Two requirements that are painful to retrofit if it
  restarts: get **separated stems**, not a mixdown, because the pitch is an untouched original
  instrumental; and deliver **stereo**.

---

## 4. Locked decisions. Do not silently change these.

### Brand

| Token | Hex | Job |
|---|---|---|
| cream | `#F7EFE1` | space |
| graphite | `#1C1A19` | typography |
| indigo | `#4433D6` | identity |
| ember | `#EE4E22` | action |

Dark treatment (listening sections only): ground `#1B1D1F`, ink `#EDEBE4`, accent `#FF6B2C`.

- **No gradients that paint.** A gradient in `mask-image` is alpha, not paint, and is allowed.
- **Ember never carries body text** — 3.2:1 on cream. Fills and large type only.
- **Indigo is never used on the dark ground** — 2.7:1.
- Fonts: **Fraunces** + **Archivo**, self-hosted woff2, never a CDN. Headings are explicitly
  `font-weight: 600` because Tailwind preflight resets them to 400.
- The full brand system, generated from the same geometry the site uses, is in `brand-kit/`.
  Regenerate with `npx tsx scripts/build-brand-kit.mjs`. Never hand-edit those files.

### Copy rules, enforced by `tests/copy.test.ts`

- **"AI-generated"** — say *recreated*, *re-sung*, *performed*, *transcreation*.
- **`6.4×`, `2.38B`, any population multiplier.** A rights holder's lawyer reads this site.
- **"Solutions"** as a nav label.
- **No em-dashes** in visitor-facing copy.
- **No artist names.**
- **US spelling, from 2026-08-09.** Henry's call, made while setting up a LinkedIn page with
  a US location: a US headquarters next to "authorised" and "catalogue" is the kind of
  inconsistency a label's legal team notices. `authorized`, `catalog`, `program`.

  **The boundary that matters: copy changed, identifiers did not.** `catalogue_size` is a
  live Supabase column, the `name` attribute on the form select, and a CSV header, so it
  still renders in the page source and must stay that way until someone writes a migration.
  `centre` and `sampleCentreline` in `lib/mark.ts` are geometry variables, not words.
  No test enforces the spelling, because a test that scanned for "centre" would fail on the
  Bézier code. Proof was a grep of the RENDERED html on `/`, `/about` and `/hear`: the only
  survivor is `name="catalogue_size"`.

  **Still British on purpose, pending a decision: "enquiry".** The visitor-facing instances
  are the submit button, the confirmation email subject and its first line. The rest of the
  surface is identifiers: the `/api/enquiry` route, the `enquiries` Supabase table, every
  `#enquire` anchor, and the component and file names. Raised with Henry, not actioned.

### Changed decision, on the record — 2026-08-09. "AI" is now allowed.

Henry asked for the site to rank for "AI music translation" and named four more phrases:
music language translation, voice language translation, convert song from one language to
another, AI music language translation. The trade-off was put to him first, that you cannot
rank for a phrase you refuse to write and that the ban exists because a rights holder's lawyer
reads these pages. He confirmed. This is a decision, not drift.

**The line drawn, and it is narrow.** "AI" appears as a **category label** only: the page
title, the meta description, the hero paragraph and the new `/ai-music-translation` page.
**"AI-generated" is still banned and `tests/copy.test.ts` still fails on it**, because that
phrase implies the recording is fabricated, which is the actual claim the rule existed to
prevent. Nothing anywhere says the output is synthetic. Do not widen this to "AI-generated",
"AI-powered vocals" or anything implying the master is not a real performance.

⚠️ **The page title no longer carries the tagline.** It is now
`AI music translation, in the artist's own voice | Lyrical`. That is one of the four places
§3.3 says to change together; the hero, the footer and the confirmation email still carry it.
Flagged to Henry rather than done silently, because Google spends roughly sixty title
characters left to right and opening with "Lyrical |" wastes them.

`/ai-music-translation` is a real page, not a doorway. If a future session is tempted to thin
it out to chase a ranking, delete it instead. A thin page drags on how the whole domain is
judged and this site has only three others to carry it.

### Stated assumption, on the record

The site claims **8 languages**. The internal capability document proves **Spanish ↔ English**
only. Raised with Henry three times and confirmed. Do not reopen without being asked.

### Changed decision, on the record — 2026-08-03

The spec records that **public technical depth is limited to outcomes** and that the site sells
trust rather than capability. The product section is now headed **"Our technology"**, which is
a capability label.

This was Henry's explicit instruction, given after the trade-off was put to him: that a
section headed this way invites the pipeline and tooling questions the rule exists to prevent,
and that a rights holder's lawyer reads that page. He asked for it anyway, twice.

**What did not change:** the three points underneath are still worded as outcomes. No pipeline
stage, vendor, tool or cost appears anywhere. The label moved; the content did not. If you are
tempted to "fix" this heading back to an outcome, it is a decision, not drift.

---

## 4b. Session 3 (2026-08-04). What changed, and what is still unproven.

### Shipped and verified on production

| | |
|---|---|
| Nav | **About + Get started only**, one label at every width. "Hear it" removed because it pointed at a page with nothing to play; "How it works" removed as an anchor into a page that is now two sections |
| Nav bar | **White**, opaque, no backdrop blur. White is outside the four locked tokens: Henry's call, recorded |
| Trademark | `components/Trademark.tsx`, on the nav and footer lockups. **™ NEVER ®** |
| Home page | Three pinned sections became **two**: `S04Fidelity` = "Our technology", `S05How` = "How it works". Three points each, titles pinned and indigo, numbering base 1 |
| `/leads` | **Delete** with a confirm step, and the 500-row cap now says "Newest 500 of N" instead of hiding rows silently |
| `/listen` | New private page. See below |
| Email signatures | `docs/email-signatures.html`, and the logo at `public/brand/lyrical-lockup.png` |
| Mobile | The audience section stopped clipping its last paragraph on short screens |

### `/listen`, the private demo page

Not linked from anywhere. Password gated, `noindex`, disallowed in robots, absent from the
sitemap.

- `DEMO_PASSWORD` is **separate** from `ADMIN_PASSWORD`, and the session namespace is
  `listen:` against `admin:`. `GATE_SECRET` now signs three things, so without namespacing a
  prospect handed the listening password would hold a valid **admin session for the enquiry
  inbox**. Tests assert each rejects the others' tokens.
- Sessions last **4 hours**, against 12 for admin, because this password goes to people
  outside the company and onto devices that are not theirs.
- Audio lives in a **private Supabase bucket** (`listen`), NOT in `public/` and NOT in git.
  Signed URLs are minted per render, and only after the password check.
- There is no `hasAudio` flag. Availability is derived from whether storage can sign the
  object, because the flag went stale once and left the page lying about what it had.
- Two of three tracks are uploaded. The third, our own Spanish version, is still pending.

⚠️ **UNVERIFIED.** After the CSP fix below, nobody has confirmed the players actually play for
a real visitor. The in-app browser blocks signed URLs by its own safety filter, so it cannot
be tested from an agent session. **Ask Henry to load `/listen` in his own Chrome and press
play before building anything else on that page.**

### Gotchas from this session

**A cross-origin move needs a CSP change, and it fails silently.** Moving the audio to
Supabase broke playback: there was no `media-src`, so it fell back to `default-src 'self'`.
The page rendered three players, the console was empty because `preload="none"` fetches
nothing until play, and the controls just sat dead at 0:00. `media-src` is now derived from
`SUPABASE_URL` in `next.config.ts`.

**`vercel --prod` uploads gitignored files; a redeploy from anywhere else does not.** The
audio briefly lived in `public/`, reached production only because the CLI uploads the working
directory, and vanished the first time a deployment came from elsewhere. Tested, not assumed.
This is why the audio is in storage now.

**Zoho's signature editor has no HTML source view.** Pasting raw HTML puts the code on screen
as text. Copy the rendered block.

**An email signature cannot do dark mode.** No `<head>` for `color-scheme`, and Zoho strips
`<style>`, so no media query. The only reliable answer is to give it its own opaque
background, which is why the signature is a white card and the logo PNG is white-backed
rather than transparent.

**`file_upload` in the browser tools only accepts chat attachments.** Not a repo path, not the
scratchpad, and granting folder access does not change it. Henry has to drag files in himself.

---

## 4c. Search visibility. Session 4, 2026-08-09.

### Done and verified

| | |
|---|---|
| Google Search Console | **Domain property `sc-domain:lyricalglobal.com`, ownership VERIFIED** under `henryjamcmahon@gmail.com` |
| Verification method | DNS TXT at the apex, added with `vercel dns add` (`rec_1de1ef96d8204c06caaac966`). ⚠️ **Deleting that record un-verifies the property** |
| Sitemap | Submitted. Status read "Couldn't fetch" immediately after, which was Google not having fetched yet: a `Googlebot` user-agent request returns 200 `application/xml` and robots allows it. Both checked |
| Home page | Recrawl requested, added to the priority crawl queue |
| Structured data | Organization + WebSite JSON-LD, joined by `@id`. `lib/structured-data.ts` |
| `og:image` | Was **missing entirely**, so every shared link previewed as a grey box. `public/og.png`, generated by `scripts/build-social-images.mjs`, committed |
| Canonicals | On all three public routes, relative so previews cannot claim production's canonical |
| `/llms.txt` | Live |

### The actual reason nothing showed up, and it was not what it looked like

`site:lyricalglobal.com` returned **one** result, titled **"Untitled"**, with the snippet
**"Do Not Sell or Share My Personal Information."** That is not this site. Google's index held
a **stale snapshot from before the domain was ours**, almost certainly a parking page.

This matters because every obvious diagnosis was wrong. Search Console reports the URL as
"on Google" and "indexed", which looks healthy. The site is crawlable, robots is correct, the
sitemap is valid. The page was indexed the whole time, with somebody else's content. The fix
is the recrawl already requested, not anything in the code.

**Check `site:lyricalglobal.com` again before concluding anything about SEO.** If it still
says "Untitled", the recrawl has not landed yet and no other change will help.

### ⚠️ "Lyrical Global" is already somebody else's entity

Searching `lyricalglobal` returns Lyrical Asset Management, a New York value equity firm, and
**Google's AI Overview states that "Lyrical Global" refers to their global investment
strategies.** A separate company trading as "lyrical AI" also holds a LinkedIn page.

This partly contradicts the advice given earlier in the same session, that "Lyrical Global" is
the more searchable name. It is more searchable than "Lyrical", and it is also **already
defined in Google's knowledge surface as a fund family**. Displacing an established asset
manager for that phrase is a much harder job than it looked, and it was recommended before
this was checked. Raised with Henry; the LinkedIn page name was still open at the time.

### Still not done

- **No backlinks.** Nothing on the web links here. Biggest remaining lever and it is outreach.
- **Bing Webmaster Tools.** Not set up. Matters twice over because Bing feeds ChatGPT.
- **`sameAs` is empty** in the structured data until the LinkedIn page exists. One line in
  `lib/structured-data.ts` when it does.
- **`/hear` is still in the sitemap with nothing on it**, and its meta description promises
  playback the page cannot deliver. Decision still open.
- **The `<h1>` is the tagline** and contains nothing anyone searches. Changing it means
  changing a locked decision in four places, so it was left alone.

---

## 4d. Song portal. Live infrastructure, applied 2026-08-09.

Applied by me directly in the Supabase dashboard, and each one verified by querying the live
database afterwards rather than trusting the success message.

| | |
|---|---|
| Auth Site URL | **Changed from `http://localhost:3000` to `https://lyricalglobal.com`.** It had never been set. Every magic link would have pointed at localhost, and it fails silently |
| Redirect URLs | `https://lyricalglobal.com/**` and `http://localhost:3000/**` |
| Email provider | **Already enabled.** Henry could not find a switch because there was never one to flip. Signups on, confirm email on |
| Schema | `supabase/schema.sql` run in full. Verified: 4 tables, 2 private buckets, 7 table policies, 2 storage policies |
| `enquiries` policies | **0, and that is correct.** RLS on with no policy means service-role only. Do not "fix" this |

**How to paste a large file into the Supabase SQL editor.** Do not type it. The editor is
Monaco and it auto-closes brackets and quotes, so typed SQL arrives corrupted. Instead set the
model value directly, and fetch the file rather than embedding it, so what runs is byte-exact:

```js
const sql = await (await fetch('https://raw.githubusercontent.com/Henrymcmahon1/lyrical-website/main/supabase/schema.sql')).text()
window.monaco.editor.getModels()[0].setValue(sql)
```

Monaco takes about fifteen seconds to appear on that page; `window.monaco` is undefined before
then and there is no visible spinner once the shell has rendered.

⚠️ **Supabase warns "This query includes destructive operations" on this file.** It is the
`drop policy if exists` lines, which is the idempotent pattern: each drops a policy name that
this file also creates on the following line. There is no `drop table`, `delete`, `truncate`
or column drop anywhere in it. Read it before clicking through, but it is expected.

### Still needed before auth works

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, in `.env.local` and in Vercel.
**Henry sets these; I do not transcribe keys.** The anon key is safe in the client bundle, the
service role key is not and must never appear in a `NEXT_PUBLIC_` variable.

⚠️ **`tests/copy.test.ts`, the test named "exposes nothing secret through a `NEXT_PUBLIC_`
variable", fails the build if any such variable other than the site URL appears in the
source.** Its `ALLOWED` set holds exactly one name today. Widen it to exactly the two new
names, with a comment saying why, rather than deleting the guardrail. It exists because
`NEXT_PUBLIC_` is inlined into the client bundle, so a secret given that prefix is published
rather than configured.

---

## 5. Gotchas that cost real time

**Two scroll clocks, and they are not interchangeable.** `lib/scroll-progress.ts` exports
`trackProgress` and `entryProgress`. Track progress is 0 at the moment a sticky panel sticks —
when the panel already fills the screen — so a fade keyed to it starts at `opacity: 0` on a full
screen. It is also **forced to 1 whenever an element is shorter than the viewport**, which is
what silently disabled the mobile morph for weeks. Use it only where something actually pins.

**Every section pins at every width now.** The old mobile gate is gone. Two unpinned
alternatives were tried and both were worse: a carousel sliced cards mid-word, and a sticky rail
collided with the heading. The trap the gate feared is prevented by construction instead: the
panel is `calc(100vh - var(--nav-h))` and sticks *below* the nav, travel is bounded at 18vh per
step on mobile against 26vh on desktop, and a progress line under the nav shows scrolling is
still doing something.

**The mark has no counter.** `≈` is two open strokes; its middle is the *gap*. Any aperture,
punch-out or clip-through built from it renders a blank cream screen. Use overlapping
transform+opacity layers.

**Never use `animation-timeline: view()`.** It was observed pinning elements at negative
progress alongside Lenis, leaving 14 of 17 sections permanently at `opacity: 0`.
IntersectionObserver only. A test asserts this.

**Reveal animations must stay scoped to `.js-motion`.** An inline script in `layout.tsx` adds
it before first paint. Unscoped, every wrapped section renders invisible with JS off.

**In-memory rate limiting does not work on Vercel.** Measured, not assumed: six wrong passwords
against production were throttled **zero** times, because requests spread across serverless
instances and each saw its first attempt. It *is* effective on `/api/enquiry` (five then 429,
confirmed live) only because bursts tend to hit one warm instance. `/leads` is protected by the
password strength plus a 500ms delay on failed logins, not by the limiter. Real per-IP limiting
needs shared state in Redis or Postgres.

**`requestAnimationFrame` is paused in the in-app Browser pane.** Anything rAF-driven reads as
inert there. Use Playwright for motion; the pane is fine for static geometry.

**Lenis eases scroll.** Any `scrollTo` in a test must poll until `scrollY` settles. A fixed
timeout samples mid-flight and gave false readings twice.

**Network Solutions' account area renders blank under browser automation.** Do not try to drive
it. DNS is at Vercel now anyway.

**`git push origin main` IS a production deploy. This document said otherwise for weeks.**

GitHub is connected to Vercel. A push to `main` builds and promotes to production on its own,
and the resulting deployment carries the alias `lyrical-website-git-main-hjam.vercel.app`,
which is how to tell a git deploy from a CLI one:

```bash
npx vercel inspect <deployment-url> | grep git-main
```

On 2026-08-09 I pushed a commit intending only to share code, and it shipped a set of copy
changes Henry had explicitly asked me to hold. Nothing broke, but it went live an hour early
and neither of us expected it, because §2 of this file asserted the opposite.

**Consequence: there is no such thing as "commit and push but do not deploy" on this repo.**
If work must not go live, keep it on a branch. Pushing `main` is shipping.

**`vercel --prod` can print "Not authorized" and deploy anyway.** Twice on 2026-08-09 the CLI
ended with a JSON blob reading `"status": "error"`, `"reason": "deploy_failed"`,
`"message": "Not authorized"`, and both times production was serving the new build within
seconds. `vercel whoami` was fine and `vercel project ls` showed the project updated. **Do not
re-run the deploy on the strength of that message.** Read the live site instead: curl the page
and grep for a string only the new build contains. That is the only trustworthy signal, and it
is the same lesson as `vercel env ls`.

**Vercel certs do not always auto-issue.** A `000` from curl on a fresh domain usually means no
certificate exists (`vercel certs ls` confirms), not a DNS fault. Force with `vercel certs issue`.

**`npm audit fix --force` wanted to install `next@9.3.3`.** It is not a fix. `sharp` and
`postcss` are pinned via `overrides` in `package.json` instead, which cleared all 7 advisories.

**An audit that hardcodes today's numbers fails tomorrow for the wrong reason.** Restructuring
three pinned sections into two broke `audit-motion` twice, and neither failure was about
motion. It asserted the literal track heights `[2.04, 2.3, 2.04]`, which encoded how many
sections existed; and `mobile-pin-block` scrolled to a fixed `500px` to prove the panel holds,
which with a three-step section is two pixels past the end of the hold, so a working pin read
as broken. Both now derive from the live geometry: height is checked as `100vh + 26vh per
step`, and the hold is sampled as a fraction of `track height - panel height`. Assert the rule,
never a snapshot of it.

**A Playwright locator re-resolves, and that will fool you.** `.pin-cue:visible` looked like a
handle on one element. As the page scrolled it silently started describing the *next* section's
cue, freshly visible at full opacity, so a fade that worked perfectly read as broken. When you
need to watch one element change over time, take an `evaluateHandle` and keep it. This is the
third time in this repo that a failing check was the test's fault, not the code's.

**The optional enquiry fields live inside a closed `<details>`.** Playwright will not act on a
hidden control, correctly, so any script touching role, company, catalogue size, languages or
the message has to click the `summary` open first. `audit-enquiry` does.

**`vercel env ls` shows a `created` date that does not move when you think it should.** It was
the only signal available for whether a new API key had actually been saved, and it was
ambiguous. There is no way to read a value back: `vercel env pull` returns `[SENSITIVE]`. The
only real proof that a key works is a live send appearing in the Resend log.

---

## 6. How to verify anything

```bash
npm test                                            # 216 tests
npx eslint .                                        # must be silent
npx tsc --noEmit                                    # must be silent
npm run build                                       # must compile clean
npm audit --omit=dev                                # must be 0

node scripts/preflight-enquiry.mjs                  # which env vars exist, what a visitor gets
node scripts/preflight-enquiry.mjs --smoke          # sends ONE real labelled test enquiry
node scripts/audit-responsive.mjs <url>             # overflow, blank screens, tap targets
node scripts/audit-motion.mjs <url>                 # proves the motion MOVES, 31 assertions
node scripts/audit-enquiry.mjs http://localhost:3000 # the 503 path and the mailto fallback
```

`audit-enquiry` asserts the **unconfigured** branch, so run it against a local server with no
`RESEND_API_KEY`, not production.

**The tests are not decoration.** They encode commitments: measured contrast ratios, the banned
copy list, that no secret appears in a client component, that no `NEXT_PUBLIC_` variable other
than the site URL exists, that email HTML escapes user input, that the CSV export defuses
spreadsheet formula injection, and that the pin never runs under reduced motion. If one fails,
fix the code.

**Deploy is manual:**

```bash
git push origin main && npx vercel --prod --yes
```

---

## 7. Credentials and where they live

Nothing secret is in the repo. All of it is in Vercel → Settings → Environment Variables, and
values can be revealed there with the eye icon.

| Variable | State |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Set (Preview + Production) |
| `RESEND_API_KEY` | Set (Preview + Production). **Rotated 2026-08-03** to the new `lyricalglobal` account, key named `lyrical-website-prod`, sending access only |
| `ENQUIRY_TO_EMAIL` | `jordan@lyricalglobal.com,henry@lyricalglobal.com` (all three environments). Comma separated |
| DNS | DMARC added 2026-08-03: `v=DMARC1; p=none; rua=mailto:info@lyricalglobal.com; fo=1`. Monitor only. Reports are XML and land in the shared inbox |
| `ENQUIRY_FROM_EMAIL` | `info@lyricalglobal.com` (all three). This is what makes the confirmation email live |
| `GATE_SECRET` | Set (all three environments) |
| `NEXT_PUBLIC_SITE_URL` | `https://lyricalglobal.com` (Production + Preview) |
| `ADMIN_PASSWORD` | Set (all three). **Rotated 2026-07-31 after I leaked the previous value.** |

`GATE_SECRET` signs two different things: the visitor audio-gate cookie and the `/leads`
session. The admin payload is namespaced `admin:` for that reason — without it, every visitor
who asked for examples would hold a valid admin session. A test asserts a gate token is rejected.

---

## 8. File map

| Path | Responsibility |
|---|---|
| `lib/mark.ts` | Pure Bézier geometry. The mark is *generated*, never hand-drawn |
| `lib/scroll-progress.ts` | The two clocks. Read its doc comment before using either |
| `lib/enquiry-email.ts` | One source for the notification and the confirmation, plus the mailto fallback |
| `lib/enquiry-schema.ts` | Zod schema. `name` is conditionally required: optional for the gate |
| `lib/admin-auth.ts` | `/leads` session signing and password check. Fails closed |
| `lib/rate-limit.ts` | In-memory limiter. Read the honest limitation in its doc comment |
| `lib/csv.ts` | CSV writer that defuses spreadsheet formula injection |
| `app/api/enquiry/route.ts` | Validate → rate limit → Supabase → Resend → cookie, with a degradation ladder |
| `app/leads/` | The enquiry inbox. Page, server actions, CSV export route |
| `components/Pinned*.tsx` | The pinned sections, now pinning at every width |
| `next.config.ts` | Security headers, CSP, and the www → apex redirect |
| `brand-kit/` | Generated brand kit. Share the folder; start at `brand-guide.html` |
| `supabase/schema.sql` | Idempotent. Safe to re-run |
| `content/about-folds.ts` | The four /about folds, as data. Edit words here, never in a component |
| `components/FoldBody.tsx` | The one renderer those folds share. Holds no copy of its own |
| `components/PinnedStepper.tsx` | The process section. Owns the pinned mobile header; copy comes from the section |
| `components/PinnedClaims.tsx` | The product section. Same contract. Stopped hardcoding its own copy on 2026-08-03 |
| `components/ScrollCue.tsx` | One chevron, two modes: controlled by the caller, or self retiring on first scroll |

**Audio drop-in:** `public/audio/{src}-{tgt}/{slug}.original.mp3` and `.translated.mp3`,
lowercase pair folder, then set `hasAudio: true`. Adding a pair is a data change.

⚠️ The "Send me before and afters" button promises **a personal email**, because no audio
exists. If audio is published, update that copy.

---

## 9. Do not repeat these mistakes

Four things went wrong in this session that were mine, not the code's:

1. **A credential in a committed file.** Covered in §0.
2. **Trusting a control I had not measured.** I shipped rate limiting and a weak generated
   password believing the limiter protected it. A live test showed it did not throttle at all.
   Measure the control, then choose the password strength that survives the control failing.
3. **Tests that asserted the wrong property.** Twice a "failure" was my assertion, not the
   code: checking class names where I should have checked `position: sticky`, and checking
   elements at rest where I should have checked only what was on screen. When a test fails,
   ask what property actually matters before touching either side.
4. **Reporting a sandbox artifact as a user-facing fault.** See §0 item 2.
