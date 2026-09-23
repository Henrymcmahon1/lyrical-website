# Bot C: poller Door 1 render, export, upload, purge (lyrical-studio)

**Paste this to start:** "You are Bot C. Read `C:\Users\User\CascadeProjects\lyrical-website\docs\bots\door1\README.md`
(THE CONTRACT) then this brief. Work in `C:\Users\User\CascadeProjects\lyrical-studio` in a new
worktree `C:\Users\User\CascadeProjects\wt\door1-poller` on branch `feat/door1-poller` off `main`.
TDD with fakes (never load the real pipeline or hit Supabase in tests). Open a PR into `main`. Do not
merge, push main, or touch the OptiPlex."

## Goal
The OptiPlex poller renders a `route='door1'` job at full quality with no watermark, exports the
24-bit stems, uploads them as 24-bit FLAC to the private `door1` bucket, records deliveries, and
purges them after 7 days. Wiring only, no new ML.

## Today
- `dashboard/service/website/poller.py`: claim, download, map, `create_song`, track, `_deliver`.
  `_deliver` raises for any `delivery_profile != 'door2'` ("Door 1 is delivered by hand").
- `models.py` (`WebsiteJob.from_row`), `mapper.py` (`to_song_request`, BYO only), `client.py`
  (claim query, `upload_delivery`, `insert_delivery`, `mark_delivered`, `fail_job` with credit refund),
  `media.py` (watermark + MP3), `dashboard/service/export_door1.py` (`export_door1_stems`, PCM_24 WAV).
- `SongRequest` in `dashboard/service/schemas.py` supports `input_mode='known'` with `qobuz_url` or
  `source_path`, `restore_mode`, and `advanced.vocal_denoise`.
- Purge scripts: `scripts/purge_local_stems.py`, `scripts/purge_failed_assets.py`; daily tasks in
  `deploy/render-pc/`.

## Build
1. `models.py`: add `door1_source_url`, `door1_settings` (dict), `door1_enquiry_id`, `door1_due_on`
   with safe defaults so old rows parse.
2. `client.py`: the claim query also claims `route='door1'` queued rows (same atomic claim). Add
   `upload_door1(job_id, kind, path)` to bucket `door1` at `{job_id}/{kind}.flac` and let
   `insert_delivery` take `watermark_id=None`. Every HTTP error raises.
3. `mapper.py`: `to_door1_request(job, source_path)`: `input_mode='known'`, `qobuz_url` from
   `door1_source_url` else `source_path` of the downloaded `full_mix` asset (exactly one, else
   raise), `voice_model=pipeline_voice_model or ''`, `restore_mode` from settings (default cascade if
   voice else zeroshot; cascade with no voice raises), `advanced.vocal_denoise` from settings,
   `lyrics_text=lyrics or ''`, language codes mapped as Door 2. Unknown voice model fails loud.
4. `poller.py`: branch on `delivery_profile`. Door 1 path: download the full mix if there is one (no
   BYO stems, no `stems.json`, no re-rolls), `create_song`, track, then `_deliver_door1`:
   `export_door1_stems(song_id)` (WAV masters stay local), encode each to 24-bit FLAC in
   `work/website/<job_id>/door1/`, NO watermark, NO ID3 licence tag, upload three, insert three
   delivery rows (`vocal`, `instrumental`, `mix`), `mark_delivered`, then delete the source asset from
   `submissions`. Door 2 path unchanged byte for byte.
5. Failure for door1: `pipeline_state='failed'`, `pipeline_error`, `status='rejected'`; the credit
   refund lookup must be a no-op (no consume row), never an exception.
6. Purge: `scripts/purge_door1_deliveries.py` (dry run by default, `--go` to act): for delivered
   door1 rows whose delivery is older than 7 days and `purged_at is null`, delete the `door1` objects
   and stamp `purged_at`. Add a daily scheduled task alongside the existing ones in
   `deploy/render-pc/` (install script only; the orchestrator runs it on the box).
7. Update `dashboard/service/website/README.md` and `deploy/render-pc.md` for the door1 path.

## Watch-outs
- One poller only on the OptiPlex. Never start a second.
- Never delete local WAV masters; `purge_local_stems.py` must skip door1 outputs or keep them 30+
  days like Door 2 stems (state which in the PR).
- FLAC encode: `soundfile` with `subtype='PCM_24'`, `format='FLAC'`; assert each file is under 50 MB
  before upload and fail loud if not.
- Heavy imports stay lazy so tests inject fakes.

## Done when
- Tests: model parsing, claim includes door1, mapper (url vs upload, knobs, voice rules), door1
  deliver (three FLAC uploads, no watermark, rows, delivered), door2 deliver unchanged, failure path
  without refund, purge dry-run vs `--go`, 50 MB guard.
- `.venv\Scripts\python -m pytest tests` green. PR lists box deploy steps (git bundle + scp, restart
  the LyricalPoller task, install the purge task).
