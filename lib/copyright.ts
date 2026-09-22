/**
 * Door-2 copyright check: the decision, not the network call.
 *
 * Henry's stance (handover `docs/HANDOVER-v3-2026-09-22.md` section H, 22 Sep): a fan cannot
 * make a version of a commercial recording they do not own. Before a Door-2 job is queued, the
 * vocal and/or instrumental is fingerprinted against a commercial-recognition provider, and a
 * confident match refuses the submission outright.
 *
 * This file is split deliberately into a part that exists today (the pure decision, tested
 * without a network) and a part that does not (`checkAudio`, the provider call, described in the
 * TODO below but not written). Henry has no ACRCloud trial as of 22 Sep, so there is no key to
 * hold, no request to shape, and nothing to mock convincingly: writing a network client now would
 * mean guessing at a response shape and then re-doing it once the trial exists. The decision
 * logic below does not have that problem, because it only needs a result shape, not a real
 * provider, so it is built and tested now against the shape `docs/bots/v3/copyright-research.md`
 * recorded from both providers' public documentation.
 *
 * Read the research doc for the provider comparison and the reasoning behind the numbers below.
 * The short version: ACRCloud primary (returns a 0-100 `score` on every match, matches against a
 * catalog of 150M+ commercial recordings), AudD fallback (public $5/1,000 pricing, simple bearer
 * auth, useful if ACRCloud errors or times out), check both the vocal and the instrumental
 * (either one alone can be a lifted piece of a commercial master), threshold 80.
 */

/** Which stem(s) were sent to the provider for this check. */
export type CopyrightPart = 'vocal' | 'instrumental' | 'both'

/** Which provider produced a given check. Kept narrow on purpose: adding a third provider is a
 * deliberate decision, not something a typo should be able to do. */
export type CopyrightProvider = 'acrcloud' | 'audd'

/**
 * What a provider call resolves to, provider differences already normalised away.
 *
 * `match` is the provider's own "did you find a candidate at all" signal. `confidence` is its
 * 0-100 score for that candidate (ACRCloud calls this `score`; AudD's equivalent field is a
 * higher-tier feature, see the research doc). The two are kept separate rather than collapsed
 * into one boolean, because a provider can find A candidate with low confidence, and "found
 * something, but not sure" is a different fact than "found nothing". The threshold below is
 * what turns "something, with this much confidence" into a business decision.
 *
 * `title` / `artists` / `isrc` are optional because they are only present when `match` is true,
 * and even then a provider does not guarantee every field (ISRC in particular is often missing).
 */
export interface CopyrightCheckResult {
  provider: CopyrightProvider
  match: boolean
  confidence: number
  title?: string
  artists?: string[]
  isrc?: string
  checkedAt: string
  part: CopyrightPart
}

/**
 * The confidence threshold that counts as a commercial match, on the same 0-100 scale ACRCloud
 * returns.
 *
 * Set from the research doc, not from measurement against real submissions, because none exist
 * yet: this is the recommendation to show Henry, and the number to revisit once the ACRCloud
 * trial produces real match data on real Door-2 uploads. ACRCloud's own identify endpoint
 * generally only surfaces a candidate once its internal confidence is already in the 70-100
 * range, since it tends not to return a weak guess at all, so 80 is a deliberate few points
 * above that floor rather than a low bar dressed up as a threshold. Exported as a named constant, not
 * inlined at the call site, so retuning it later is a one-line change with a visible history,
 * and so the number in this file and the number in the research doc are provably the same one.
 */
export const COMMERCIAL_MATCH_THRESHOLD = 80

/**
 * Is this result a commercial match worth refusing the submission over?
 *
 * Pure on purpose, no Supabase, no fetch, nothing that needs mocking, so the business rule can
 * be pinned by a test without touching the network or a provider's real behaviour. Both `match`
 * and `confidence` have to clear the bar: a provider that found nothing (`match: false`) is not
 * a match no matter what stray number sits in `confidence`, and a provider that found something
 * below the threshold is a "maybe" the product treats as a pass, not a block, because the cost of
 * a false block (a paying customer refused for no reason, with no recourse but an email) is worse
 * at this stage than the cost of a false pass (one more thing the takedown process catches later).
 *
 * `confidence` is checked with `>=`, so a result that lands exactly on the threshold blocks.
 * The threshold names the first confidence value the product is no longer willing to let
 * through, not the last one it tolerates.
 */
export function isCommercialMatch(
  result: Pick<CopyrightCheckResult, 'match' | 'confidence'>,
  threshold: number = COMMERCIAL_MATCH_THRESHOLD,
): boolean {
  if (!result.match) return false
  if (!Number.isFinite(result.confidence)) return false
  return result.confidence >= threshold
}

/**
 * TODO (phase 2, once Henry's ACRCloud trial exists): the network client.
 *
 * Not written yet. Writing it now would mean guessing at ACRCloud's real response shape from
 * public docs alone, and re-doing it against the trial anyway. Better to spend that effort once,
 * against the real API. This is the intended shape, so the phase-2 session does not have to
 * re-derive it from the spec:
 *
 *   export async function checkAudio(input: {
 *     bucket: string
 *     path: string          // song_job_assets storage path, e.g. `{user}/{job}/vocal-0.wav`
 *     part: CopyrightPart   // which stem this call is checking
 *   }): Promise<CopyrightCheckResult>
 *
 * Intended behaviour, per the research doc:
 * - Downloads the object with the service-role client (the browser-to-Storage upload means the
 *   server has never held these bytes before this call), and sends roughly a 15-20 second clip
 *   from the middle of the track, not the whole file, per ACRCloud's own guidance that shorter
 *   clips (under 15s) match better and cost less than sending a full song.
 * - Tries ACRCloud first (HMAC-signed multipart POST to the identify endpoint; env
 *   `ACRCLOUD_HOST`, `ACRCLOUD_ACCESS_KEY`, `ACRCLOUD_SECRET`). On a provider error or timeout,
 *   retries once against AudD (`AUDD_API_TOKEN`) as the fallback before giving up on the part.
 * - Normalises whichever provider answered into `CopyrightCheckResult`, mapping ACRCloud's
 *   `metadata.music[0].score` or AudD's confidence field into `confidence`, and setting `match`
 *   from whether the provider returned a candidate at all, not from the threshold (that stays
 *   `isCommercialMatch`'s job, so the raw provider answer is always what gets stored).
 * - Fails LOUD on a missing key in production (`ACRCLOUD_ACCESS_KEY` etc. absent is a
 *   configuration bug, not a runtime condition to degrade around) but fails OPEN on a genuine
 *   provider outage after both providers have been tried: the submission is allowed to proceed,
 *   `copyright_check` is stored with `provider` naming whichever one last answered (or a sentinel
 *   for "both failed"), `match: false`, and a note that lets `/admin` (Bot 4's `crm_issues`, if it
 *   exists by then) surface it for a human to look at. Recommended and justified in the research
 *   doc: at 10-50 submissions/day the volume is low enough that a human review queue is not a
 *   burden, and turning away paying customers over a vendor's downtime is a worse failure mode
 *   than letting a small number of submissions through unchecked for a few hours, given the
 *   takedown process is the backstop either way. This needs Henry's sign-off before it ships,
 *   flagged as an open decision in the research doc, not assumed here.
 * - Is never called from a re-roll: re-rolls reuse the parent job's audio and its
 *   `copyright_check`, unchanged, per `docs/bots/v3/BOT-5-copyright.md`.
 * - Is mocked in every test that exercises the submit-time check. CI never holds a provider key
 *   and never should.
 */
