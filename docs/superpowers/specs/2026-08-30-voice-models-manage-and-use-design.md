# Voice models: build, manage, and use on a song

**Date:** 2026-08-30 · Approved by Henry ("continue"). Ships to `main`.

The clean-vocal upload flow already exists (`/studio/voices`, `/studio/voices/new`,
`VoiceUploadForm`, `lib/voice-training.ts`). This adds discovery, management, song-linking, and a
storage meter around it.

## Interpretations to confirm on review
- **Manager = full**: add takes + rename + retire, on top of the existing view + status.
- **Retire, not hard-delete**: retiring a voice purges its training files (frees storage) and marks
  it `retired`, but keeps the `voice_models` row and its `consent_warranted_at`, which is the
  record that backs "we had permission." Hard-delete would erase that.

---

## 1. Entry points on `/studio`

Replace the single "Voices we have learned" underline with two clear actions under the song CTA:
- **Build a voice model** → `/studio/voices/new` (heading/CTA renamed from "Teach us a voice" to
  "Build a voice model" / "Build a new voice model")
- **Voice models** (the manager) → `/studio/voices`

Presented as a secondary button + link, not competing with the primary "Make ... multilingual"
ember button. Reuse the `flex w-fit` stacking fixed earlier so nothing collides.

## 2. Use a voice when submitting a song

- `song_jobs` gains a nullable `voice_id uuid references voice_models(id)`.
- The song form (`/studio/new`) shows a **"Which voice sings this?"** `<select>` listing the
  signed-in user's voices (artist name + status). Optional: a song can be sent before a voice
  exists. If the user has **no** voices, the control is replaced by a prompt linking to
  **Build a voice model**.
- `submitSongJob` stores `voice_id` after re-checking (via the user's own session/RLS) that the
  voice belongs to the caller. A forged id from another user must not attach.
- `/queue` (`SongsTab`) shows the attached voice's artist name + status.

### Migration (Henry runs, or I run in his Chrome)
`song_jobs` carries a **column-level SELECT grant**, so a new column is invisible to customers
until added to it. Both halves, in order:
```sql
alter table public.song_jobs add column if not exists voice_id uuid references public.voice_models (id);
revoke select on public.song_jobs from anon, authenticated;
grant select (
  id, created_at, user_id, title, primary_artist,
  source_language, target_language, notes, status,
  rights_warranted_at, approved_at, delivered_at, lyrics, voice_id
) on public.song_jobs to anon, authenticated;
```
`schema.sql` is updated to match so a fresh run is correct.

## 3. Voice model manager (`/studio/voices`)

Each voice in the list gains actions, all going through **server actions that verify ownership**
(the schema deliberately has no customer update/delete policy; staff-style service-role actions
scoped to `auth.uid()` are the safe shape, matching `/queue`).

- **Add more takes** — reuse the upload flow against an existing `voiceId`: create no new
  `voice_models` row, just append `voice_samples`. `VoiceUploadForm` takes an optional
  `existingVoiceId` + `existingArtist`; when present it skips the artist field and the model-row
  insert. Blocked once the voice is `training`/`ready`/`retired` (nothing to add to).
- **Rename / edit** — update `artist_name` and `notes`. A short inline form.
- **Retire** — confirm step, then: delete every object under `{user}/{voiceId}/` in the
  `voice-training` bucket, delete the `voice_samples` rows, set `status = 'retired'`. The
  `voice_models` row and `consent_warranted_at` stay. `'retired'` is a new `VoiceStatus` value;
  `status` is a free `text` column so no DB migration is needed for it. `/studio/voices` shows a
  retired voice greyed with "Retired. Training audio removed."

A retired voice is excluded from the song-form selector.

## 4. Storage usage meter (`/queue`)

The 1GB free-tier cap is a **single global project quota**, not per customer, so the meter lives in
the staff `/queue` (voices tab), not the customer studio. Computed by summing the stored byte
counts (`voice_samples.bytes` + `song_job_assets.bytes`) rather than calling the storage API, so it
is one cheap query. Renders: **"820 MB of 1 GB used · about N more artists at 30 min mono FLAC."**
Turns ember past ~85%.

Reference numbers (mono FLAC, computed): 48kHz/24-bit ≈ 4.8 MB/min → ~210 min / ~7 artists in 1GB;
per-file 50MB cap ≈ 11 min. These already live in `lib/voice-training.ts`; the meter reuses them.

---

## Files

| File | Change |
|---|---|
| `app/studio/page.tsx` | Entry points: Build a voice model + Voice models |
| `app/studio/voices/page.tsx` | Manager: add-takes / rename / retire controls per voice; exclude retired from counts |
| `app/studio/voices/actions.ts` | New. `renameVoice`, `retireVoice` server actions (ownership-checked) |
| `components/VoiceUploadForm.tsx` | Optional `existingVoiceId`/`existingArtist` for add-takes |
| `app/studio/voices/new/page.tsx` | Rename copy to "Build a voice model" |
| `lib/voice-schema.ts` | `VoiceStatus` gains `retired`; add-takes submit shape |
| `lib/voice-training.ts` | `storageSummary(bytes)` helper for the meter (artists-left math) |
| `lib/song-job-schema.ts` | Optional `voiceId` on the song submit schema |
| `components/SongSubmitForm.tsx` | "Which voice sings this?" selector or build-one prompt |
| `app/studio/new/page.tsx` | Fetch the user's voices, pass to the form |
| `app/studio/submit-actions.ts` | Store `voice_id`, re-checked for ownership |
| `app/queue/SongsTab.tsx` | Show attached voice; storage meter |
| `app/queue/VoicesTab.tsx` | Storage meter (staff) |
| `supabase/schema.sql` | `song_jobs.voice_id` + grant rewrite (idempotent) |
| `tests/*` | voice-schema retired/add-takes, storageSummary, song voiceId, ownership checks |

## Build order (phased, verify each)
1. Entry points + rename (no migration) — shippable alone.
2. Manager actions (rename/retire/add-takes) — no `song_jobs` migration; retire touches storage.
3. Song ↔ voice link — needs the `voice_id` migration run **before** deploy.
4. Storage meter.

## Verify
`npm test`, `npx tsc --noEmit`, `npx eslint .`, `npm run build`, `npm audit --omit=dev` (0). Read
the gated pages back in Henry's signed-in Chrome after deploy (they can't be seen from an agent
session).
