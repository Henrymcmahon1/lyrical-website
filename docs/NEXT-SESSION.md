# Next session

Read `docs/HANDOVER.md` first, all of it. §0, §4d, §4e, §4f, §5 and §9 matter most. This file is
the brief for what comes next and assumes you have read that one.

**Written 2026-08-12.** Everything described here is live on production and was read back off
`https://lyricalglobal.com` rather than trusted from a deploy message.

---

## The three rules that will catch you out

1. ⚠️ **`git push origin main` DEPLOYS TO PRODUCTION.** There is no push-without-shipping on this
   repo. Work that must stay dark goes on a branch.
2. ⚠️ **THE REPO IS PUBLIC.** Never put a credential in a file, even for one command. Pass it via
   `process.argv` or an environment variable. `*-probe.mjs` and `*-e2e.mjs` are gitignored
   precisely because a password was once swept into a commit here.
3. ⚠️ **Never leave a dev server running on localhost:3000 without telling Henry.** He signed up
   against one on 2026-08-11 and the magic link went out pointing at localhost. Stop it with
   `preview_stop` when you are done.

**You cannot create accounts or enter API keys or passwords.** Henry does that. You can do
everything either side of it, including all DNS via the Vercel CLI and all SQL via the Supabase
dashboard in his Chrome, which he has authorised.

---

## State, 2026-08-12

| | |
|---|---|
| Live | https://lyricalglobal.com, TLS, `www` 308s to apex |
| Stack | Next.js 16.2, React 19, Tailwind 4, TypeScript, Supabase, Resend, Vercel |
| Tests | **396**, `tsc` silent, `eslint` silent, `npm audit --omit=dev` 0 |
| Git | Clean tree, nothing unpushed, `main` = `008d204` |
| Public routes | `/`, `/about`, `/hear`, `/contact`, `/ai-music-translation` |
| Gated routes | `/studio`, `/studio/new`, `/studio/voices`, `/studio/voices/new`, `/queue`, `/listen` |
| Supabase tables | `enquiries`, `profiles`, `song_jobs`, `song_job_assets`, `voice_models`, `voice_samples` |
| Buckets | `listen`, `submissions`, `voice-training`, all private |

### The funnel, end to end

Visitor lands → every page closes with **"Make your song multilingual"** → `/studio` → magic link
(sent by us, not Supabase) → upload stems or a full mix, plus an optional lyric sheet → job is
`submitted` → founders emailed → **a human presses Accept in `/queue`**, which stamps
`approved_at` and starts the 48 hour clock → Being made → Delivered, which emails them and says
the files are coming separately.

`/contact` is the second funnel, for a label with a catalog rather than one song.

`/studio/voices` is where an artist's clean vocals go so a voice model can be trained. Separate
from songs, because a voice belongs to an ARTIST and is reused by every song they send.

---

## ⚠️ The two constraints that shape every decision

### Storage: 50MB per file, 1GB total

Supabase's free plan has a **fixed 50MB per-file upload limit**, stated in the dashboard, **not
configurable**. Total storage is 1GB. Henry chose to stay free on 2026-08-12 with the numbers in
front of him.

- A 3 minute 48kHz/24-bit **stereo WAV is ~52MB and will not upload.** Lead with FLAC everywhere:
  lossless, ~45% smaller, and it turns that master into ~30MB.
- 1GB is about **seven artists** of voice training data at mono FLAC, or three at stereo WAV.
- Pro is $25/mo for 100GB and a configurable limit. `MAX_UPLOAD_BYTES` in `lib/voice-training.ts`
  and `MAX_BYTES` in `lib/song-upload.ts` are the only two constants that change.

### The delivery promise widens silently

`OFFERED` derives from `lib/languages.ts` and `GUARANTEED` derives from `OFFERED`. **Adding one
language commits us to 48 hours on sixteen more pairs** with nothing in `language-pairs.ts`
changing. Nine languages is 72 pairs. Do the multiplication before adding one, and say the number
out loud to Henry.

The only brake is that the clock starts at **acceptance**, never at upload. `/queue` names the
pair and the promise next to the Accept button for that reason.

---

## Nobody has ever done these. They are the highest-value things left.

1. **Sign in to `/queue` on production and move a real job.** Every guard, transition and render
   is unit tested and the unauthenticated surface was read back live, but no human has pressed
   Accept. Specifically: **click a file and check it plays.** That is the first exercise of a
   signed URL from the `submissions` bucket. If it fails, look at `media-src` in `next.config.ts`
   first: a cross-origin media move broke `/listen` in exactly that way, silently.
2. **Upload a real voice training set.** The whole `/studio/voices` flow is unexercised by a
   human.
3. **`/listen` playback.** The oldest open item in the project. The in-app browser blocks signed
   URLs by its own safety filter, so it cannot be checked from an agent session. Henry has to open
   it in his own Chrome and press play.

---

## The work, in rough order

### 1. Delivery has nothing behind it

Marking a job delivered emails the customer and that is all. There is no delivery table, no
bucket, no player. Henry's call on 2026-08-11 was status plus email for now, with audio going
across by hand, and `jobDeliveredText` says exactly that.

The real version needs a `song_job_deliveries` table, a private bucket, staff upload from
`/queue`, and playback in the studio behind short-lived signed URLs. **Never put a signed URL in
an email** whatever else changes: `tests/song-job-email.test.ts` enforces that across every
template.

### 2. Audio anywhere on the site

Still the largest conversion lever and the only one that cannot be faked. Blocked on rights, not
on code. `content/demos.json` has `hasAudio: false` on everything. When it publishes, `/hear` is
the first page that should get it, and `components/sections/S03Wheels.tsx` can stop being coy.

### 3. No pricing signal, no social proof

"No upfront cost" is the only commercial number on the site. No client names, testimonials or
case studies anywhere.

### 4. Smaller, known

- `SongsTab` and `VoicesTab` resolve submitter emails via `auth.admin.listUsers({ perPage: 1000 })`.
  Past a thousand accounts the tail renders "unknown sender", which is the right failure
  direction, but it wants paging or a denormalised column.
- Rate limiting is in-memory and therefore per serverless instance. **Measured, not assumed:** six
  wrong passwords against production were throttled zero times. Real per-IP limiting needs Redis
  or Postgres.
- `lib/enquiry-schema.ts` still has a `source === 'gate'` branch making `name` optional. The gate
  was removed on 2026-08-11 so that path is dead. Harmless, worth a tidy.
- No backlinks anywhere on the web. Biggest remaining SEO lever and it is outreach, not code.
- Bing Webmaster Tools not set up. Matters twice because Bing feeds ChatGPT.
- `sameAs` in `lib/structured-data.ts` is empty until a LinkedIn page exists.

---

## Locked. Do not quietly change these.

| Decision | Detail |
|---|---|
| Brand renders **`lyrical`**, lowercase, everywhere | Body copy, titles, JSON-LD, email subjects. Tests pin it |
| Tagline | "Every song. Any language. Same soul." |
| **Nine languages** | EN, ES, PT, FR, DE, ZH, YUE, JA, KO. Italian removed 2026-08-12 |
| Mandarin stays **中文**, Cantonese is **粵語** | Put to Henry that 中文 reads as "Chinese" and 普通話 would be more precise beside 粵語. He chose to leave it |
| Cantonese is **`YUE`** | Three letters where others are two. ISO 639-3. Cantonese has no two-letter code |
| **All 72 pairs carry the 48 hours**, from acceptance | Henry's instruction after the trade-off was put to him twice |
| No other speed claim anywhere | He rejected "instantly" as untrue |
| "No upfront cost" only. **Never mention the royalty model** | Lives in the hero, `S05How` step 2, the `S10Start` closing line, and two emails. Change together |
| **Rejection sends no email** | `tests/job-transitions.test.ts` pins it |
| Studio is the primary conversion, `/contact` secondary | Do not put the enquiry form back on the home page |
| Scorecard shows **no numbers** until benchmark data arrives | Describing a measurement that does not run is checkable |
| Lyrics optional at submit, editable until accepted | Queue flags a job that arrived without them |
| Lyrics DO go in the founder email and the CSV | Henry's call after the argument against was put to him. Founders only, never the customer's copy, never as a link |
| No delete for a song job or a voice model | The row records what somebody asserted and when |
| No gradients. Ember never carries body text. Indigo never on the dark ground | `tests/tokens.test.ts` measures the contrast |
| US spelling in visitor copy, identifiers keep the old spelling | `catalogue_size` is a live column and a CSV header |

---

## Traps this codebase has actually fallen into

- **An RLS policy cannot restrict COLUMNS, only rows.** `internal_notes` was documented as staff
  only and was readable by customers for weeks. The fix is a column GRANT. And the obvious
  `revoke select (col)` **does nothing silently**, because Postgres cannot subtract a column from
  a table-level grant: you must `revoke select` then `grant select (the columns you want)`.
- **Therefore a new column on `song_jobs` is invisible to customers until it is added to that
  grant.** This bit once already when `lyrics` was added.
- **JSX eats the space between `{expr}` and the text after it** when that text wraps to the next
  line. Shipped "48hours" to production. `tsc`, `eslint` and 317 tests were all green. Use
  `&nbsp;`. The guard lives in `audit-responsive`, NOT in a unit test, because vitest's compiler
  and Next's disagree and a unit test passed with the bug present.
- **Whitespace between two flex items is not rendered**, so a space or `{' '}` before an arrow in
  an `inline-flex` link does nothing. Use `gap-1.5`.
- **`innerText` reports a newline between flex items either way**, so it will tell you the arrow
  spacing is still broken after you have fixed it. Measure pixels.
- **`vercel --prod` can print "Not authorized" and deploy anyway.** Read the live site back.
- **An audit that hardcodes today's numbers fails tomorrow for the wrong reason.** Assert the
  rule, never a snapshot of it.
- **A Playwright locator re-resolves.** `evaluateHandle` and keep it when watching one element.
- **Lenis eases scroll.** Poll until `scrollY` settles; a fixed timeout samples mid-flight.
- **`requestAnimationFrame` is paused in the in-app Browser pane.** Use Playwright for motion.
- Three times a "failure" here has been the test's fault, not the code's. Ask what property
  actually matters before touching either side.

---

## Verify before claiming anything is done

```bash
npm test                 # 396 tests
npx tsc --noEmit         # silent
npx eslint .             # silent
npm run build            # clean
npm audit --omit=dev     # 0

node scripts/audit-responsive.mjs http://localhost:3000   # ~5 min, do not skip after layout changes
node scripts/audit-motion.mjs http://localhost:3000       # 31 assertions
node scripts/audit-enquiry.mjs http://localhost:3000      # needs a server with NO RESEND_API_KEY
```

`audit-enquiry` drives `/contact` through a named `ROUTE` constant. `audit-responsive` covers
`/contact` too and carries the fused-word check. If the form moves again, move both with it.

**Then read the live site back with curl or Playwright.** Do not trust a deploy message.

---

## How Henry wants to be talked to

Short. Lead with the answer. Tables and dot points over paragraphs. **Never use em dashes**, in
chat or in anything you build: rewrite the sentence, do not swap in a hyphen. Give complete
absolute Windows paths. Flag spend before it happens. **Ask questions rather than guessing.**
