# Bot B: Door 1 web console (create, track, deliver)

**Paste this to start:** "You are Bot B. Read `docs/bots/door1/README.md` (THE CONTRACT) then this
brief (`docs/bots/door1/BOT-B-door1-console.md`) in `C:\Users\User\CascadeProjects\lyrical-website`.
Work in a new worktree `C:\Users\User\CascadeProjects\wt\door1-console` on branch
`feat/door1-console` off the CURRENT `develop` (Bot A's admin auth is merged). TDD. Open a PR into
`develop`. Do not merge, push develop, deploy, or apply the migration."

## Goal
A Door 1 tab at `/admin/door1` inside the existing admin area: create a Door 1 job, see its status,
download the delivered 24-bit FLAC stems. Management only; craft tools stay on the render PC.

## Build
1. **Migration** `supabase/migrations/007_door1.sql` exactly as in the README contract, appended to
   `supabase/schema.sql`. Update `scripts/verify-schema.ts` if it lists expected columns.
2. **Gate**: every page, action and route handler calls `requireAdmin()` (from Bot A) first.
3. **Create form** (`/admin/door1/new`):
   - Artist: pick a CRM enquiry (prefer `rel_status='signed'`, allow any) which fills
     `primary_artist`; or type an artist with no link.
   - Song title; source + target language from `lib/languages.ts` (codes). Refuse a target that the
     pipeline has no pack for (Japanese today) with a clear message, as Door 2 does.
   - Voice model: free text with a datalist of `pipeline_voice_model` values used on past door1 rows
     (e.g. `Coffey_Anderson`). Empty = zero-shot. The poller fails loud on an unknown name.
   - Lyrics (optional), internal notes, due date.
   - Render knobs: `vocal_denoise` (default on), `restore_mode` (default: cascade when a voice is
     set, else zeroshot; cascade with no voice is refused).
   - Source: upload a full mix (MP3/FLAC/WAV, direct browser upload to `submissions` via a signed
     upload URL, reuse `lib/song-upload.ts` patterns, refuse over 50 MB with "use FLAC or a Qobuz
     link") OR a Qobuz URL (validate the host). Exactly one.
   - Insert the row exactly per the contract. Reuse the Door 2 insert shape; do not invent a second
     contract. Roll back the job if the asset insert fails.
   - Pure zod schema for the form in `lib/door1-schema.ts`, fully unit-tested.
4. **Jobs list** (`/admin/door1`): door1 rows only, newest first: artist, title, languages, voice,
   due date, `pipeline_state`, `pipeline_error` (staff may see it), created/delivered times. A
   re-queue button for failed jobs reusing the existing admin re-queue action.
5. **Job detail / delivery**: per job the three stems (`vocal`, `instrumental`, `mix`) with a download
   via a short-lived signed URL (60 s) from the private `door1` bucket, minted in a route handler
   after `requireAdmin()`. Show "Purged" when `purged_at` is set (masters remain on the OptiPlex).
   Link back to the CRM enquiry.
6. **Isolation from Door 2** (tests for each):
   - `lib/account-data.ts` and every `/studio` job query exclude `delivery_profile='door1'`.
   - `lib/song-job-hook.ts`: door1 rows earn NO email (delivered or rejected).
   - Rating reminder, credits, entitlement, `/listen` never touch door1 rows.
   - The existing admin Work/Songs tab may list door1 rows but labels them "Door 1".

## Watch-outs
- Never pass a function prop from a server component to a client component.
- Signed URLs only, never a public URL; never expose the service key to the browser.
- `song_jobs` column grants: do NOT add door1 columns to the customer grant.
- Admin UI follows the existing `/admin` look (Lyrical brand: Fraunces + Archivo, no gradients).

## Done when
- Tests for the schema, the insert shape (route `door1`, quota null, profile door1), the gate on every
  surface, the signed-URL route, and every Door 2 isolation point.
- `npm test && npm run build` green. PR lists: migration 007 to apply, and the manual proof-run steps.
