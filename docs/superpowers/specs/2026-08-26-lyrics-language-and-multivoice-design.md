# Lyrics language check + multiple voices — design

**Date:** 2026-08-26 · Approved by Henry. Ships to `main` when tests + audits pass.

Two small features on the song submission flow.

---

## 1. Lyrics language check (warn, never block)

**Problem.** Customers sometimes paste the *translated* lyrics (the target language) instead of
the **original** words the song is actually sung in. The pipeline builds the new version from the
original, so the translation is the wrong input. Today `lib/lyrics.ts` does no language check at
all, on purpose, to avoid wrongly refusing CJK scripts.

**Behaviour.** Advisory only. A warning appears under the lyrics box, like the existing
link/line-break warnings in `describeLyricsWarning`. It never blocks submit, and JS-off visitors
simply do not see it.

**Detection.** New `lib/lyrics-language.ts`.

- **Script first, no dependency:** Hangul → Korean, Kana → Japanese, Han (no kana/hangul) →
  Chinese. Unicode-range regexes.
- **Latin languages via `franc-min`:** EN/ES/PT/FR/DE cannot be told apart by script, so a small
  detector library resolves them. `franc-min` is lazy-loaded (`await import`) in the browser only,
  so it stays off the marketing pages and the server bundle. Confirmed `npm audit --omit=dev` = 0.
- **CJK caveat:** ZH and 粵語 are both Han and cannot be told apart from text, so both accept Han
  lyrics without warning. A Japanese sheet that is kanji-heavy can read as Han, so source **JA**
  also accepts Han (avoids a false alarm). Everything else warns on a confident mismatch.
- **Short text:** under ~12 letters on the Latin path → no guess, no warning.

**Warning copy.** Names the clash and pushes the point that we want the original:

> These lyrics look like English. You told us the song is recorded in Spanish. Paste the original
> Spanish words, exactly as they are sung, not a translation: the new version is built from the
> original.

If the detected language equals the **target** language (the classic "pasted the translation"),
the copy sharpens to say so directly.

**Where.** `components/SongSubmitForm.tsx` runs detection (debounced) when the lyrics, source, or
target change, and renders the warning in the existing advisory area.

**Pure/testable split.** `detectByScript(text)`, `classifyLyrics(text, francCode)`, and
`lyricsLanguageWarning({ detected, source, target })` are pure and unit-tested without importing
franc. The async `detectLyrics(text)` wrapper is the only part that touches `franc-min`.

---

## 2. Multiple voices (built sensibly)

**Already there.** The form has "Featured artists" (name + isolated vocal file per singer), stored
as `vocal` assets with `artist_name`. The one real gap for "stored well" is **which part each
voice sings**.

**Changes.**

- Add an optional **Part** field per additional voice (e.g. *Verse 2*, *Chorus*, *Ad-libs*). The
  lead vocal stays identified by the primary artist name; its part is implicitly lead.
- Relabel "Featured artists" → **"Other voices on this track"** (clearer for any multi-singer
  track, not only features).
- Store a new nullable `part` column on `song_job_assets`. That table has **no** column-grant lock
  (unlike `song_jobs`/`voice_models`), so it is a one-line idempotent migration, no grant rewrite.
- `/queue` (`SongsTab`) shows each file's part next to its name and artist, so whoever accepts sees
  whose voice is which.

**Non-goal (deliberate).** Linking a song's singers to trained voice models. Bigger, speculative
now. Revisit if asked.

**Manual step for Henry.** Paste into the Supabase SQL editor before the queue change relies on it:

```sql
alter table public.song_job_assets add column if not exists part text;
```

Idempotent and non-destructive. Also added to `supabase/schema.sql`.

---

## Files touched

| File | Change |
|---|---|
| `lib/lyrics-language.ts` | New. Detection + warning (pure) + lazy franc wrapper |
| `lib/song-job-schema.ts` | `part` on `AssetSchema` (optional, trimmed, max 60) |
| `components/SongSubmitForm.tsx` | Language warning; Part inputs; relabel |
| `app/studio/submit-actions.ts` | Insert `part` |
| `app/queue/SongsTab.tsx` | Select + display `part` |
| `supabase/schema.sql` | Add `part` column (idempotent) |
| `tests/lyrics-language.test.ts` | New. Detection + warning cases |
| `tests/song-job-schema.test.ts` | `part` accepted/trimmed/over-length |

## Verify

`npm test`, `npx tsc --noEmit`, `npx eslint .`, `npm run build`, `npm audit --omit=dev` (0),
`node scripts/audit-responsive.mjs http://localhost:3000` (layout changed on the form). Then read
the live site back after deploy.
