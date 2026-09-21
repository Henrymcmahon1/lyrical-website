# Bot F: Pipeline (watermark, re-rolls, retention, heartbeat, Door-1 export)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Paste this to start the session:**
> Read `C:\Users\User\CascadeProjects\lyrical-website\docs\superpowers\specs\2026-09-22-two-doors-v2-design.md` then `docs\bots\BOT-F-pipeline.md` in the same repo. The code lives in `C:\Users\User\CascadeProjects\lyrical-studio` (Python). Work on branch `feat/v2-pipeline` off `main` of lyrical-studio. Bot 0's migrations are applied (song_jobs.parent_job_id, reroll_index, seed, licence_terms_version, delivery_profile; song_job_assets.purged_at; song_job_deliveries.watermark_id; worker_heartbeat). Execute the brief task by task, TDD, pytest green before each commit. Never touch lyrical-website `main`.

**Goal:** The render side of v2: every Door-2 MP3 carries an inaudible AudioSeal watermark plus ID3 licence tags; child (re-roll) jobs re-run from the write stage with a seed off the parent's local stems; stems are deleted from Supabase on delivery and locally after 30 days; the poller heartbeats; staff can export lossless Door-1 stems.

**Architecture:** All changes sit in the one layer allowed to touch `lyrical` (`dashboard/service/**`) plus `scripts/` and one staff button. The Supabase contract (PostgREST + Storage REST over `httpx`, service-role key) is the only shared surface with the website. Unit tests use `httpx.MockTransport` or a `FakeClient`; nothing in `tests/` reaches the network. One acceptance test (`slow`) needs `audioseal` and ffmpeg and must pass on the OptiPlex.

**Tech Stack:** Python 3.13, httpx, soundfile, numpy, torch 2.11 CPU + torchaudio, audioseal, ffmpeg, pytest; FastAPI backend + React/Vite staff dashboard (vitest).

**Spec:** `docs/superpowers/specs/2026-09-22-two-doors-v2-design.md` §9 (scope), §3 (columns), §11, §12.

## Global Constraints

- Repo `C:\Users\User\CascadeProjects\lyrical-studio`, branch `feat/v2-pipeline` off `main`, PR into `main`. Never touch `main` of `lyrical-website` or lyricalglobal.com.
- No em dashes anywhere (code, comments, docs, commit messages). No placeholders.
- Fail loud: missing AudioSeal raises ImportError, missing stems fail the job with `stems_expired`, a non-door2 profile in the auto poller raises. No silent fallbacks.
- Secrets: `.env` in lyrical-studio holds `WEBSITE_SUPABASE_URL` and `WEBSITE_SUPABASE_SERVICE_ROLE_KEY` (the `sb_secret_...` format, values double-quoted; `python-dotenv` strips the quotes). Never print, log, echo or commit them. Talk to Supabase with `httpx` exactly as `WebsiteClient` does (`apikey` + `Authorization: Bearer` headers); never `supabase-py`.
- Windows Python: every command is prefixed `PYTHONUTF8=1 PYTHONIOENCODING=utf-8` and uses `.venv\Scripts\python.exe`.
- The OptiPlex render PC: `192.168.86.31`, user `henry`, key `C:\Users\User\.ssh\lyrical_render_pc` (Git Bash: `ssh -i /c/Users/User/.ssh/lyrical_render_pc henry@192.168.86.31`), repo `C:\lyrical-studio` on `main`, venv `.venv` (Python 3.13, torch 2.11 CPU only; GPU stages run on Modal).
- ONE poller only: the interactive scheduled task `LyricalPoller` runs `scripts\website_poll.py --interval 30`. Never start a second poller by hand; restart the task.
- SynthV renders need the console session and a clear desktop (close Explorer windows, Win+D) or the Auto Recovery pixel probe misfires (memory `synthv-recovery-false-positive`).
- Verify before claiming done: `pytest` green locally, the slow acceptance test green on the OptiPlex, one real omega job and one real re-roll.

## File structure

| File | Responsibility |
|---|---|
| `requirements.txt` | add `audioseal` |
| `dashboard/service/website/media.py` | `encode_mp3(metadata=)`, `watermark_wav`, `detect_watermark`, `watermark_and_encode` |
| `scripts/detect_watermark.py` | CLI: probability + decoded message for a file |
| `dashboard/service/website/models.py` | `WebsiteJob` + `route, parent_job_id, reroll_index, seed, delivery_profile`; `WebsiteAsset.purged_at` |
| `dashboard/service/website/client.py` | v2 entitlement, `insert_delivery(watermark_id=)`, `fail_and_reject`, `delete_assets`, `failed_jobs_older_than`, `heartbeat` |
| `dashboard/service/website/poller.py` | watermarked delivery, stems manifest, child (re-roll) path, purge after delivery |
| `dashboard/service/website/heartbeat.py` | `worker_version(repo_root)` |
| `dashboard/service/songs.py` | `resume_with_seed(song_id, seed)` |
| `lyrical/translate/models.py`, `lyrical/stages/s4_write/translate.py` | seed threaded into writer prompts |
| `lyrical/compute/seedvc_modal.py`, `lyrical/stages/s6_restore/convert.py` | seed threaded into zero-shot Seed-VC |
| `dashboard/service/export_door1.py` | `export_door1_stems(song_id)` 24-bit WAVs |
| `dashboard/backend/routers/songs.py` | `POST /api/songs/{id}/export-door1` |
| `dashboard/frontend/src/api/client.ts`, `features/songsLibrary/SongDetail.tsx` | "Export Door-1 stems" button |
| `scripts/website_poll.py` | heartbeat each loop, `--worker` |
| `scripts/purge_local_stems.py`, `scripts/purge_failed_assets.py` | retention |
| `tests/**` | one test file per task, named in each task's Files line |

---

### Task 1: Branch, dependency, watermark + ID3

**Files:** `requirements.txt`, `dashboard/service/website/media.py`, `scripts/detect_watermark.py`, `tests/dashboard/website/test_media.py`, `tests/dashboard/website/test_watermark_acceptance.py`

**Interfaces:** `encode_mp3(src, dst, *, bitrate="192k", metadata=None) -> Path`; `watermark_wav(src_wav, dst_wav, *, watermark_id) -> Path`; `detect_watermark(path) -> tuple[float, int]`; `watermark_and_encode(src_wav, dst_mp3, *, watermark_id, job_id) -> Path`.

- [ ] **Step 1: Branch and install**

```bash
cd /c/Users/User/CascadeProjects/lyrical-studio && git checkout main && git pull && git checkout -b feat/v2-pipeline
printf '\n# Door-2 provenance watermark (dashboard/service/website/media.py). CPU torch is enough.\naudioseal\n' >> requirements.txt
PYTHONUTF8=1 PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -m pip install audioseal
```

- [ ] **Step 2: Failing tests** (append to `test_media.py`):

```python
import json, subprocess
from dashboard.service.website.media import bits_to_int, message_bits, encode_mp3
def _tags(mp3):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format_tags=comment,copyright",
                          "-of", "json", str(mp3)], capture_output=True, text=True, check=True).stdout
    return {k.lower(): v for k, v in json.loads(out)["format"].get("tags", {}).items()}
def test_encode_mp3_writes_id3_metadata(tmp_path):
    src = tmp_path / "t.wav"; sr = 22050
    sf.write(str(src), (0.1 * np.sin(np.arange(sr) / 20)).astype("float32"), sr)
    encode_mp3(src, tmp_path / "t.mp3", metadata={"comment": "Personal use only. lyrical beta. Job j1",
                                                  "copyright": "lyrical, personal-use licence"})
    tags = _tags(tmp_path / "t.mp3")
    assert tags["comment"].endswith("Job j1") and tags["copyright"].startswith("lyrical")
def test_message_bits_round_trip():
    pytest.importorskip("torch")
    for wid in (0, 1, 40961, 65535):
        assert bits_to_int(message_bits(wid)[0]) == wid
    with pytest.raises(ValueError):
        message_bits(1 << 16)
```

- [ ] **Step 3: Run, expect FAIL** `PYTHONUTF8=1 PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -m pytest tests/dashboard/website/test_media.py -q`

- [ ] **Step 4: Implement** in `media.py` (replace `encode_mp3`, add the rest):

```python
import subprocess
from pathlib import Path
import numpy as np
import soundfile as sf

WATERMARK_GENERATOR = "audioseal_wm_16bits"
WATERMARK_DETECTOR = "audioseal_detector_16bits"
WATERMARK_SR = 16_000   # AudioSeal models are trained at 16 kHz

def encode_mp3(src, dst, *, bitrate: str = "192k", metadata: "dict[str, str] | None" = None) -> Path:
    """Encode ``src`` to an MP3 at ``dst`` with optional ID3v2.3 tags. Fail loud."""
    src, dst = Path(src), Path(dst)
    if not src.exists():
        raise FileNotFoundError(f"no audio to encode at {src}")
    dst.parent.mkdir(parents=True, exist_ok=True)
    cmd = ["ffmpeg", "-y", "-i", str(src), "-codec:a", "libmp3lame", "-b:a", bitrate, "-id3v2_version", "3"]
    for key, value in (metadata or {}).items():
        cmd += ["-metadata", f"{key}={value}"]
    proc = subprocess.run(cmd + [str(dst)], capture_output=True, text=True)
    if proc.returncode != 0 or not dst.exists() or dst.stat().st_size == 0:
        raise RuntimeError(f"ffmpeg MP3 encode failed (exit {proc.returncode}) for {src}: {(proc.stderr or '')[-500:]}")
    return dst

def message_bits(watermark_id: int):
    """16-bit message tensor (1, 16), most significant bit first."""
    import torch
    if not 0 <= watermark_id < (1 << 16):
        raise ValueError(f"watermark_id must fit 16 bits, got {watermark_id}")
    return torch.tensor([[(watermark_id >> (15 - i)) & 1 for i in range(16)]], dtype=torch.int32)

def bits_to_int(bits) -> int:
    return int("".join(str(int(round(float(b)))) for b in bits), 2)

def watermark_wav(src_wav, dst_wav, *, watermark_id: int) -> Path:
    """Embed the AudioSeal mark at the source's native rate: the mono downmix goes to
    16 kHz for the generator, the delta is resampled back and added to every channel,
    so the deliverable keeps its 44.1 kHz. ImportError propagates: no mark, no delivery."""
    import torch
    import torchaudio.functional as AF
    from audioseal import AudioSeal
    audio, sr = sf.read(str(src_wav), dtype="float32", always_2d=True)      # (T, C)
    mono = torch.from_numpy(audio.mean(axis=1).copy())[None, None, :]        # (1, 1, T)
    low = AF.resample(mono, sr, WATERMARK_SR)
    generator = AudioSeal.load_generator(WATERMARK_GENERATOR)
    with torch.no_grad():
        delta_low = generator.get_watermark(low, sample_rate=WATERMARK_SR, message=message_bits(watermark_id))
    delta = AF.resample(delta_low, WATERMARK_SR, sr)[0, 0, : audio.shape[0]].numpy()
    if delta.shape[0] < audio.shape[0]:
        delta = np.pad(delta, (0, audio.shape[0] - delta.shape[0]))
    marked = np.clip(audio + delta[:, None], -1.0, 1.0)
    dst_wav = Path(dst_wav)
    dst_wav.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(dst_wav), marked, sr, subtype="PCM_24")
    return dst_wav

def detect_watermark(path) -> "tuple[float, int]":
    """(detection probability, decoded 16-bit message) for any ffmpeg-readable file."""
    import torch
    from audioseal import AudioSeal
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(path)
    proc = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(WATERMARK_SR),
                           "-f", "f32le", "-"], capture_output=True)
    if proc.returncode != 0 or not proc.stdout:
        raise RuntimeError(f"ffmpeg decode failed for {path}: {proc.stderr.decode(errors='replace')[-300:]}")
    wav = torch.frombuffer(bytearray(proc.stdout), dtype=torch.float32)[None, None, :]
    detector = AudioSeal.load_detector(WATERMARK_DETECTOR)
    with torch.no_grad():
        prob, msg = detector.detect_watermark(wav, sample_rate=WATERMARK_SR)
    return float(prob), bits_to_int(msg[0])

def watermark_and_encode(src_wav, dst_mp3, *, watermark_id: int, job_id: str, bitrate: str = "192k") -> Path:
    """Door-2 deliverable: mark, then 192k MP3 with the licence tags."""
    dst_mp3 = Path(dst_mp3)
    marked = dst_mp3.with_name(dst_mp3.stem + ".marked.wav")
    watermark_wav(src_wav, marked, watermark_id=watermark_id)
    try:
        return encode_mp3(marked, dst_mp3, bitrate=bitrate, metadata={
            "comment": f"Personal use only. lyrical beta. Job {job_id}",
            "copyright": "lyrical, personal-use licence"})
    finally:
        marked.unlink(missing_ok=True)
```

- [ ] **Step 5: Acceptance test** `test_watermark_acceptance.py` (slow; skipped without audioseal, REQUIRED to pass on the OptiPlex, Task 8):

```python
"""MP3 round trip: mark -> encode -> decode. Needs audioseal + ffmpeg (slow)."""
import numpy as np, pytest, soundfile as sf
from dashboard.service.website.media import detect_watermark, encode_mp3, watermark_and_encode
pytestmark = pytest.mark.slow
pytest.importorskip("audioseal", reason="audioseal not installed; required on the OptiPlex")
def _song(tmp_path, sr=44100, secs=5.0):
    t = np.arange(int(sr * secs)) / sr
    y = 0.3 * np.sin(2 * np.pi * 220 * t) + 0.05 * np.random.default_rng(7).standard_normal(t.shape)
    p = tmp_path / "song.wav"
    sf.write(str(p), np.stack([y, y], axis=1).astype("float32"), sr)
    return p
def test_mark_survives_mp3_and_decodes(tmp_path):
    mp3 = watermark_and_encode(_song(tmp_path), tmp_path / "cover.mp3", watermark_id=40961, job_id="j1")
    prob, message = detect_watermark(mp3)
    assert prob >= 0.9 and message == 40961
def test_unmarked_mp3_is_clean(tmp_path):
    prob, _ = detect_watermark(encode_mp3(_song(tmp_path), tmp_path / "plain.mp3"))
    assert prob < 0.1
```

- [ ] **Step 6: `scripts/detect_watermark.py`**

```python
"""Print AudioSeal detection probability and decoded message for a file. Exit 0 when marked.
    PYTHONUTF8=1 PYTHONIOENCODING=utf-8 .venv\\Scripts\\python.exe scripts\\detect_watermark.py cover.mp3
"""
from __future__ import annotations
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
def main(argv: "list[str] | None" = None) -> int:
    args = argv if argv is not None else sys.argv[1:]
    if len(args) != 1:
        print("usage: detect_watermark.py <audio file>", file=sys.stderr)
        return 2
    from dashboard.service.website.media import detect_watermark
    prob, message = detect_watermark(args[0])
    print(f"file={args[0]} probability={prob:.3f} message={message}")
    return 0 if prob >= 0.9 else 1
if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 7: Run** `... -m pytest tests/dashboard/website/test_media.py -q` (PASS) and `... -m pytest -m slow tests/dashboard/website/test_watermark_acceptance.py -q` (PASS, audioseal installed in Step 1). Commit: `git add -A && git commit -m "media: AudioSeal watermark + ID3 licence tags for Door-2 MP3s"`

### Task 2: Job model, entitlement for v2 plans, delivery row with watermark_id

**Files:** `models.py`, `client.py`, `tests/dashboard/website/test_client_read.py`, `test_client_entitlement.py`, `test_client_delivery.py`

- [ ] **Step 1: Failing tests**

```python
# test_client_read.py (append): the select is "*", so the new columns arrive without a query change
def test_next_queued_job_carries_v2_columns():
    row = {"id": "c1", "user_id": "u1", "title": "T", "primary_artist": "A", "source_language": "English",
           "target_language": "Spanish", "lyrics": "la", "voice_id": None, "voice_preference": None,
           "pipeline_voice_model": None, "status": "approved", "pipeline_state": "queued", "route": "auto",
           "parent_job_id": "j1", "reroll_index": 1, "seed": 123456, "delivery_profile": "door2"}
    job = _client(lambda r: httpx.Response(200, json=[row])).next_queued_job()
    assert (job.parent_job_id, job.reroll_index, job.seed, job.delivery_profile, job.route) == ("j1", 1, 123456, "door2", "auto")

# test_client_delivery.py (append)
def test_insert_delivery_carries_watermark_id():
    seen = {}
    def handler(req):
        seen["body"] = json.loads(req.content.decode()); return httpx.Response(201, json=[])
    _client(handler).insert_delivery("j1", "u1", "u1/j1/cover.mp3", "cover.mp3", 1, watermark_id=40961)
    assert seen["body"]["watermark_id"] == 40961
def test_fail_and_reject_patches_both_states():
    seen = {}
    def handler(req):
        assert req.method == "PATCH" and "id=eq.c1" in str(req.url)
        seen["body"] = json.loads(req.content.decode()); return httpx.Response(200, json=[{"id": "c1"}])
    _client(handler).fail_and_reject("c1", "stems_expired")
    assert seen["body"] == {"pipeline_state": "failed", "pipeline_error": "stems_expired", "status": "rejected"}

# test_client_entitlement.py (append). Route by URL: subscriptions, the quota count, song_credits, the parent row.
def _v2(sub_rows, used, credit_rows, parent_rows):
    def handler(req):
        u = str(req.url)
        if "/subscriptions" in u: return httpx.Response(200, json=sub_rows)
        if "/song_credits" in u: return httpx.Response(200, json=credit_rows)
        if "quota_consumed_at" in u: return httpx.Response(200, json=[], headers={"content-range": f"0-0/{used}"})
        if "/song_jobs" in u: return httpx.Response(200, json=parent_rows)
        raise AssertionError(u)
    return _client(handler)
FAN = [{"tier": "fan", "status": "active", "current_period_start": "2026-09-01T00:00:00Z"}]
def test_fan_within_allowance(): assert _v2(FAN, 3, [], []).active_entitlement("u1", job_id="j1") is True
def test_fan_over_allowance_no_credit(): assert _v2(FAN, 6, [], []).active_entitlement("u1", job_id="j1") is False
def test_credit_consumed_for_this_job(): assert _v2([], 0, [{"id": "x"}], []).active_entitlement("u1", job_id="j1") is True
def test_no_sub_no_credit_fails_closed(): assert _v2([], 0, [], []).active_entitlement("u1", job_id="j1") is False
def test_child_entitled_iff_parent_delivered():
    assert _v2([], 0, [], [{"id": "j1", "status": "delivered"}]).active_entitlement("u1", job_id="c1", parent_job_id="j1") is True
    assert _v2([], 0, [], []).active_entitlement("u1", job_id="c1", parent_job_id="j1") is False
```

Update the existing entitlement tests: tiers `starter/creator/pro` become `fan`/`superfan`, every call passes `job_id="j1"`, and their handlers answer `/song_credits` with `[]`.

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement.** `models.py`: add to `WebsiteJob` after `pipeline_state` (defaults keep the positional constructors in the tests valid) and to `from_row`:

```python
    route: "str | None" = None
    parent_job_id: "str | None" = None
    reroll_index: int = 0
    seed: "int | None" = None
    delivery_profile: str = "door2"
    # in from_row:
            route=row.get("route"), parent_job_id=row.get("parent_job_id"),
            reroll_index=int(row.get("reroll_index") or 0), seed=row.get("seed"),
            delivery_profile=row.get("delivery_profile") or "door2",
```

`WebsiteAsset`: add `purged_at: "str | None" = None` and `purged_at=row.get("purged_at")`. `client.py`: `_ALLOWANCE = {"fan": 5, "superfan": 15}` (mirrors `lyrical-website/lib/plans.ts`), rename the old `active_entitlement` body to `_subscription_allows(self, user_id) -> bool` (verbatim), then:

```python
    def active_entitlement(self, user_id: str, *, job_id: str, parent_job_id: "str | None" = None) -> bool:
        """Render-time belt-and-braces gate for the v2 plans (spec §4). A child (re-roll)
        is entitled iff its parent is delivered; re-rolls consume nothing. Otherwise an
        active fan/superfan within the period allowance wins, else a 'consume' credit row
        written for THIS job at submit. Fail closed."""
        if parent_job_id:
            r = self._http.get(f"{self._rest}/song_jobs", params={"id": f"eq.{parent_job_id}", "user_id": f"eq.{user_id}",
                               "select": "id,status", "limit": "1"}, headers=self._headers)
            r.raise_for_status()
            rows = r.json()
            return bool(rows) and rows[0].get("status") == "delivered"
        if self._subscription_allows(user_id):
            return True
        r = self._http.get(f"{self._rest}/song_credits", params={"job_id": f"eq.{job_id}", "user_id": f"eq.{user_id}",
                           "reason": "eq.consume", "select": "id", "limit": "1"}, headers=self._headers)
        r.raise_for_status()
        return len(r.json()) > 0

    def fail_and_reject(self, job_id: str, error: str) -> None:
        """Terminal failure the CUSTOMER must see: pipeline 'failed' + status 'rejected' in one
        PATCH (customers cannot read pipeline_error; the website shows its closed-window copy)."""
        r = self._http.patch(f"{self._rest}/song_jobs", params={"id": f"eq.{job_id}"},
                             headers={**self._headers, "Content-Type": "application/json"},
                             json={"pipeline_state": "failed", "pipeline_error": error, "status": "rejected"})
        r.raise_for_status()
```

`insert_delivery(..., *, kind="cover", watermark_id: "int | None" = None)`: add `"watermark_id": watermark_id` to the JSON only when not None (the existing exact-body test stays green).

- [ ] **Step 4: Run, expect PASS.** Commit: `git commit -am "website: v2 job columns, plan-aware entitlement, watermark_id on deliveries"`

### Task 3: Seed threading (writer prompts + zero-shot Seed-VC) and `resume_with_seed`

**Files:** `lyrical/translate/models.py`, `lyrical/stages/s4_write/translate.py`, `lyrical/compute/seedvc_modal.py`, `lyrical/stages/s6_restore/convert.py`, `dashboard/service/songs.py`, `dashboard/service/__init__.py`, `tests/translate/test_router_seed.py`, `tests/test_seedvc_seed.py`, `tests/dashboard/test_songs_reroll.py`

Why prompt-level: Anthropic has no `seed` parameter and Sonnet-5-class models reject sampling params (`_NO_SAMPLING_PARAMS_ANTHROPIC`); a variation note on the writer roles works on every provider. Seed-VC's `inference.py` has no seed flag, so a bootstrap seeds torch before running it.

- [ ] **Step 1: Failing tests**

```python
# tests/translate/test_router_seed.py
from lyrical.translate.models import ModelRouter, variation_note
def _router(seed):
    seen = {}
    def completer(provider, model, system, user, temperature, json_mode):
        seen["user"] = user; return "ok"
    r = ModelRouter(completer=completer, seed=seed)
    r.resolve = lambda role, target_language="": ("openai", "gpt-test")
    return r, seen
def test_seed_touches_only_writer_prompts():
    r, seen = _router(123456); r.call("writer_a", "sys", "write it")
    assert seen["user"] == "write it" + variation_note(123456)
    r.call("judge", "sys", "score it"); assert seen["user"] == "score it"
    r, seen = _router(None); r.call("writer_b", "sys", "write it"); assert seen["user"] == "write it"

# tests/test_seedvc_seed.py
import sys
from lyrical.compute.seedvc_modal import zeroshot_argv
def test_unseeded_runs_inference_directly():
    assert zeroshot_argv(None, ["--source", "a"]) == [sys.executable, "inference.py", "--source", "a"]
def test_seeded_bootstraps_torch_seed():
    argv = zeroshot_argv(99, ["--source", "a"])
    assert argv[:2] == [sys.executable, "-c"] and "torch.manual_seed" in argv[2] and argv[3:] == ["99", "--source", "a"]

# tests/dashboard/test_songs_reroll.py (reuse _render_job, _appstate_with_mock_store, _build_lang_tree, _lang_dir, JOB_ID from test_songs_resume_stage.py)
def test_resume_with_seed_stamps_extra_and_resumes_from_write(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "WORK_DIR", tmp_path); _build_lang_tree(tmp_path)
    a = _appstate_with_mock_store(); a.store.get_job.return_value = _render_job()
    assert songs.resume_with_seed(JOB_ID, seed=123456, appstate=a) == JOB_ID
    assert a.store.upsert_job.call_args[0][0].extra["seed"] == 123456
    a.store.set_job_status.assert_called_with(JOB_ID, "pending")
    assert not (_lang_dir(tmp_path) / "lyrics").exists() and (_lang_dir(tmp_path) / "align" / "x").exists()
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement.** `lyrical/translate/models.py`:

```python
_SEEDED_ROLES = ("writer_a", "writer_b")

def variation_note(seed: int) -> str:
    return (f"\n\nVARIATION {seed}: this is a re-roll of an earlier take. Keep the meaning and the "
            f"slot counts, but choose different words, images and line openings from any previous version.")

class ModelRouter:
    def __init__(self, completer=None, embedder=None, seed: "int | None" = None) -> None:
        self._completer = completer or _default_completer
        self._embedder = embedder or _default_embedder
        self.seed = seed
    # first lines of call(), before resolve():
        if self.seed is not None and role in _SEEDED_ROLES:
            user = user + variation_note(self.seed)
```

`translate.py` `_run`, first lines:

```python
        seed = job.extra.get("seed")
        if seed is not None and (isinstance(seed, bool) or not isinstance(seed, int)):
            raise StageInputError(f"job.extra['seed'] must be an int, got {seed!r}")
        self.router.seed = seed
```

`seedvc_modal.py` (module level) and `convert_zeroshot(..., seed: "int | None" = None)`:

```python
_SEEDED_BOOTSTRAP = ("import runpy, sys, torch; seed = int(sys.argv[1]); torch.manual_seed(seed); "
                     "torch.cuda.manual_seed_all(seed); sys.argv = ['inference.py'] + sys.argv[2:]; "
                     "runpy.run_path('inference.py', run_name='__main__')")

def zeroshot_argv(seed: "int | None", infer_args: "list[str]") -> "list[str]":
    """Plain inference.py, or the same args behind a torch-seeding bootstrap for re-rolls."""
    import sys
    if seed is None:
        return [sys.executable, "inference.py", *infer_args]
    return [sys.executable, "-c", _SEEDED_BOOTSTRAP, str(seed), *infer_args]
```

In `convert_zeroshot`, `infer_args = ["--source", str(src), "--target", str(ref), ...  "--fp16", "True"]` (the existing list minus its first two items) and `_run(zeroshot_argv(seed, infer_args), "zeroshot-infer", REPO, env)`. In `convert.py` `_zeroshot_convert`: `fn.remote(..., semi_tone_shift=job.pitch_shift, seed=job.extra.get("seed"))`. `dashboard/service/songs.py` (export it from `dashboard/service/__init__.py`):

```python
def resume_with_seed(song_id: str, *, seed: int, appstate=None) -> str:
    """Re-roll: stamp ``seed`` on the render job, then resume from the write stage.
    Paid stages are confirmed: a re-roll is a paid re-run by design (~$0.50)."""
    appstate = appstate or get_appstate()
    store = appstate.store
    job = _resolve_render_job(song_id, store)
    job.extra["seed"] = int(seed)
    store.upsert_job(job)
    return resume_from_stage(song_id, "write", confirm_spend=True, appstate=appstate)
```

- [ ] **Step 4: Run, expect PASS.** Commit: `git add -A && git commit -m "reroll: seed threaded into writer prompts and zero-shot Seed-VC; resume_with_seed"`

### Task 4: Poller: watermarked delivery, stems manifest, re-roll path, purge after delivery

**Files:** `poller.py`, `client.py` (`delete_assets`), `tests/dashboard/website/test_poller.py`, `test_poller_reroll.py`, `test_client_retention.py`

- [ ] **Step 1: Failing tests.** In `test_poller.py` extend `FakeClient` (and give `self.job` `route="auto"`):

```python
        self.rejected = None; self.purged = None
    def active_entitlement(self, user_id, *, job_id, parent_job_id=None): return True
    def insert_delivery(self, job_id, user_id, path, filename, bytes, *, kind="cover", watermark_id=None):
        self.inserted = {"job_id": job_id, "path": path, "filename": filename, "bytes": bytes, "kind": kind, "watermark_id": watermark_id}
    def fail_and_reject(self, jid, error): self.rejected = (jid, error)
    def delete_assets(self, job_id, user_id): self.purged = (job_id, user_id); return 2
```

`test_run_once_happy_path` additionally asserts `0 <= c.inserted["watermark_id"] < 65536`, `c.purged == ("j1", "u1")`, and that `fake_encode` received `watermark_id` and `job_id="j1"` in `kw`. Add:

```python
def test_run_once_writes_stems_manifest(tmp_path):
    c = FakeClient()
    run_once(c, CFG, create_song_fn=lambda *a, **k: "run-1", status_fn=lambda r: _status("failed"), work_root=tmp_path, poll_s=0)
    m = json.loads((tmp_path / "website" / "j1" / "stems.json").read_text())
    assert m["run_id"] == "run-1" and Path(m["instrumental"]).exists() and Path(m["vocal"]).exists()
def test_deliver_refuses_non_door2(tmp_path):
    c = FakeClient(); c.job = dataclasses.replace(c.job, delivery_profile="door1")
    with pytest.raises(ValueError):
        run_once(c, CFG, create_song_fn=lambda *a, **k: "run-1", status_fn=lambda r: _status("complete"),
                 cover_fn=lambda r, appstate=None: tmp_path / "x.wav", work_root=tmp_path, poll_s=0)
    assert c.state[1] == "failed" and c.purged is None

# test_poller_reroll.py (import CFG, FakeClient, _status from .test_poller)
def _child(c, seed=123456):
    c.job = dataclasses.replace(c.job, id="c1", parent_job_id="j1", reroll_index=1, seed=seed); return c
def _parent_prep(tmp_path, run_id="run-p"):
    d = tmp_path / "website" / "j1"; d.mkdir(parents=True)
    (d / "i.flac").write_bytes(b"x"); (d / "v.flac").write_bytes(b"x")
    (d / "stems.json").write_text(json.dumps({"instrumental": str(d / "i.flac"), "vocal": str(d / "v.flac"), "run_id": run_id}))
def test_child_with_missing_stems_fails_and_rejects(tmp_path):
    c = _child(FakeClient()); called = []
    out = run_once(c, CFG, resume_fn=lambda *a, **k: called.append(1), create_song_fn=lambda *a, **k: "never",
                   status_fn=lambda r: _status("complete"), work_root=tmp_path, poll_s=0)
    assert out is None and called == [] and c.rejected == ("c1", "stems_expired")
def test_child_with_stems_resumes_parent_run_with_seed(tmp_path):
    c = _child(FakeClient()); _parent_prep(tmp_path); seen = {}
    def fake_resume(song_id, *, seed, appstate=None): seen.update(song_id=song_id, seed=seed); return song_id
    cover = tmp_path / "cover.wav"; cover.write_bytes(b"w")
    def fake_encode(src, dst, **kw): Path(dst).parent.mkdir(parents=True, exist_ok=True); Path(dst).write_bytes(b"m"); return Path(dst)
    out = run_once(c, CFG, resume_fn=fake_resume, create_song_fn=lambda *a, **k: "never", status_fn=lambda r: _status("complete"),
                   cover_fn=lambda r, appstate=None: cover, encode_fn=fake_encode, work_root=tmp_path, poll_s=0)
    assert out == "run-p" and seen == {"song_id": "run-p", "seed": 123456}
    assert c.uploaded[1] == "c1" and c.delivered == "c1" and c.inserted["job_id"] == "c1"
    assert (tmp_path / "website" / "j1" / "i.flac").exists()   # parent stems untouched
def test_child_without_seed_fails_loud(tmp_path):
    c = _child(FakeClient(), seed=None); _parent_prep(tmp_path)
    with pytest.raises(ValueError):
        run_once(c, CFG, resume_fn=lambda *a, **k: "x", status_fn=lambda r: _status("complete"), work_root=tmp_path, poll_s=0)
    assert c.state == ("c1", "failed", "child job c1 has no seed")

# test_client_retention.py
def test_delete_assets_deletes_prefixes_then_stamps_purged_at():
    calls = []
    def handler(req):
        calls.append((req.method, str(req.url), req.content))
        if req.method == "GET": return httpx.Response(200, json=[
            {"id": "a1", "job_id": "j1", "kind": "instrumental", "path": "u1/j1/i.flac", "filename": "i.flac", "bytes": 1, "purged_at": None},
            {"id": "a2", "job_id": "j1", "kind": "vocal", "path": "u1/j1/v.flac", "filename": "v.flac", "bytes": 1, "purged_at": "2026-09-01T00:00:00Z"}])
        return httpx.Response(200, json=[])
    assert _client(handler).delete_assets("j1", "u1") == 1
    assert calls[1][0] == "DELETE" and calls[1][1].endswith("/storage/v1/object/submissions") and json.loads(calls[1][2]) == {"prefixes": ["u1/j1/i.flac"]}
    assert calls[2][0] == "PATCH" and "song_job_assets?job_id=eq.j1" in calls[2][1] and b"purged_at" in calls[2][2]
def test_delete_assets_refuses_foreign_prefix_and_skips_when_empty():
    foreign = lambda r: httpx.Response(200, json=[{"id": "a1", "job_id": "j1", "kind": "vocal", "path": "u2/j1/v.flac", "filename": "v.flac", "bytes": 1}])
    with pytest.raises(ValueError): _client(foreign).delete_assets("j1", "u1")
    calls = []
    def empty(req): calls.append(req.method); return httpx.Response(200, json=[])
    assert _client(empty).delete_assets("c1", "u1") == 0 and calls == ["GET"]
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement.** `client.py`:

```python
    def delete_assets(self, job_id: str, user_id: str) -> int:
        """Retention: delete every not-yet-purged submission object of ``job_id`` from Storage
        (one DELETE with a prefixes body), then stamp song_job_assets.purged_at. Refuses any
        path outside ``{user_id}/``. Returns the number deleted."""
        from datetime import datetime, timezone
        pending = [a.path for a in self.assets_for(job_id) if a.path and a.purged_at is None]
        for p in pending:
            if not p.startswith(f"{user_id}/"):
                raise ValueError(f"refusing to delete {p!r}: not under user {user_id}")
        if not pending:
            return 0
        r = self._http.request("DELETE", f"{self._storage}/{self._cfg.submissions_bucket}",
                               headers={**self._headers, "Content-Type": "application/json"}, json={"prefixes": pending})
        r.raise_for_status()
        r = self._http.patch(f"{self._rest}/song_job_assets", params={"job_id": f"eq.{job_id}"},
                             headers={**self._headers, "Content-Type": "application/json"},
                             json={"purged_at": datetime.now(timezone.utc).isoformat()})
        r.raise_for_status()
        return len(pending)
```

`poller.py` (imports `json`, `secrets`; `run_once` gains `resume_fn=None`):

```python
def _manifest_path(work_root, job_id: str) -> Path:
    return Path(work_root) / "website" / job_id / "stems.json"

def _write_manifest(work_root, job_id: str, *, instrumental: Path, vocal: Path, run_id: str) -> None:
    """Where the original's stems and local run live, so a child can find them."""
    _manifest_path(work_root, job_id).write_text(json.dumps(
        {"instrumental": str(instrumental), "vocal": str(vocal), "run_id": run_id}), encoding="utf-8")

def _parent_prep(work_root, parent_job_id: str) -> dict:
    """The parent's manifest with both stems still on disk, else FileNotFoundError."""
    p = _manifest_path(work_root, parent_job_id)
    if not p.exists():
        raise FileNotFoundError(f"no stems manifest for parent {parent_job_id}")
    m = json.loads(p.read_text(encoding="utf-8"))
    for key in ("instrumental", "vocal", "run_id"):
        if not m.get(key) or (key != "run_id" and not Path(m[key]).exists()):
            raise FileNotFoundError(f"parent {parent_job_id} {key} missing")
    return m

def _deliver(client, job, run_id, cover_fn, encode_fn, work_root, appstate) -> None:
    """Mark, encode, upload, record, mark delivered; then purge the submission objects."""
    try:
        if cover_fn is None:
            from dashboard.service.songs import finished_cover_path as cover_fn
        cover = cover_fn(run_id, appstate=appstate)
        if cover is None:
            raise ValueError(f"run {run_id} completed but no finished cover (og-matched mix) was found to deliver")
        if job.delivery_profile != "door2":
            raise ValueError(f"job {job.id} has delivery_profile {job.delivery_profile!r}; "
                             f"the auto poller only delivers door2 (Door 1 is delivered by hand)")
        if encode_fn is None:
            from .media import watermark_and_encode as encode_fn
        watermark_id = secrets.randbelow(1 << 16)
        mp3 = Path(work_root) / "website" / job.id / "cover.mp3"
        encode_fn(cover, mp3, watermark_id=watermark_id, job_id=job.id)
        obj_path = client.upload_delivery(job.user_id, job.id, mp3)
        client.insert_delivery(job.id, job.user_id, obj_path, mp3.name, mp3.stat().st_size, watermark_id=watermark_id)
        client.mark_delivered(job.id)
    except Exception as exc:
        client.set_pipeline_state(job.id, "failed", error=f"delivery failed: {exc}")
        raise
    # Delivered. Supabase is transit, not archive: clear the uploads now. An error here
    # propagates to the poll loop's log but never un-delivers the job.
    if job.route == "auto":
        client.delete_assets(job.id, job.user_id)

def _track(client, job, run_id, *, status_fn, cover_fn, encode_fn, work_root, appstate, poll_s, max_wait_s) -> str:
    """The wait loop, shared by originals and children: the body is today's run_once from
    ``if status_fn is None:`` down to ``time.sleep(poll_s)`` (poller.py lines 123 to 147), moved
    here verbatim; every ``return run_id`` stays."""

def _run_child(client, job, *, resume_fn, work_root, appstate) -> "str | None":
    """Re-roll: reuse the parent's prep (stems, align) and re-run from write with the seed."""
    try:
        prep = _parent_prep(work_root, job.parent_job_id)
    except FileNotFoundError:
        client.fail_and_reject(job.id, "stems_expired")
        return None
    try:
        if job.seed is None:
            raise ValueError(f"child job {job.id} has no seed")
        if resume_fn is None:
            from dashboard.service.songs import resume_with_seed as resume_fn
        return resume_fn(prep["run_id"], seed=job.seed, appstate=appstate)
    except Exception as exc:
        client.set_pipeline_state(job.id, "failed", error=str(exc))
        raise
```

In `run_once`: the entitlement call becomes `client.active_entitlement(job.user_id, job_id=job.id, parent_job_id=job.parent_job_id)`; right after it:

```python
    if job.parent_job_id:
        run_id = _run_child(client, job, resume_fn=resume_fn, work_root=work_root, appstate=appstate)
        if run_id is None:
            return None
        return _track(client, job, run_id, status_fn=status_fn, cover_fn=cover_fn, encode_fn=encode_fn,
                      work_root=work_root, appstate=appstate, poll_s=poll_s, max_wait_s=max_wait_s)
```

In the original path, after `run_id = create_song_fn(req, appstate=appstate)` add `_write_manifest(work_root, job.id, instrumental=instr_path, vocal=vocal_path, run_id=run_id)`, and replace the inline wait loop with the same `_track(...)` call. Existing tests (`test_run_once_failed_local_run_stamps_failed` and friends) pass unchanged.

- [ ] **Step 4: Run, expect PASS** (`tests/dashboard/website -q`). Commit: `git commit -am "poller: watermarked door2 delivery, stems manifest, re-roll path, purge on delivery"`

### Task 5: Retention scripts

**Files:** `client.py` (`failed_jobs_older_than`), `scripts/purge_local_stems.py`, `scripts/purge_failed_assets.py`, `tests/dashboard/website/test_purge_scripts.py`, `test_client_retention.py`

- [ ] **Step 1: Failing tests**

```python
# test_client_retention.py (append)
def test_failed_jobs_older_than_queries_failed_auto_jobs():
    seen = {}
    def handler(req): seen["url"] = str(req.url); return httpx.Response(200, json=[])
    _client(handler).failed_jobs_older_than(7)
    assert "pipeline_state=eq.failed" in seen["url"] and "route=eq.auto" in seen["url"] and "created_at=lt." in seen["url"]

# test_purge_scripts.py
import os, sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
def test_purge_local_stems_lists_old_dirs_and_only_deletes_with_apply(tmp_path):
    import purge_local_stems as p
    old, new = tmp_path / "old-job", tmp_path / "new-job"
    old.mkdir(); (old / "i.flac").write_bytes(b"x"); new.mkdir()
    stale = time.time() - 40 * 86400
    os.utime(old, (stale, stale))
    assert p.candidates(tmp_path, days=30, now=time.time()) == [old]
    assert p.main(["--root", str(tmp_path), "--days", "30"]) == 0 and old.exists()
    assert p.main(["--root", str(tmp_path), "--days", "30", "--apply"]) == 0 and not old.exists() and new.exists()
def test_purge_failed_assets_calls_delete_for_each_job():
    import purge_failed_assets as p
    class Fake:
        deleted = []
        def failed_jobs_older_than(self, days): return [type("J", (), {"id": "j9", "user_id": "u1"})()]
        def delete_assets(self, job_id, user_id): self.deleted.append((job_id, user_id)); return 2
    c = Fake(); assert p.purge(c, days=7, apply=False) == 0 and c.deleted == []
    assert p.purge(c, days=7, apply=True) == 2 and c.deleted == [("j9", "u1")]
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement.** `client.py`:

```python
    def failed_jobs_older_than(self, days: int) -> "list[WebsiteJob]":
        from datetime import datetime, timedelta, timezone
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        r = self._http.get(f"{self._rest}/song_jobs", params={"pipeline_state": "eq.failed", "route": "eq.auto",
                           "created_at": f"lt.{cutoff}", "select": "*", "order": "created_at.asc"}, headers=self._headers)
        r.raise_for_status()
        return [WebsiteJob.from_row(row) for row in r.json()]
```

`scripts/purge_local_stems.py`:

```python
"""Remove work/website/<job_id>/ dirs older than --days (mtime). Dry run unless --apply.
    PYTHONUTF8=1 PYTHONIOENCODING=utf-8 .venv\\Scripts\\python.exe scripts\\purge_local_stems.py --days 30 --apply
"""
from __future__ import annotations
import argparse, shutil, sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
def candidates(root: Path, *, days: int, now: float) -> "list[Path]":
    cutoff = now - days * 86400
    return sorted(p for p in root.iterdir() if p.is_dir() and p.stat().st_mtime < cutoff)
def main(argv: "list[str] | None" = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--days", type=int, default=30); ap.add_argument("--apply", action="store_true")
    ap.add_argument("--root", type=Path, default=None, help="default: <WORK_DIR>/website")
    args = ap.parse_args(argv)
    if args.root is None:
        from dashboard.service.songs import files_root
        args.root = files_root() / "website"
    if not args.root.is_dir():
        raise SystemExit(f"no such dir: {args.root}")
    hits = candidates(args.root, days=args.days, now=time.time())
    for p in hits:
        print(("deleting " if args.apply else "would delete ") + str(p), flush=True)
        if args.apply:
            shutil.rmtree(p)
    print(f"{len(hits)} dir(s) older than {args.days} days" + ("" if args.apply else " (dry run, add --apply)"))
    return 0
if __name__ == "__main__":
    raise SystemExit(main())
```

`scripts/purge_failed_assets.py`:

```python
"""Delete Supabase submission objects of auto jobs that failed more than --days ago. Dry run unless --apply."""
from __future__ import annotations
import argparse, os, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
def purge(client, *, days: int, apply: bool) -> int:
    total = 0
    for job in client.failed_jobs_older_than(days):
        if apply:
            n = client.delete_assets(job.id, job.user_id); total += n
            print(f"purged {n} object(s) for failed job {job.id}", flush=True)
        else:
            print(f"would purge failed job {job.id}", flush=True)
    return total
def main(argv: "list[str] | None" = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--days", type=int, default=7); ap.add_argument("--apply", action="store_true")
    args = ap.parse_args(argv)
    import httpx
    from dotenv import load_dotenv
    from dashboard.service.website import WebsiteClient, WebsiteConfig
    load_dotenv()
    with httpx.Client(timeout=60.0) as http:
        purge(WebsiteClient(WebsiteConfig.from_env(os.environ), http), days=args.days, apply=args.apply)
    return 0
if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: Run, expect PASS.** Commit: `git add -A && git commit -m "retention: purge_local_stems (30d) and purge_failed_assets (7d)"`

### Task 6: Heartbeat

**Files:** `dashboard/service/website/heartbeat.py`, `client.py`, `scripts/website_poll.py`, `tests/dashboard/website/test_heartbeat.py`, `test_cli_smoke.py`

- [ ] **Step 1: Failing tests**

```python
# test_heartbeat.py
import json, httpx
from pathlib import Path
from dashboard.service.website.client import WebsiteClient
from dashboard.service.website.config import WebsiteConfig
from dashboard.service.website.heartbeat import worker_version
def test_heartbeat_upserts_with_merge_duplicates():
    seen = {}
    def handler(req):
        seen.update(method=req.method, url=str(req.url), prefer=req.headers.get("prefer"), body=json.loads(req.content.decode()))
        return httpx.Response(201, json=[])
    WebsiteClient(WebsiteConfig("https://x.supabase.co", "svc", "submissions"),
                  httpx.Client(transport=httpx.MockTransport(handler))).heartbeat("optiplex", "abc1234")
    assert seen["method"] == "POST" and seen["url"].endswith("/rest/v1/worker_heartbeat")
    assert "resolution=merge-duplicates" in seen["prefer"]
    assert seen["body"]["worker"] == "optiplex" and seen["body"]["version"] == "abc1234" and "seen_at" in seen["body"]
def test_worker_version_unknown_outside_git_and_sha_inside(tmp_path):
    assert worker_version(tmp_path) == "unknown"
    v = worker_version(Path(__file__).resolve().parents[3])
    assert v != "unknown" and len(v) >= 7

# test_cli_smoke.py (append)
def test_build_parser_worker_default():
    import website_poll
    assert website_poll.build_parser().parse_args([]).worker == "optiplex"
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement.** `heartbeat.py`:

```python
"""What the poller reports about itself each loop."""
from __future__ import annotations
import subprocess
from pathlib import Path
def worker_version(repo_root) -> str:
    """Short git sha of the checked-out pipeline, or 'unknown' (display only, never a gate)."""
    try:
        out = subprocess.run(["git", "-C", str(Path(repo_root)), "rev-parse", "--short", "HEAD"],
                             capture_output=True, text=True, timeout=10)
    except (OSError, subprocess.TimeoutExpired):
        return "unknown"
    return out.stdout.strip() if out.returncode == 0 and out.stdout.strip() else "unknown"
```

`client.py`:

```python
    def heartbeat(self, worker: str, version: str) -> None:
        """Upsert worker_heartbeat(worker) = now. The studio reads it to say whether renders run."""
        from datetime import datetime, timezone
        r = self._http.post(f"{self._rest}/worker_heartbeat",
                            headers={**self._headers, "Content-Type": "application/json",
                                     "Prefer": "resolution=merge-duplicates,return=minimal"},
                            json={"worker": worker, "seen_at": datetime.now(timezone.utc).isoformat(), "version": version})
        r.raise_for_status()
```

`scripts/website_poll.py`: `p.add_argument("--worker", default="optiplex", help="worker_heartbeat key")`; in `main` after `client = WebsiteClient(cfg, http)`: `from dashboard.service.website.heartbeat import worker_version` then `version = worker_version(Path(__file__).resolve().parents[1])`; first line of `poll_once`: `client.heartbeat(args.worker, version)`.

- [ ] **Step 4: Run, expect PASS.** Commit: `git add -A && git commit -m "poller: worker_heartbeat upsert every loop"`

### Task 7: Door-1 lossless export (service, route, button)

**Files:** `dashboard/service/export_door1.py`, `dashboard/service/__init__.py`, `dashboard/backend/routers/songs.py`, `dashboard/frontend/src/api/client.ts`, `dashboard/frontend/src/features/songsLibrary/SongDetail.tsx`, `tests/dashboard/test_export_door1.py`, `tests/dashboard/backend/test_songs_routes.py`, `dashboard/frontend/src/features/songsLibrary/library.test.tsx`

- [ ] **Step 1: Failing tests**

```python
# tests/dashboard/test_export_door1.py
import numpy as np, pytest, soundfile as sf
from unittest.mock import MagicMock
from dashboard.service import errors, export_door1
from lyrical import config
from lyrical.core.job import Job
def _tree(tmp_path, with_mix=True):
    lang = tmp_path / "bad_bunny" / "efecto" / "english"; conv = lang / "converted"; conv.mkdir(parents=True)
    stems = lang.parent / "stems"; stems.mkdir()
    y = (0.2 * np.sin(np.arange(4410) / 10)).astype("float32")
    sf.write(str(conv / "Bad_Bunny_6_vocals.wav"), y, 44100)
    sf.write(str(conv / "Bad_Bunny_6_vocals_dry.wav"), y, 44100)
    if with_mix: sf.write(str(conv / "Bad_Bunny_6_vocals_og-matched-mix.wav"), np.stack([y, y], 1), 44100)
    sf.write(str(stems / "instrumental.flac"), y, 44100)
    return lang
def _app():
    a = MagicMock()
    a.store.get_job.return_value = Job(job_id="bad_bunny_efecto_english", artist="Bad Bunny", title="Efecto", kind="render", target_language="English")
    return a
def test_export_writes_three_24bit_wavs(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "WORK_DIR", tmp_path); lang = _tree(tmp_path)
    out = export_door1.export_door1_stems("bad_bunny_efecto_english", appstate=_app())
    assert set(out) == {"vocal", "instrumental", "mix"}
    for name, p in out.items():
        assert p == lang / "door1" / f"{name}.wav" and sf.info(str(p)).subtype == "PCM_24"
def test_export_fails_loud_when_mix_missing(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "WORK_DIR", tmp_path); _tree(tmp_path, with_mix=False)
    with pytest.raises(errors.NotFoundError):
        export_door1.export_door1_stems("bad_bunny_efecto_english", appstate=_app())

# tests/dashboard/backend/test_songs_routes.py: add export_door1_stems=MagicMock(return_value={"vocal": Path("w/door1/vocal.wav")}) to fake_service
def test_export_door1_returns_paths_as_strings(client, fake_service):
    resp = client.post("/api/songs/s1/export-door1")
    assert resp.status_code == 200 and resp.json() == {"vocal": str(Path("w/door1/vocal.wav"))}
    fake_service.export_door1_stems.assert_called_once_with("s1")
```

Frontend `library.test.tsx`: add `exportDoor1: vi.fn()` to the mocked `api`, then (open the detail exactly as the existing "opens a song's detail" test does):

```tsx
it("exports Door-1 stems and shows the paths", async () => {
  vi.mocked(api.exportDoor1).mockResolvedValue({ vocal: "C:/w/door1/vocal.wav", instrumental: "C:/w/door1/instrumental.wav", mix: "C:/w/door1/mix.wav" });
  await user.click(screen.getByRole("button", { name: "Export Door-1 stems" }));
  expect(await screen.findByText("C:/w/door1/mix.wav")).toBeInTheDocument();
  expect(api.exportDoor1).toHaveBeenCalledWith("s1");
});
```

- [ ] **Step 2: Run, expect FAIL** (`pytest tests/dashboard -q`; `cd dashboard/frontend && npm test`).

- [ ] **Step 3: Implement.** `dashboard/service/export_door1.py`:

```python
"""Door-1 deliverable: lossless 24-bit stems, no watermark, written beside the song for
manual delivery. Reads what Stage 6 already produced; never re-renders."""
from __future__ import annotations
from pathlib import Path
import soundfile as sf
from . import errors
from ._appstate import get_appstate
from .songs import _resolve_render_job, _work_dir_for
def _first(cands: "list[Path]", what: str, song_id: str) -> Path:
    for p in cands:
        if p.exists():
            return p
    raise errors.NotFoundError(code="door1.missing_input", detail=f"no {what} for '{song_id}' (looked at {[str(c) for c in cands]})")
def export_door1_stems(song_id: str, *, appstate=None) -> "dict[str, Path]":
    appstate = appstate or get_appstate()
    job = _resolve_render_job(song_id, appstate.store)
    lang = _work_dir_for(job); conv = lang / "converted"; stems = lang.parent / "stems"
    vocal = _first(sorted(conv.glob("*_vocals.wav")) if conv.is_dir() else [], "restored vocal (converted/*_vocals.wav)", song_id)
    mix = _first(sorted(conv.glob("*og-matched-mix.wav")) if conv.is_dir() else [], "og-matched mix", song_id)
    instrumental = _first([stems / "instrumental_plus.flac", stems / "instrumental.flac", lang / "render" / "instrumental.wav"], "instrumental", song_id)
    out_dir = lang / "door1"; out_dir.mkdir(parents=True, exist_ok=True)
    out: "dict[str, Path]" = {}
    for name, src in (("vocal", vocal), ("instrumental", instrumental), ("mix", mix)):
        data, sr = sf.read(str(src), dtype="float32", always_2d=True)
        dst = out_dir / f"{name}.wav"
        sf.write(str(dst), data, sr, subtype="PCM_24")
        out[name] = dst
    return out
```

Export `export_door1_stems` from `dashboard/service/__init__.py`. Route in `routers/songs.py`:

```python
@router.post("/api/songs/{song_id}/export-door1")
def export_door1(song_id: str) -> dict[str, str]:
    """Write 24-bit vocal/instrumental/mix WAVs (no watermark) for manual Door-1 delivery."""
    service = get_service()
    return {name: str(path) for name, path in service.export_door1_stems(song_id).items()}
```

`client.ts` (inside `api`):

```ts
  exportDoor1(songId: string): Promise<Record<string, string>> {
    return request<Record<string, string>>(`/api/songs/${encodeURIComponent(songId)}/export-door1`, { method: "POST" });
  },
```

`SongDetail.tsx`: state `const [door1, setDoor1] = useState<Record<string, string> | null>(null); const [exporting, setExporting] = useState(false);`, handler and a block after the Stems section:

```tsx
  const handleExportDoor1 = useCallback(async () => {
    setActionError(null); setExporting(true);
    try { setDoor1(await api.exportDoor1(songId)); }
    catch (err: unknown) { setActionError(err instanceof Error ? err : new Error(String(err))); }
    finally { setExporting(false); }
  }, [songId]);

          <div className="space-y-2">
            <p className="font-product text-[11px] uppercase tracking-[0.14em] text-ink/50">Door 1</p>
            <Button variant="ghost" loading={exporting} disabled={busyStage} onClick={() => void handleExportDoor1()}>
              Export Door-1 stems
            </Button>
            {door1 ? (
              <ul className="font-product text-sm text-ink/70">
                {Object.entries(door1).map(([name, path]) => (<li key={name}>{name}: <span className="text-ink">{path}</span></li>))}
              </ul>
            ) : null}
          </div>
```

- [ ] **Step 4: Run, expect PASS** (pytest + `npm test` + `npm run build` in `dashboard/frontend`). Commit: `git add -A && git commit -m "door1: lossless 24-bit stem export (service, route, staff button)"`

### Task 8: Deploy to the OptiPlex and run the proof jobs

**Files:** none in the repo. Commands from Git Bash on Henry's desktop with `KEY=/c/Users/User/.ssh/lyrical_render_pc; HOST=henry@192.168.86.31`.

- [ ] **Step 1: Full local suite green** (Task 9 Step 1), then `git push -u origin feat/v2-pipeline`.

- [ ] **Step 2: Ship the changed files by scp** (a tar of exactly the branch diff; Windows 11 ships `tar.exe`):

```bash
cd /c/Users/User/CascadeProjects/lyrical-studio
git archive --format=tar -o /tmp/v2-pipeline.tar feat/v2-pipeline $(git diff --name-only main...feat/v2-pipeline)
scp -i $KEY /tmp/v2-pipeline.tar $HOST:C:/lyrical-studio/v2-pipeline.tar
ssh -i $KEY $HOST 'cd C:\lyrical-studio && tar -xf v2-pipeline.tar && del v2-pipeline.tar && git status --short'
```

Expected: `git status --short` lists only the files in the diff.

- [ ] **Step 3: Install audioseal and run the tests there** (the acceptance test must PASS, not skip):

```bash
ssh -i $KEY $HOST 'cd C:\lyrical-studio && .venv\Scripts\pip install audioseal'
ssh -i $KEY $HOST 'cd C:\lyrical-studio && set PYTHONUTF8=1&& set PYTHONIOENCODING=utf-8&& .venv\Scripts\python.exe -m pytest -m slow tests\dashboard\website\test_watermark_acceptance.py -q -rs'
ssh -i $KEY $HOST 'cd C:\lyrical-studio && set PYTHONUTF8=1&& set PYTHONIOENCODING=utf-8&& .venv\Scripts\python.exe -m pytest tests\dashboard -q'
```

Expected: `2 passed` (a `skipped` line means audioseal did not install; stop and fix), then the dashboard suite green.

- [ ] **Step 4: Redeploy the Seed-VC Modal app** (the `seed` kwarg), from the desktop where the Modal token lives: `PYTHONUTF8=1 PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -m modal deploy lyrical/compute/seedvc_modal.py`. No spend until a call.

- [ ] **Step 5: Restart the ONE poller and register the daily purges**

```bash
ssh -i $KEY $HOST 'schtasks /end /tn LyricalPoller & schtasks /run /tn LyricalPoller & schtasks /query /tn LyricalPoller /fo list'
ssh -i $KEY $HOST 'tasklist /fi "imagename eq python.exe" /v | findstr website_poll'
ssh -i $KEY $HOST 'if not exist C:\lyrical-studio\logs mkdir C:\lyrical-studio\logs'
ssh -i $KEY $HOST 'schtasks /create /f /tn LyricalPurgeStems /sc daily /st 04:00 /tr "cmd /c cd /d C:\lyrical-studio && set PYTHONUTF8=1&& set PYTHONIOENCODING=utf-8&& .venv\Scripts\python.exe scripts\purge_local_stems.py --days 30 --apply >> logs\purge_stems.log 2>&1"'
ssh -i $KEY $HOST 'schtasks /create /f /tn LyricalPurgeFailed /sc daily /st 04:10 /tr "cmd /c cd /d C:\lyrical-studio && set PYTHONUTF8=1&& set PYTHONIOENCODING=utf-8&& .venv\Scripts\python.exe scripts\purge_failed_assets.py --days 7 --apply >> logs\purge_failed.log 2>&1"'
```

Expected: exactly ONE `website_poll.py` line from `tasklist`. Then, over RustDesk on the console session, close every Explorer window and press Win+D so SynthV's desktop is clear.

- [ ] **Step 6: Heartbeat check** in Henry's Chrome: Supabase SQL editor `https://supabase.com/dashboard/project/hikvjnpkvnxibfzdnpig/sql/new`, run `select worker, seen_at, version from public.worker_heartbeat;`. Expected: `optiplex`, `seen_at` under a minute old, a 7-character version.

- [ ] **Step 7: One real omega job.** Submit a song at `https://lyrical-studio-omega.vercel.app/studio/new` with the licence box ticked (Henry, or you in his Chrome). Watch the poller: `schtasks /query /tn LyricalPoller /v /fo list` shows the `/tr` line and its log redirect; tail that file with `ssh -i $KEY $HOST 'powershell -c "Get-Content C:\lyrical-studio\logs\poller.log -Tail 20"'`. When `ran job -> run_id=` appears and the studio shows the track: download the MP3 from the studio's own download link (that is the Supabase `deliveries` object) to `C:\Users\User\Downloads\cover.mp3`, then on the desktop:

```bash
PYTHONUTF8=1 PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe scripts/detect_watermark.py /c/Users/User/Downloads/cover.mp3
ffprobe -v error -show_entries format_tags=comment,copyright -of json /c/Users/User/Downloads/cover.mp3
```

Expected: `probability>=0.900`, `message` equal to `select watermark_id from song_job_deliveries where job_id='<id>'` (SQL editor), both tags present. In the SQL editor: `select path, purged_at from song_job_assets where job_id='<id>'` shows both rows stamped; in Storage > `submissions` > `<user>/<id>` the folder is empty or gone. On the OptiPlex: `ssh -i $KEY $HOST 'dir C:\lyrical-studio\work\website\<id>'` still lists the two stems, `stems.json` and `cover.mp3`.

- [ ] **Step 8: One real re-roll.** Thumbs-down with a 20+ character note in the studio, click Re-roll. The child row appears as `pipeline_state='queued'` with `parent_job_id` set; the poller log shows `ran job -> run_id=<the parent's run id>`. Repeat Step 7's checks on the child: delivered, watermark found, a different `watermark_id`, no `song_job_assets` rows, "Take 2" in the studio, the parent's stems untouched.

### Task 9: Verification and PR

- [ ] **Step 1: Local suite**

```bash
PYTHONUTF8=1 PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -m pytest tests -q
PYTHONUTF8=1 PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -m pytest -m slow tests/dashboard/website/test_watermark_acceptance.py -q
cd dashboard/frontend && npm test && npm run build
```

- [ ] **Step 2: Em-dash sweep** `git diff main...feat/v2-pipeline | grep -n $'\u2014'` must print nothing.

- [ ] **Step 3: PR** into `main` of `Henrymcmahon1/lyrical-studio` titled "v2 pipeline: watermark, re-rolls, retention, heartbeat, Door-1 export". Body: the acceptance-test output from the OptiPlex, the proof job id and child id with their `detect_watermark.py` lines (no keys, no signed URLs), the two schtasks names. After merge: `ssh -i $KEY $HOST 'cd C:\lyrical-studio && git checkout -- . && git pull'` then Task 8 Step 5's restart again so the OptiPlex runs `main`.

## Done when

- `pytest tests -q` green locally; `test_watermark_acceptance.py` reports `2 passed` on the OptiPlex.
- A real omega job delivered an MP3 that `detect_watermark.py` decodes (probability ≥ 0.9, message equals `song_job_deliveries.watermark_id`), with ID3 `comment` and `copyright` set, its `submissions` objects gone, `purged_at` stamped, and the local stems still under `work/website/<job_id>/`.
- A real re-roll delivered "Take 2" as its own job, from the parent's stems, with its own watermark id.
- `worker_heartbeat.optiplex` updates every loop; `LyricalPurgeStems` and `LyricalPurgeFailed` are registered.
- "Export Door-1 stems" writes three 24-bit WAVs on a finished song.
- PR open into `main` of lyrical-studio from `feat/v2-pipeline`; exactly one poller running.
