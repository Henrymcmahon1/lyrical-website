# Next session

Read `docs/HANDOVER.md` first, all of it. §0, §4d, §4e, §5 and §9 matter most. This file is the
brief for what comes next and assumes you have read that one.

---

## Where things stand, 2026-08-11

Everything in the previous brief was built, verified and **shipped to production**. Six commits
went out in one push, including the three portal commits that had been held back.

| | |
|---|---|
| `/queue` | Live. Songs and Enquiries. Accept, Start work, Mark delivered, Reject |
| Lifecycle emails | Live. Welcome, Accepted, Delivered. Rejection is silent by decision |
| Home | Studio-first. The enquiry moved to `/contact` |
| Scorecard | Live in the studio. Method only, no numbers |
| Tests | 306, `tsc` silent, `eslint` silent, `npm audit` 0 |
| Audits | responsive, motion and enquiry all pass, including `/contact` |
| Read back live | Yes, every route, not trusted from a deploy message |

⚠️ **`git push origin main` DEPLOYS TO PRODUCTION.** There is no push-without-shipping here.
Work that must stay dark goes on a branch.

⚠️ **THE REPO IS PUBLIC.** Never put a credential in a file, even for one command.

---

## The one thing nobody has done

**Click through `/queue` on production, signed in, and move a real job.**

Everything about it is proven except the thing only a human with the password can do. The
session, the transitions, the guards and the render are unit tested; the unauthenticated
surface was read back live. But no person has yet pressed Accept and watched the email arrive.

The full loop to walk, once:

1. Sign in at `/queue`. **The cookie path changed from `/leads` to `/queue`, so the old session
   is not carried over.** Same `ADMIN_PASSWORD`.
2. Open the Songs tab. The one real submission from 2026-08-09 should be there.
3. Click a file. It should open through `/queue/audio` and play. **This is the first time a
   signed URL from the `submissions` bucket has been exercised by a human.**
4. Press Accept. Check the acceptance email arrives and reads well, and that the studio's status
   rail moves.
5. Press Mark delivered. Same check.

If step 3 fails, look at `media-src` in `next.config.ts` before anything else: a cross-origin
media move broke `/listen` exactly this way and did it silently.

---

## The work, in order

### 1. Delivery has no player, and the email admits it

Henry's call on 2026-08-11 was status plus email for now, with the audio going across by hand.
So `jobDeliveredText` says the files are coming separately, and a test stops a later session
adding a link before there is somewhere to send it.

The real version needs a `song_job_deliveries` table, a private bucket, staff upload from
`/queue`, and playback in the studio behind short-lived signed URLs. **Do not put a signed URL
in the email** whatever else changes: `tests/song-job-email.test.ts` enforces that across every
template and it should stay that way.

### 2. `/listen` playback, still never verified by a human

The oldest open item in the project. The in-app browser blocks signed URLs by its own safety
filter, so it cannot be checked from an agent session. **Ask Henry to load it in his own Chrome
and press play.**

### 3. The last "hear" without a player

`components/sections/S03Wheels.tsx` still carries the eyebrow "Hear it" above the language
wheel on the home page. It was left alone because that section delivers what it offers, a
request for examples by email. It is the last one, and it goes when audio publishes.

### 4. `SongsTab` is capped at 1000 accounts

`auth.admin.listUsers({ perPage: 1000 })` resolves submitter addresses. Past that the tail
renders "unknown sender", which is the right direction to fail in, but it wants paging or a
denormalised column on `song_jobs`.

---

## Locked, do not quietly change

| Decision | |
|---|---|
| Brand renders **`lyrical`**, lowercase, everywhere | Tests pin it, including email subjects |
| Tagline unchanged | "Every song. Any language. Same soul." |
| **All 56 language pairs carry the 48 hours**, counted from acceptance | Changed 2026-08-11 on Henry's instruction after the trade-off was put to him twice. See HANDOVER §4 |
| No other claim about speed anywhere | Henry rejected "instantly" as untrue |
| "No upfront cost" only. **Do not mention the royalty model** | The standalone terms section was removed 2026-08-11. The claim now lives in the hero's third paragraph, step two of `S05How`, the closing `S10Start` line, and the confirmation and welcome emails. Change them together |
| **Rejection sends no email.** | Henry's call. `tests/job-transitions.test.ts` pins it so adding one has to be deliberate |
| The studio is the primary conversion, `/contact` is secondary | Do not put the enquiry form back on the home page |
| Scorecard shows **no numbers** until benchmark data arrives | Describing a measurement that does not run is checkable, and worse than silence |
| Open signup, manual approval before anything processes | Controls rights exposure and compute spend together |
| No delete for a song job | A submission is a record of what somebody asserted and when |

---

## Blocked on Henry

- **Benchmark data** for any scorecard result. Until it lands, the method may be described and
  no result may be claimed.
- **Resend SMTP in Supabase.** Unlocks a six digit code instead of a magic link. Supabase's
  built-in email is rate limited and meant for testing, so signups will fail quietly under any
  volume. This is the highest-risk unfixed thing in the funnel, because it fails silently and
  the failure is a lost customer.
- **`/listen` playback**, above.

---

## Verify before claiming anything is done

```bash
npm test                 # 306 tests
npx tsc --noEmit         # silent
npx eslint .             # silent
npm run build            # clean
npm audit --omit=dev     # 0

node scripts/audit-responsive.mjs http://localhost:3000   # ~5 min, do not skip after layout changes
node scripts/audit-motion.mjs http://localhost:3000
node scripts/audit-enquiry.mjs http://localhost:3000      # needs a server with NO RESEND_API_KEY
```

`audit-enquiry` drives `/contact`, through a named `ROUTE` constant. `audit-responsive` covers
`/contact` too. If the form moves again, move both with it.

Then read the live site back. Do not trust a deploy message: `vercel --prod` prints
`"Not authorized"` and succeeds anyway, twice observed.
