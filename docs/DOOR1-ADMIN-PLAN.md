# Door 1 admin dashboard on omega: next-session plan

**Written 2026-09-24 for the NEXT session.** Decision made with Henry: put the Door 1 (signed
artist) control surface on the web as a SEPARATE, admin-only dashboard on omega
(lyrical-studio-omega.vercel.app), alongside but distinct from the Door 2 customer studio, so both
dashboards live on the web and can be developed the same way. The pipeline compute stays on the
render machine; the web is only a control surface.

## Locked decisions (Henry, 24 Sep)
- **Scope: management console only.** Create Door 1 jobs, track status, deliver the WAV stems, and
  the CRM. The craft tools (stage-by-stage runs, live logs, waveform A/B, render knobs, voice-model
  training) STAY on the local dashboard on the render PC. Do not rebuild those on the web.
- **Separate from Door 2.** Door 2 = the customer studio at `/studio` (customer auth). Door 1 = an
  admin-only surface (the existing `/admin` area, or a clearly separate admin route). They must not
  blur together.
- **Admin-only access.** Only the admin account (info@lyricalglobal.com) can reach it.
- **Renderer: the OptiPlex render PC (192.168.86.31), as now.** SynthV's GPU is there and Door 2
  already renders on it via the poller. The web dashboard just queues jobs to it through Supabase,
  exactly the Door 2 pattern. The AWS VM stays a cold standby; not the renderer for this.
- **Proper admin auth, not the shared password.** Door 1 holds unwatermarked commercial masters and
  client work. Replace the single `ADMIN_PASSWORD` gate with a real identity: Supabase auth
  restricted to an allowlist (info@lyricalglobal.com), ideally with 2FA, before any Door 1 master is
  reachable on a public URL.

## Why this is only moderate effort
The proven plumbing already exists: the Supabase `song_jobs` contract, the poller on the OptiPlex,
`delivery_profile='door1'`, `dashboard/service/export_door1.py` (24-bit vocal/instrumental/mix WAV
stems), and the `/admin` scaffold (People, Money, Work, Voice, Relationships, Issues, re-queue).
The new work is auth + a create-job form + the door1 render-and-deliver path.

## Build plan (next session)

### 1. Admin auth upgrade (do this FIRST, it gates everything)
- Replace the `ADMIN_PASSWORD` cookie gate (`lib/admin-auth.ts` / `lib/admin-session.ts`) with a
  real admin identity: Supabase auth, access allowed only for an allowlist of admin emails
  (info@lyricalglobal.com to start), enforced server-side on every `/admin` route and every Door 1
  action. Add 2FA (Supabase MFA) if feasible this round.
- This also hardens the existing `/admin` CRM, which is a bonus.
- Keep the customer `/studio` auth exactly as it is; this is a separate admin identity.

### 2. Door 1 job creation (website)
- A "New Door 1 job" form in the admin dashboard: artist / act, song title(s), source and target
  language(s), the voice model to use, and any door1 settings the job contract can carry.
- On submit, write a `song_jobs` row with `delivery_profile='door1'`, `route` set for the internal
  path, `pipeline_state='queued'`, admin as the actor. No watermark, no personal-use licence (that
  is Door 2). Reuse the existing insert path, do not invent a second contract.
- Migration if needed: a small `door1_*` column set on `song_jobs` OR reuse existing fields; decide
  when the form fields are settled. Apply via the Supabase SQL editor in Henry's Chrome as usual.

### 3. Door 1 render + deliver (lyrical-studio poller on the OptiPlex)
- Extend the poller so a `delivery_profile='door1'` job renders at full quality with NO watermark,
  then runs `export_door1_stems` and uploads the 24-bit WAV stems (vocal, instrumental, og-matched
  mix) to a PRIVATE Supabase Storage bucket (propose a dedicated `door1` bucket), writing
  `song_job_deliveries` rows (kind = vocal/instrumental/mix).
- The pipeline already produces these from Stage 6; this is wiring the poller to do the export +
  upload for a web-created job, not new ML.

### 4. Door 1 delivery view (website)
- In the admin dashboard, a Door 1 deliveries view: per job, download each WAV stem via a
  short-lived signed URL (same private-bucket pattern as `/listen` and the Coffey files). Tie jobs to
  the relationship/CRM (which `/admin` already has).

## Watch-outs / open items
- **Storage cost.** 24-bit WAV stems are large and Supabase is already near the free 1 GB. Plan a
  retention policy for the door1 bucket (mirror Door 2: deliver, then purge after N days), or a
  different delivery channel for the masters. Decide before shipping.
- **Do not weaken Door 2 or lyricalglobal.com.** Never touch `main` of lyrical-website or the live
  site. The customer studio auth is unchanged.
- **Reverses the v2 decision** that the Door 1 dashboard "stays on the render PC" (spec decision 2).
  That still holds for the CRAFT tools; only the management surface moves to the web. Note it in the
  spec decision log.
- **Suggested parallel bots next session:** (A) admin auth upgrade; (B) Door 1 create + deliver UI
  on the website; (C) poller door1 render+export+upload on lyrical-studio. A depends on nothing; B
  and C share the contract; sequence auth first, then B and C in parallel, then a proof run
  (create a Door 1 job on omega -> OptiPlex renders -> WAV stems delivered and downloadable).

## Proof run (definition of done)
Admin signs in (allowlisted identity) -> creates a Door 1 job on omega -> the OptiPlex poller renders
it full quality, no watermark, exports 24-bit stems, uploads them -> admin downloads vocal /
instrumental / mix from the admin dashboard. Door 2 and the customer studio are untouched.
