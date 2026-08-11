# Next session: the studio funnel

Read `docs/HANDOVER.md` first, all of it. This file is the brief for what comes next and
assumes you have read that one. Sections §0, §4c, §4d, §5 and §9 matter most.

**Everything below was decided by Henry on 2026-08-09 after the trade-offs were put to him.
They are decisions, not suggestions. If you think one is wrong, say so before building.**

---

## Where things stand

| | |
|---|---|
| Portal phase 1 | Auth, submission form, direct-to-storage upload, job record, both emails, live status |
| Verified end to end | One real submission: 2 FLAC stems, 36MB, in storage, sizes matched, paths correctly scoped |
| `/queue` | **Does not exist.** Nothing can move a job past "Received". This is the hole |
| Live on production | Home page copy, SEO, `/ai-music-translation`. **Not** the studio |
| Unpushed | Three portal commits. ⚠️ Pushing them deploys them |

### The one thing that will bite you

⚠️ **`git push origin main` deploys to production.** `docs/HANDOVER.md` §2 said the opposite
until today and it was wrong; it caught me out. There is no "push but do not ship" on this
repo. Work that must stay dark goes on a branch.

---

## The work, in order

### 1. `/queue`, the internal console

One page, **two tabs: Songs and Enquiries.** Henry's call.

- Move the existing `/leads` code across rather than rewriting it. It works, it is tested, and
  its CSV export defuses spreadsheet formula injection. Do not lose that.
- Keep `/leads` as a redirect so nothing bookmarked breaks.
- Reuse `lib/admin-auth.ts`. It is namespaced `admin:`, fails closed, and is already tested.
  Do not invent a second password.
- Songs tab needs: the job, who sent it, the files, and **accept / reject** actions. Accepting
  sets `approved_at`, which is when the 48 hour clock starts.
- Staff paths use `supabaseAdmin()` (service role, bypasses RLS). Customer paths use
  `supabaseServer()`. Never mix them up.

⚠️ Signed URLs for staff to hear a submission must be **short lived**, and must never be put
in an email. See rule 4 below.

### 2. Emails: welcome and lifecycle

Henry wants these three, and **explicitly did not want a rejection email**:

| Trigger | Send |
|---|---|
| Account created | ✅ Welcome |
| Job accepted | ✅ "We have taken it on", and this is where the 48 hours starts |
| Job delivered | ✅ "Ready to hear" |
| Job rejected | ❌ **Deliberately silent.** Henry chose this. Flag it once if you think it is wrong, then respect it |

Existing work to build on, not replace:

- `lib/song-job-email.ts` already has the submission notification and confirmation.
- `tests/song-job-email.test.ts` enforces **no storage paths, no signed URLs, no bucket names,
  no filenames** in any email. Keep that test passing for every new template. Email is
  forwarded, archived and searched by systems nobody here controls.
- `enquiryRecipients()` parses the comma separated founder list. `canEmailStrangers()` gates
  mailing non-staff on a verified sender.
- ⚠️ `RESEND_API_KEY` is **not** in `.env.local`, so emails do not send locally. They send on
  production. Do not conclude the code is broken.

**"Make the emails nice" is part of the ask.** They are plain now. Brand tokens only, cream
ground, Fraunces for headings, no gradients, and remember an email cannot do dark mode:
`docs/email-signatures.html` and §4b explain why.

### 3. The home page as a funnel

Henry's decision: **the primary conversion is signing up and submitting a song. The enquiry
becomes secondary and moves to `/contact`.**

- Home drives to the studio. The nav "Get started" should too.
- Build `/contact` and move the enquiry form there. **Do not delete it.** A label with five
  thousand tracks will never upload WAVs one at a time. Two funnels, two buyers.
- `S10Enquire` currently holds the form and is used on several routes. Untangle carefully.
- The hero's ember button still says "Hear a before and after" and points at `#hear`, a
  section with nothing to play. It has been raised twice and never actioned. Raise it again.

⚠️ `scripts/audit-enquiry.mjs` runs against the enquiry form and asserts the 503 degradation
path. If the form moves, update the audit's route or it fails for the wrong reason. This repo
has broken audits that way three times.

### 4. The Scorecard section in the studio

Henry's decision: **explain the method, show no numbers.**

The scorecard is "in build next" and produces nothing yet, so a section with scores in it
would be describing a measurement that does not run. Build an explanatory section under the
customer's songs covering what gets measured and, crucially, that **every score is relative to
the artist's own original recording**, which is the whole argument.

The seven criteria, from Henry's document:

| Criterion | Measured as |
|---|---|
| Intelligibility | ASR word error rate against the lyric sheet, ours relative to the original's own rate |
| Translation quality | Semantic adequacy, rhyme density, singability, plus a rubric-scored native-reader review |
| Artist timbre | Speaker-embedding similarity to the artist's real stem, ceilinged by their own verse-to-verse variation |
| Melody fidelity | Pitch-curve agreement with the original performance |
| Naturalness | SingMOS-family predictor, scored as the gap to the original |
| Mix seat | Level, tone and stereo width against the original vocal's place in the record |
| Completeness | Material covered, words dropped, lines over budget |

The point to land, in plain words: the original recording sets the ceiling, because a fast
reggaeton track defeats speech recognition even on the real record. A score is meaningless in
isolation and meaningful against the artist's own.

⚠️ **Do not state or imply that we reach the original's standard.** Henry is sending benchmark
data separately and it has not arrived. Until it does, the method may be described and no
result may be claimed. This is the same trap as the intelligibility claim in §4c.

---

## Locked, do not quietly change

| Decision | |
|---|---|
| Brand renders **`lyrical`**, lowercase, everywhere | Tests pin it |
| Tagline unchanged | "Every song. Any language. Same soul." |
| No claim about speed anywhere except the 48 hours, which counts **from acceptance** | Henry rejected "instantly" as untrue |
| "No upfront cost" only. **Do not mention the royalty model** | Henry's call, made after I argued the other way |
| `GUARANTEED` in `lib/language-pairs.ts` is **EN↔ES only** | All eight are offered; only these promise 48 hours. Henry has still not confirmed the real list. **Ask him** |
| Open signup, manual approval before anything processes | Controls rights exposure and compute spend together |
| Stems preferred, full mix accepted, half a stem set rejected | |
| Signature before release, after they hear it | |

---

## Blocked on Henry

- **Which language pairs are genuinely deliverable.** Still unanswered after three asks.
- **Benchmark data** for any scorecard result.
- **Resend SMTP in Supabase.** Unlocks a six digit code instead of a magic link, which lets the
  signup wall move back to submit-time. Supabase's built-in email is rate limited and meant for
  testing, so signups will fail quietly under any volume.
- **`/listen` playback**, never once verified by a human. Oldest open item in the project.

---

## Verify before claiming anything is done

```bash
npm test                 # 241 tests
npx tsc --noEmit         # silent
npx eslint .             # silent
npm run build            # clean
npm audit --omit=dev     # 0

node scripts/audit-responsive.mjs http://localhost:3000   # ~5 min, do not skip after layout changes
node scripts/audit-motion.mjs http://localhost:3000
node scripts/audit-enquiry.mjs http://localhost:3000      # needs a server with NO RESEND_API_KEY
```

Then read the live site back. Do not trust a deploy message: `vercel --prod` prints
`"Not authorized"` and succeeds anyway, twice observed.
