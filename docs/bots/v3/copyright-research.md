# Door 2 copyright detection: provider research

**Written 22 Sep 2026, Bot 5 (copyright), phase 1.** No ACRCloud trial exists yet, so nothing
here comes from a live call against either provider. Everything below is from each provider's
public documentation and the AudD-vs-ACRCloud comparison article named in the handover. Treat the
numbers marked "public docs, not verified against a live account" as the best available estimate,
not a measured fact. This doc is the decision aid for Henry's provider + threshold call before any
phase-2 code touches the network (`lib/copyright.ts` `checkAudio`, not built yet). See
`docs/HANDOVER-v3-2026-09-22.md` section H and `docs/bots/v3/BOT-5-copyright.md` for scope.

## Recommendation, up front

| | |
|---|---|
| **Primary provider** | ACRCloud |
| **Fallback provider** | AudD |
| **Confidence threshold** | 80 (of ACRCloud's 0-100 `score`) |
| **What to check** | Both the vocal and the instrumental stem |
| **Audio sent** | ~15-20s clip from the middle of each stem, not the full file |
| **Cost at 10-50 submissions/day** | Low single-digit dollars/month on AudD; ACRCloud's real number needs the trial console (see "Open decisions") |
| **On provider outage** | Fail open (let the submission through, log it for review), not fail closed |

## 1. ACRCloud

**Product:** the Music Recognition identify API, matched against ACRCloud's own catalog of
150M+ tracks with daily updates, plus streaming-platform cross-references (Spotify, Apple Music,
Deezer) and standard identifiers (ISRC, UPC). This is their general-purpose "what recording is
this audio" product, the same category AudD is in, as opposed to their separate broadcast
monitoring or custom-content products.

**Request shape** (public docs, not verified against a live account):
- `POST https://identify-<region>.acrcloud.com/v1/identify`, `multipart/form-data`.
- Fields: `sample` (the audio file), `access_key`, `data_type` (`audio` or `fingerprint`),
  `signature_version` (`1`), `signature` (HMAC-SHA1 over a fixed string built from the method,
  path, access key, data type, signature version and timestamp), `timestamp`, `sample_bytes`.
  Auth is a signed request, not a bearer token: it needs the access key AND a secret held
  server-side to compute the signature, so this cannot run client-side.
- Audio: mp3, wav, wma, amr, ogg, ape, aac, spx, m4a, mp4, FLAC and others. File under 5 MB.
  Their own guidance: clips under 15 seconds are "generally better" than longer ones, and they
  recommend sending a fingerprint rather than raw audio to cut bandwidth, which implies a local
  fingerprinting step is available in their SDKs (not evaluated here, out of scope for phase 1).

**What a match looks like:**
```json
{
  "metadata": {
    "music": [{
      "title": "string",
      "artists": [{ "name": "string" }],
      "album": { "name": "string" },
      "acrid": "string",
      "score": 100,
      "duration_ms": 295000,
      "external_ids": { "isrc": "string", "iswc": "string", "upc": "string" },
      "release_date": "YYYY-MM-DD"
    }]
  },
  "status": { "code": 0, "msg": "Success" }
}
```
`score` is 0-100 and is present on every returned match. In practice the endpoint tends not to
return a weak guess at all: results generally surface once ACRCloud's own internal confidence is
already in the 70-100 range, which is the basis for the threshold recommendation below.

**Pricing:** 14-day free trial, no card required, full API access. Beyond the trial, ACRCloud's
per-request price is not public: their pricing page requires a console login. **First task once
Henry's trial exists: read the real number off the console and update this section**, flagged as
an open decision below.

**Latency:** not stated in the public docs consulted. Not measurable until the trial exists.

## 2. AudD

**Product:** `/recognize`, matched against AudD's commercial catalog, positioned as a
music-recognition specialist (11 SDKs, real-time stream monitoring) rather than ACRCloud's
broader "identify anything, including speech and broadcast" scope.

**Request shape:**
- `api_token` (single bearer-style token, no request signing, simpler to hold than ACRCloud's
  key+secret pair).
- Audio supplied as `url` (AudD downloads it) or `file` (multipart upload); base64 is documented
  but discouraged.
- `return`: comma-separated list of extra metadata blocks to include (Apple Music, Spotify,
  Deezer, MusicBrainz).
- `market`: country code for the streaming-link results, default US.
- Standard endpoint: files up to 10 MB. Longer or multi-song audio needs the separate enterprise
  endpoint, billed per 12 seconds of audio processed rather than per request.

**Response shape (standard, `return` unset):**
```json
{
  "status": "success",
  "result": {
    "artist": "string",
    "title": "string",
    "album": "string",
    "release_date": "YYYY-MM-DD",
    "label": "string",
    "timecode": "MM:SS",
    "song_link": "https://lis.tn/..."
  }
}
```
No `score` field on the standard response. **This is a meaningful difference from ACRCloud, not
a documentation gap**: AudD's own docs and support material state that a numeric confidence score
is a Startup-plan-or-higher feature, not part of the base response. ISRC is not in the core
fields either; it can come through the `apple_music` metadata block if requested. On no match, the
`result` is `null` or an empty array, i.e. AudD's baseline signal is closer to a binary
match/no-match than a graded confidence.

**Pricing (public):** 300 requests/month free, then $5 per 1,000 requests, with volume discounts;
custom terms above 500,000 requests/month. This is the number the handover already names, and it
is the one piece of pricing here that does not need the trial to confirm.

**Latency:** not stated in the public docs consulted.

## 3. The comparison article (audd.io/resources/articles/audd-vs-acrcloud)

Read as AudD's own comparison, so its framing favours AudD, but the structural facts line up with
the two providers' own docs above and are useful for the auth/plan differences in particular:
- Pricing: AudD publishes exact numbers; ACRCloud's "changes and varies by plan and region" and
  needs their console.
- Auth: AudD is a single token; ACRCloud is HMAC-signed with a key and secret. ACRCloud's is more
  work to implement correctly (a signature string, a timestamp, a secret that must never reach
  the client) but is not a security downgrade, just more moving parts server-side.
- Metadata: AudD's core fields are universal; premium identifiers (ISRC, UPC) sit behind a
  Startup+ plan. ACRCloud includes `external_ids` and `score` on the base identify response.
- Scope: ACRCloud also does non-music recognition (broadcast, speech) and compliance-oriented
  filtering; AudD stays music-focused with more SDKs and a real-time stream-monitoring product.
- The article explicitly declines to publish accuracy benchmarks and recommends testing against
  your own catalog and audio conditions, which this phase 1 doc cannot do without the trial.

## 4. The recommendation, with reasoning

**Primary: ACRCloud.** Its base identify response already carries a graded `score` and
`external_ids.isrc`, which AudD only offers at a higher, unconfirmed-cost plan. A block-or-pass
decision that can only see "matched" or "did not match" is a worse product decision than one that
can see how confident the match was, and Door 2 refusing a paying customer's submission is exactly
the kind of decision that benefits from a graded signal rather than a binary one. The 150M-track
catalog and daily updates are also the larger of the two as documented.

**Fallback: AudD.** Its $5/1,000 public pricing, single-token auth, and independent catalog make
it a reasonable second opinion when ACRCloud errors or times out, without taking on a second HMAC
implementation. Not proposed as primary because of the confidence-score gap above.

**Confidence threshold: 80.** ACRCloud's own endpoint tends not to surface a weak candidate at
all, appearing to filter internally somewhere in the 70-100 range before returning anything. 80 is
a deliberate few points above that apparent floor: high enough that a borderline "maybe" is not
enough to refuse someone, low enough that an actual match (which the docs suggest usually scores
close to 100) is caught well before its score has any room to drift down. This is a documentation-
based starting point, not a tuned number: it needs to be checked against real matches once the
trial exists, and `lib/copyright.ts` exports it as `COMMERCIAL_MATCH_THRESHOLD` specifically so
retuning it later is a one-line change with a visible history rather than a hunt through call
sites.

**What to check: both the vocal and the instrumental.** This matters more than it first looks,
because of a distinction worth being explicit with Henry about: audio fingerprinting identifies
the specific master recording that was fingerprinted into the provider's database, not the
composition or melody underneath it. A fan who genuinely performs their own cover of somebody
else's song, in their own voice, over their own instrumental, will usually NOT trigger a match on
either provider, because that audio was never released and is not in the database. What this check
reliably catches is a submission built from a piece of an actual commercial release: an
instrumental lifted from a released track (a common thing to find and upload, since instrumentals
of hits are widely available), or a vocal stem extracted or ripped from a released recording.
Checking only one stem would miss the other case, so both are checked. The composition-level cover
question is a real gap and is addressed by policy (the rights warranty already in `lib/terms.ts`,
plus the takedown process), not by this automatic check. State this plainly to Henry: this is a
detector for "this audio came from an existing commercial release", not a detector for "this song
belongs to someone else."

**How much audio: ~15-20 seconds from the middle of the track.** ACRCloud's own guidance favours
clips under 15 seconds; sending the full file costs more (both in request size against ACRCloud's
5 MB / 10 MB limits and, on a per-request or per-12-second billing model, in money) without a
documented accuracy benefit. The middle of the track avoids a quiet or silent intro/outro, which
is a more useful sample than the first 15 seconds of the file as uploaded.

**Cost per submission at 10-50/day.** Two stems checked per submission (vocal + instrumental),
so 20-100 provider requests/day, 600-3,000/month.
- AudD at that volume: 300 free, then $5/1,000. At 600/month that is (600-300) x $0.005 ≈ $1.50.
  At 3,000/month, (3,000-300) x $0.005 = $13.50. Call it **$1.50-$14/month** on AudD alone.
- ACRCloud: no public number. **This is the first thing to read off the trial console.** Whatever
  it is, at this volume (600-3,000 requests/month) it is very unlikely to be the deciding factor
  either way; the provider choice above is driven by the confidence-score gap, not by price.

## 5. Failure and edge cases

**A fan's own recording.** Passes automatically: it is not in either provider's database, so the
check returns no match (or a match below threshold), and the submission proceeds. No special
handling needed.

**A cover the fan performed themselves.** A grey area, and explicitly not something this automatic
check resolves, for the reason in section 4: fingerprinting matches audio, not composition, so a
genuine cover generally will not trigger a match. The existing rights warranty already covers this
("you either own all rights... or you have obtained all necessary licenses, consents, and
permissions") and remains the operative control here. Recommendation: do not try to make the
automatic check catch this. State the policy plainly on the copyright policy page instead (done:
`app/copyright-policy/page.tsx`, "What this does and does not catch").

**An instrumental that matches a known backing track.** Caught by checking the instrumental stem
explicitly (section 4). This is, if anything, the case the check is best suited to.

**Provider timeout or outage.** Recommendation: **fail open**, not fail closed. Reasoning:
- At 10-50 submissions/day, the absolute number of submissions affected by even several hours of
  provider downtime is small, and the studio's own turnaround promise ("usually within 1 hour, up
  to 3 hours at busy times") is already a commitment the business has made; a fail-closed check
  would mean a third-party vendor's outage can single-handedly break that promise for every
  customer, not just the ones who would have failed the check anyway.
- Fail-closed also has no natural recovery path for the customer: a submission that is refused
  because the checker itself was unreachable looks, from the customer's side, identical to being
  refused for a copyright match, which is a worse experience than a delayed delivery.
- Fail-open is not "skip the check silently." The intended behaviour (written as a TODO in
  `lib/copyright.ts`, not yet built pending the trial): store the failed attempt on
  `copyright_check` with `match: false` and a marker for "provider error", and surface it to a
  human review queue (`/admin`, Bot 4's `crm_issues` if it exists by then) so a person, not just a
  machine, has seen every submission that shipped without a real check. The takedown process is
  the backstop either way, exactly as it already is for the composition/cover grey area above.
- This trades a small amount of exposure during a vendor outage for not breaking the product on
  a dependency the business does not control. It is presented here as a recommendation for
  Henry to confirm, not a decision already made; `lib/copyright.ts` documents the intended
  behaviour but does not implement it, since no network client exists yet to fail.

**The false-positive path.** A submission wrongly refused is not a dead end: the customer is told
(in the refusal message, and on the copyright policy page) to email support with what they
submitted and when, and a person reviews the specific result and can clear the account to
resubmit, rather than the automatic answer being the final word. Written up on
`app/copyright-policy/page.tsx`, "If you think a submission was wrongly refused."

## 6. Open decisions for Henry, before phase 2 code touches the network

1. **ACRCloud's real per-request price**, read off the trial console once it exists. Needed to
   confirm the cost estimate in section 4 and to decide whether AudD should actually be primary
   on cost grounds once a real number is known.
2. **Confirm the confidence threshold (80)** once the trial produces real match data on real
   Door-2-shaped audio (short clips, possibly non-English, sung rather than studio-mastered in
   some cases). The number here is a documentation-based estimate, not a tuned one.
3. **Confirm fail-open on provider outage.** Recommended and justified in section 5; this is a
   product/legal risk call as much as an engineering one, and Henry should sign off on it
   explicitly before `checkAudio`'s error path is built.
4. **The repeat-offender count.** The copyright policy page (`app/copyright-policy/page.tsx`)
   states the rule ("more than one confirmed match is a pattern") without naming a specific number
   of infractions, because none has been decided. Henry should set the number; the page and the
   eventual enforcement logic both need it.
5. **Whether a confirmed rights-holder takedown should also count toward the repeat-offender
   rule**, or only automatic-check matches. Not addressed here; worth deciding alongside #4.

## Sources

- https://www.acrcloud.com/music-recognition/
- https://docs.acrcloud.com/reference/identification-api
- https://docs.acrcloud.com/reference/identification-api/identification-api.md
- https://audd.io/resources/articles/audd-vs-acrcloud.html
- https://docs.audd.io/
