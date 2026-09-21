# Bot E: Ops (backfill purge, Supabase plan, poller as a service, Vite customer-mode removal)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Paste this to start the session:**
> Read `docs/superpowers/specs/2026-09-22-two-doors-v2-design.md` then `docs/bots/BOT-E-ops.md` in `C:\Users\User\CascadeProjects\lyrical-website`. The code work is in `C:\Users\User\CascadeProjects\lyrical-studio` on branch `feat/v2-ops` off `main`. Never touch `main` of lyrical-website or lyricalglobal.com. Execute the brief task by task. The purge script runs `--apply` only after I have seen the dry-run list and said go. The Supabase plan check is read-only in my signed-in Chrome. One poller only.

**Goal:** The steady-state housekeeping for Door 2: a safe backfill purge of old `submissions` uploads, a read-only report of the Supabase plan, the OptiPlex poller running as a self-restarting logon task with rotated logs and a runbook, and the dead Vite customer mode removed from the staff dashboard.

**Architecture:** Everything lives in `lyrical-studio` (the pipeline repo). The purge script is a standalone `scripts/` tool that talks to PostgREST and the Storage REST API through `httpx` with its own tiny client (Bot F owns `dashboard/service/website/**`, so nothing there is edited). The poller stays exactly what it is (`scripts/website_poll.py --interval 30`); this brief only changes how Windows starts, restarts and logs it. The Vite customer mode is deleted outright: the Next site on omega is the only Door-2 front end.

**Tech Stack:** Python 3.13 (`httpx`, `python-dotenv`, pytest), Windows Task Scheduler (PowerShell `Register-ScheduledTask`), OpenSSH + scp to the OptiPlex, Vite + Vitest + TypeScript for the frontend removal, claude-in-chrome for the plan check.

**Spec:** `docs/superpowers/specs/2026-09-22-two-doors-v2-design.md` (§10 scope; §2 decision 4 on storage; §11, §12, §13 measurements).

## Global Constraints

- Repo `C:\Users\User\CascadeProjects\lyrical-studio`, branch `feat/v2-ops` off `main`, PR into `main`. Never touch `main` of `lyrical-website`, the `lyrical-website` Vercel project, or lyricalglobal.com. The only file written in `lyrical-website` is this brief (already done).
- No em dashes anywhere: code, comments, PowerShell, markdown, commit messages.
- Secrets are never printed, typed, echoed or committed. `WEBSITE_SUPABASE_URL` and `WEBSITE_SUPABASE_SERVICE_ROLE_KEY` (the `sb_secret_...` format) live in `lyrical-studio/.env` with double-quoted values; `python-dotenv` strips the quotes. Always `httpx` against PostgREST + Storage REST, never `supabase-py`.
- Windows Python: `PYTHONUTF8=1 PYTHONIOENCODING=utf-8` on every command. Interpreter `.venv\Scripts\python.exe` (3.13).
- **The live site's manual-funnel jobs are never purge candidates.** Measured 22 Sep: 22 `song_jobs` rows, 17 of them the live site's `submitted` jobs with `pipeline_state IS NULL`, 4 delivered, 1 in progress. The purge query is `pipeline_state=in.(delivered,failed)`, which cannot match a null, and the selector raises on any other state. `--apply` runs only after Henry has seen the dry-run list and said go.
- **One poller only.** The OptiPlex is primary; the AWS VM (`deploy/aws/`) is a cold standby and must not run `website_poll.py` at the same time (two pollers race for the same claim).
- **OptiPlex render PC:** `192.168.86.31`, user `henry`, key `C:\Users\User\.ssh\lyrical_render_pc` (Git Bash spelling `/c/Users/User/.ssh/lyrical_render_pc`). Repo `C:\lyrical-studio`, venv `.venv` (Python 3.13.7). Its `main` tracks `origin/render-main` and sits at `4fdfaf5`, behind the desktop's `main`: deploy this brief's files by `scp`, do not `git pull` there. The poller is the interactive scheduled task `LyricalPoller` (today it runs an untracked `C:\lyrical-studio\run_poll_loop.cmd` that detaches python with `Start-Process -WindowStyle Hidden`, logs in `C:\lyrical-studio\logs\poll_loop.log`). It must run inside Henry's console session because the SynthV automation drives a real desktop. Inline PowerShell over ssh from bash mangles `$_`: scp a `.ps1`, then `ssh ... 'powershell -NoProfile -ExecutionPolicy Bypass -File C:\path\script.ps1'`.
- Measured 22 Sep: Supabase storage 1.72 GB (submissions 1.33 GB / 57 files, voice-training 0.36 GB, deliveries 18 MB / 3 files, listen 16 MB); free tier limit 1 GB; Pro is $25/mo with 100 GB. OptiPlex C: 136 GB free, `work/` 0.68 GB.
- The old customer Vercel deployment (`lyrical-studio-hjam.vercel.app`, root `dashboard/frontend`) no longer builds this repo; omega (`lyrical-studio-omega.vercel.app`) tracks `lyrical-website@develop`. Nothing deploys from `lyrical-studio`, so the frontend removal has no deploy step.
- Verify before claiming done: `pytest -q` (pipeline), `npm test && npm run build` in `dashboard/frontend`, and the poller task observed Ready then running on the box.

## File structure

| File | Responsibility |
|---|---|
| `scripts/purge_supabase_backfill.py` | dry-run list / confirmed delete of old `submissions` objects; stamps `song_job_assets.purged_at` |
| `tests/dashboard/website/test_purge_backfill.py` | fake-client tests: manual-funnel exclusion, age rule, refusal without confirmation, delete + stamp |
| `deploy/render-pc/poller_launcher.ps1` | task action: one-poller guard, clear desktop, rotate logs, run the poller in the foreground with appended log |
| `deploy/render-pc/rotate_logs.ps1` | delete `logs\poller_*.log` older than 14 days |
| `deploy/render-pc/install_poller_task.ps1` | (re)creates `LyricalPoller` (logon, interactive, restart on failure) and `LyricalPollerLogRotate` (daily) |
| `deploy/render-pc/stop_poller.ps1` | end the task and any surviving `website_poll.py` |
| `deploy/render-pc/poller_status.ps1` | task state, process count, last log lines |
| `deploy/render-pc/kill_poller_process.ps1` | simulate a crash to prove restart on failure |
| `deploy/render-pc.md` | the runbook |
| `dashboard/frontend/**` | customer mode deleted; staff dashboard unchanged |

---

### Task 1: Branch

- [ ] **Step 1: Branch off main**

```bash
cd /c/Users/User/CascadeProjects/lyrical-studio && git checkout main && git pull && git checkout -b feat/v2-ops
```

If Bot F's `feat/v2-pipeline` is already merged, `main` carries `purged_at` handling in `WebsiteClient.delete_assets`; this brief does not depend on it (the migration `002` already added the column).

### Task 2: `scripts/purge_supabase_backfill.py`

**Files:**
- Create: `scripts/purge_supabase_backfill.py`, `tests/dashboard/website/test_purge_backfill.py`

**Interfaces:**
- `PurgeClient(url, key, http, bucket="submissions")` with `terminal_jobs()`, `unpurged_assets(job_ids)`, `delete_objects(paths)`, `stamp_purged(asset_ids, when)`.
- Pure: `finished_at(job)`, `select_candidates(jobs, assets, *, now, days) -> list[Candidate]`, `render(cands, *, days) -> str`, `apply(client, cands, *, now) -> int`.
- `main(argv=None, *, client=None, now=None, input_fn=input, out=sys.stdout) -> int` (0 ok, 3 aborted).

- [ ] **Step 1: Failing tests**

```python
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
import pytest

# scripts/ is not a package; import the tool by name like test_cli_smoke.py does.
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
import purge_supabase_backfill as purge  # noqa: E402

NOW = datetime(2026, 10, 22, tzinfo=timezone.utc)
OLD = (NOW - timedelta(days=40)).isoformat()
NEW = (NOW - timedelta(days=5)).isoformat()


class FakeClient:
    def __init__(self, jobs, assets):
        self.jobs, self.assets = jobs, assets
        self.deleted, self.stamped = [], []

    def terminal_jobs(self):
        return self.jobs

    def unpurged_assets(self, ids):
        return [a for a in self.assets if a["job_id"] in ids]

    def delete_objects(self, paths):
        self.deleted.append(list(paths))

    def stamp_purged(self, ids, when):
        self.stamped.append(list(ids))


def _job(i, state, **kw):
    row = {"id": f"j{i}", "user_id": "u1", "title": f"T{i}", "pipeline_state": state,
           "delivered_at": None, "created_at": OLD}
    row.update(kw)
    return row


def _asset(i, job, n=1_000_000):
    return {"id": f"a{i}", "job_id": job, "path": f"u1/{job}/f{i}.flac", "bytes": n}


def test_only_old_terminal_jobs_with_unpurged_assets_are_candidates():
    jobs = [_job(1, "delivered", delivered_at=OLD), _job(2, "delivered", delivered_at=NEW),
            _job(3, "failed", created_at=OLD), _job(4, "failed", created_at=NEW),
            _job(5, "delivered", delivered_at=OLD)]
    assets = [_asset(1, "j1"), _asset(2, "j2"), _asset(3, "j3"), _asset(4, "j4")]
    cands = purge.select_candidates(jobs, assets, now=NOW, days=30)
    assert [c.job_id for c in cands] == ["j1", "j3"]
    assert cands[0].bytes == 1_000_000


def test_manual_funnel_job_never_appears():
    with pytest.raises(ValueError, match="manual funnel"):
        purge.select_candidates([_job(9, None)], [], now=NOW, days=30)


def test_rest_query_excludes_null_state_by_construction():
    seen = {}

    def handler(req: httpx.Request) -> httpx.Response:
        seen["params"] = dict(req.url.params)
        return httpx.Response(200, json=[])

    c = purge.PurgeClient("https://x.supabase.co", "svc",
                          httpx.Client(transport=httpx.MockTransport(handler)))
    assert c.terminal_jobs() == []
    assert seen["params"]["pipeline_state"] == "in.(delivered,failed)"


def test_dry_run_is_the_default_and_deletes_nothing(capsys):
    c = FakeClient([_job(1, "delivered", delivered_at=OLD)], [_asset(1, "j1")])
    assert purge.main([], client=c, now=NOW) == 0
    assert c.deleted == [] and c.stamped == []
    assert "j1" in capsys.readouterr().out


def test_apply_refuses_without_the_typed_job_count():
    c = FakeClient([_job(1, "delivered", delivered_at=OLD)], [_asset(1, "j1")])
    assert purge.main(["--apply"], client=c, now=NOW, input_fn=lambda _p: "") == 3
    assert purge.main(["--apply"], client=c, now=NOW, input_fn=lambda _p: "yes") == 3
    assert c.deleted == [] and c.stamped == []


def test_apply_deletes_and_stamps_after_the_typed_count():
    c = FakeClient([_job(1, "delivered", delivered_at=OLD)], [_asset(1, "j1"), _asset(2, "j1")])
    assert purge.main(["--apply"], client=c, now=NOW, input_fn=lambda _p: "1") == 0
    assert c.deleted == [["u1/j1/f1.flac", "u1/j1/f2.flac"]]
    assert c.stamped == [["a1", "a2"]]
```

- [ ] **Step 2: Run, expect FAIL** (module not found)

```bash
cd /c/Users/User/CascadeProjects/lyrical-studio && PYTHONUTF8=1 .venv/Scripts/python.exe -m pytest -q tests/dashboard/website/test_purge_backfill.py
```

- [ ] **Step 3: Implement `scripts/purge_supabase_backfill.py`**

```python
"""Backfill purge: delete old 'submissions' uploads for jobs the pipeline is
finished with (pipeline_state 'delivered' or 'failed') and stamp
song_job_assets.purged_at. Supabase is transit, not archive (spec §2 decision 4).

Manual-funnel jobs (the live site's real clients, pipeline_state IS NULL) are
never candidates: the PostgREST filter pipeline_state=in.(delivered,failed)
cannot match a null, and select_candidates() raises on any other state.

    PYTHONUTF8=1 PYTHONIOENCODING=utf-8 .venv\\Scripts\\python.exe scripts\\purge_supabase_backfill.py --dry-run --days 30
    ... --apply --days 30   (prints the list, then the operator types the job count; else exit 3, nothing deleted)

Env from the repo-root .env (double-quoted values): WEBSITE_SUPABASE_URL,
WEBSITE_SUPABASE_SERVICE_ROLE_KEY, optional WEBSITE_SUBMISSIONS_BUCKET. httpx
against PostgREST + Storage REST, never supabase-py. Does not import
dashboard.service.website (Bot F owns that package).
"""
from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

TERMINAL_STATES = ("delivered", "failed")


@dataclass(frozen=True)
class Candidate:
    job_id: str
    user_id: str
    title: str
    pipeline_state: str
    finished_at: datetime
    assets: tuple  # dicts with id, job_id, path, bytes

    @property
    def bytes(self) -> int:
        return sum(int(a.get("bytes") or 0) for a in self.assets)


class PurgeClient:
    """PostgREST + Storage REST with the service-role key. Same URL and header
    shapes as WebsiteClient, kept local because Bot F owns that package."""

    def __init__(self, url: str, key: str, http, bucket: str = "submissions") -> None:
        base = url.rstrip("/")
        self._rest = f"{base}/rest/v1"
        self._storage = f"{base}/storage/v1/object"
        self._bucket = bucket
        self._http = http
        self._headers = {"apikey": key, "Authorization": f"Bearer {key}"}

    def terminal_jobs(self) -> list[dict]:
        r = self._http.get(
            f"{self._rest}/song_jobs",
            params={
                "pipeline_state": f"in.({','.join(TERMINAL_STATES)})",
                "select": "id,user_id,title,pipeline_state,delivered_at,created_at",
                "order": "created_at.asc",
            },
            headers=self._headers,
        )
        r.raise_for_status()
        return r.json()

    def unpurged_assets(self, job_ids: list[str]) -> list[dict]:
        if not job_ids:
            return []
        r = self._http.get(
            f"{self._rest}/song_job_assets",
            params={
                "job_id": f"in.({','.join(job_ids)})",
                "purged_at": "is.null",
                "select": "id,job_id,path,bytes",
            },
            headers=self._headers,
        )
        r.raise_for_status()
        return r.json()

    def delete_objects(self, paths: list[str]) -> None:
        r = self._http.request(
            "DELETE", f"{self._storage}/{self._bucket}",
            headers={**self._headers, "Content-Type": "application/json"},
            json={"prefixes": list(paths)},
        )
        r.raise_for_status()

    def stamp_purged(self, asset_ids: list[str], when: datetime) -> None:
        r = self._http.patch(
            f"{self._rest}/song_job_assets",
            params={"id": f"in.({','.join(asset_ids)})"},
            headers={**self._headers, "Content-Type": "application/json"},
            json={"purged_at": when.isoformat()},
        )
        r.raise_for_status()


def _parse_ts(value: str) -> datetime:
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def finished_at(job: dict) -> datetime:
    """delivered -> delivered_at (created_at if the stamp is missing); failed -> created_at.
    Anything else raises: a null state is the live site's manual funnel."""
    state = job.get("pipeline_state")
    if state == "delivered":
        return _parse_ts(job.get("delivered_at") or job["created_at"])
    if state == "failed":
        return _parse_ts(job["created_at"])
    raise ValueError(
        f"job {job.get('id')} has pipeline_state={state!r}; only {TERMINAL_STATES} "
        f"are ever purge candidates (null = manual funnel, never purged)"
    )


def select_candidates(jobs: list[dict], assets: list[dict], *, now: datetime, days: int) -> list[Candidate]:
    cutoff = now - timedelta(days=days)
    by_job: dict[str, list[dict]] = {}
    for a in assets:
        by_job.setdefault(a["job_id"], []).append(a)
    out: list[Candidate] = []
    for job in jobs:
        done = finished_at(job)
        if done > cutoff:
            continue
        mine = by_job.get(job["id"], [])
        if not mine:
            continue
        out.append(Candidate(job["id"], job["user_id"], job.get("title") or "",
                             job["pipeline_state"], done, tuple(mine)))
    return out


def render(cands: list[Candidate], *, days: int) -> str:
    lines = [f"purge candidates: {len(cands)} job(s) finished more than {days} days ago "
             f"(pipeline_state in {TERMINAL_STATES}; manual-funnel rows excluded by query)"]
    for c in cands:
        lines.append(f"- {c.job_id}  {c.pipeline_state:<9} {c.finished_at:%Y-%m-%d}  "
                     f"{c.bytes / 1e6:8.1f} MB  {len(c.assets)} file(s)  {c.title!r}")
        for a in c.assets:
            lines.append(f"    {a['path']}  ({int(a.get('bytes') or 0) / 1e6:.1f} MB)")
    lines.append(f"total: {sum(c.bytes for c in cands) / 1e6:.1f} MB")
    return "\n".join(lines)


def apply(client, cands: list[Candidate], *, now: datetime) -> int:
    freed = 0
    for c in cands:
        client.delete_objects([a["path"] for a in c.assets])
        client.stamp_purged([a["id"] for a in c.assets], now)
        freed += c.bytes
    return freed


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Purge old submissions uploads for delivered/failed jobs.")
    mode = p.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="list only (the default)")
    mode.add_argument("--apply", action="store_true", help="delete after a typed confirmation")
    p.add_argument("--days", type=int, default=30, help="age threshold in days (default 30)")
    return p


def _client_from_env() -> PurgeClient:
    import httpx
    from dotenv import load_dotenv
    load_dotenv(str(Path(__file__).resolve().parents[1] / ".env"))
    return PurgeClient(
        os.environ["WEBSITE_SUPABASE_URL"],
        os.environ["WEBSITE_SUPABASE_SERVICE_ROLE_KEY"],
        httpx.Client(timeout=60.0),
        os.environ.get("WEBSITE_SUBMISSIONS_BUCKET", "submissions"),
    )


def main(argv=None, *, client=None, now=None, input_fn=input, out=sys.stdout) -> int:
    args = build_parser().parse_args(argv)
    now = now or datetime.now(timezone.utc)
    client = client or _client_from_env()

    jobs = client.terminal_jobs()
    assets = client.unpurged_assets([j["id"] for j in jobs])
    cands = select_candidates(jobs, assets, now=now, days=args.days)
    print(render(cands, days=args.days), file=out)

    if not args.apply:
        print("dry run: nothing deleted (add --apply to purge)", file=out)
        return 0
    if not cands:
        print("nothing to purge", file=out)
        return 0
    typed = input_fn(f"Type the job count ({len(cands)}) to delete these objects; anything else aborts: ")
    if typed.strip() != str(len(cands)):
        print("aborted: confirmation did not match, nothing deleted", file=out)
        return 3
    freed = apply(client, cands, now=now)
    print(f"purged {len(cands)} job(s), {freed / 1e6:.1f} MB freed, purged_at stamped", file=out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: Run, expect PASS**, then the real dry run against the live project (read-only):

```bash
cd /c/Users/User/CascadeProjects/lyrical-studio && PYTHONUTF8=1 PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe scripts/purge_supabase_backfill.py --dry-run --days 30
```

Expected today: `purge candidates: 0 job(s)` (the delivered jobs are from 21 Sep). Save the output for the report. Do not run `--apply` in this task.

- [ ] **Step 5: Commit**

```bash
git add scripts/purge_supabase_backfill.py tests/dashboard/website/test_purge_backfill.py && git commit -m "ops: backfill purge of old submissions uploads (dry-run default, typed confirmation)"
```

### Task 3: Supabase plan check (read-only, Henry's Chrome)

**Files:** none changed. This task drives the browser and produces one line for the report.

- [ ] **Step 1: Load the Chrome tools**

ToolSearch: `select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__get_page_text,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__find,mcp__claude-in-chrome__tabs_create_mcp`

- [ ] **Step 2: Open billing**

`tabs_create_mcp`, then `navigate` to `https://supabase.com/dashboard/project/hikvjnpkvnxibfzdnpig/settings/billing`. If the page is a sign-in form, stop and tell Henry: never enter credentials. The billing page may redirect to the organization's billing URL; that is fine, read it there.

- [ ] **Step 3: Read, change nothing**

`get_page_text`, then `find "plan"` and `find "storage"`. Record: the plan name (Free or Pro), the storage figure the page shows, and any "exceeds" / "grace period" / "restricted" wording. Click nothing that says Upgrade, Change plan, or Confirm. Compare with the 22 Sep measurement (1.72 GB against the 1 GB free limit; Pro is $25/mo with 100 GB) and write one sentence for the report, for example: `Supabase: plan = Free, page shows 1.7 GB storage over the 1 GB limit, wording: "grace period". Recommend Pro $25/mo.` That is Henry's decision (spec §14 item 4); do not change billing.

### Task 4: Poller as a service

**Files:**
- Create: `deploy/render-pc/poller_launcher.ps1`, `rotate_logs.ps1`, `install_poller_task.ps1`, `stop_poller.ps1`, `poller_status.ps1`, `kill_poller_process.ps1`

The current task runs an untracked `.cmd` that detaches python, so Task Scheduler never sees the poller die and cannot restart it. The new launcher runs the poller in the foreground (hidden window) and exits with python's exit code, so `RestartCount 3 / RestartInterval 1 min` works. Logs are appended per day, rotated at 14 days.

- [ ] **Step 1: `deploy/render-pc/poller_launcher.ps1`**

```powershell
# Task action for LyricalPoller. Runs inside Henry's console session (the SynthV
# automation needs a real desktop). Guards against a second poller, clears the
# desktop, rotates logs, then runs website_poll.py in the FOREGROUND so Task
# Scheduler sees its exit code and restarts it on failure.
$ErrorActionPreference = 'Stop'
$Repo = 'C:\lyrical-studio'
$Logs = Join-Path $Repo 'logs'
if (-not (Test-Path $Logs)) { New-Item -ItemType Directory -Path $Logs | Out-Null }
$launcherLog = Join-Path $Logs 'launcher.log'

# One poller only.
$running = @(Get-CimInstance Win32_Process -Filter "Name = 'python.exe'" |
    Where-Object { $_.CommandLine -like '*website_poll.py*' })
if ($running.Count -gt 0) {
    Add-Content -Path $launcherLog -Value "$(Get-Date -Format s) refused: poller already running (pid $($running[0].ProcessId))"
    exit 0
}

# Clear the desktop before SynthV: a stray window over SynthV breaks the
# picture-match automation (memory: synthv-recovery-false-positive).
$sh = New-Object -ComObject Shell.Application
foreach ($w in @($sh.Windows())) { try { $w.Quit() } catch {} }
try { $sh.MinimizeAll() } catch {}

& (Join-Path $PSScriptRoot 'rotate_logs.ps1')

$env:PYTHONUTF8 = '1'
$env:PYTHONIOENCODING = 'utf-8'
$log = Join-Path $Logs ('poller_{0}.log' -f (Get-Date -Format yyyyMMdd))
Add-Content -Path $launcherLog -Value "$(Get-Date -Format s) starting website_poll.py --interval 30 -> $log"

# cmd's >> appends; Start-Process -RedirectStandardOutput would truncate. No
# spaces in any path, so no inner quoting is needed.
$cmdLine = '/c {0}\.venv\Scripts\python.exe scripts\website_poll.py --interval 30 >> {1} 2>&1' -f $Repo, $log
$p = Start-Process -FilePath 'cmd.exe' -ArgumentList $cmdLine -WorkingDirectory $Repo `
    -WindowStyle Hidden -PassThru -Wait
Add-Content -Path $launcherLog -Value "$(Get-Date -Format s) poller exited with code $($p.ExitCode)"
exit $p.ExitCode
```

- [ ] **Step 2: `deploy/render-pc/rotate_logs.ps1`**

```powershell
# Delete poller logs older than 14 days. Called by poller_launcher.ps1 at every
# start and by the daily LyricalPollerLogRotate task.
$Logs = 'C:\lyrical-studio\logs'
if (-not (Test-Path $Logs)) { exit 0 }
$cutoff = (Get-Date).AddDays(-14)
Get-ChildItem -Path $Logs -Filter 'poller_*.log' -File |
    Where-Object { $_.LastWriteTime -lt $cutoff } |
    ForEach-Object {
        Remove-Item -Path $_.FullName -Force
        Add-Content -Path (Join-Path $Logs 'launcher.log') -Value "$(Get-Date -Format s) rotated $($_.Name)"
    }
```

- [ ] **Step 3: `deploy/render-pc/install_poller_task.ps1`**

```powershell
# (Re)create the LyricalPoller task on the render PC. Run ON the box, elevated
# (an ssh session as henry is elevated on Windows OpenSSH):
#   powershell -NoProfile -ExecutionPolicy Bypass -File C:\lyrical-studio\deploy\render-pc\install_poller_task.ps1
$ErrorActionPreference = 'Stop'
$Repo = 'C:\lyrical-studio'
$Launcher = Join-Path $Repo 'deploy\render-pc\poller_launcher.ps1'
$Rotate = Join-Path $Repo 'deploy\render-pc\rotate_logs.ps1'
if (-not (Test-Path $Launcher)) { throw "missing $Launcher (scp deploy\render-pc first)" }
if (-not (Test-Path $Rotate)) { throw "missing $Rotate (scp deploy\render-pc first)" }
$User = "$env:COMPUTERNAME\Henry"

# Interactive logon token (the schtasks /it equivalent) so the poller lives in
# the console session where SynthV runs. Restart on failure 3 times, 1 minute
# apart. ExecutionTimeLimit 0 = unlimited (the default kills a task after 3 days).
$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$Launcher`"" `
    -WorkingDirectory $Repo
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $User
$trigger.Delay = 'PT1M'
$principal = New-ScheduledTaskPrincipal -UserId $User -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
    -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Seconds 0) `
    -MultipleInstances IgnoreNew `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName 'LyricalPoller' -Action $action -Trigger $trigger `
    -Principal $principal -Settings $settings -Force | Out-Null

$rotateAction = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$Rotate`""
$rotateTrigger = New-ScheduledTaskTrigger -Daily -At 03:30
$rotateSettings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
Register-ScheduledTask -TaskName 'LyricalPollerLogRotate' -Action $rotateAction -Trigger $rotateTrigger `
    -Principal $principal -Settings $rotateSettings -Force | Out-Null

Get-ScheduledTask -TaskName 'LyricalPoller', 'LyricalPollerLogRotate' | Format-Table TaskName, State -AutoSize
```

- [ ] **Step 4: `deploy/render-pc/stop_poller.ps1` and `deploy/render-pc/poller_status.ps1`**

```powershell
# stop_poller.ps1: end the task, then kill any website_poll.py that outlived it.
schtasks /end /tn LyricalPoller | Out-Null
Get-CimInstance Win32_Process -Filter "Name = 'python.exe'" |
    Where-Object { $_.CommandLine -like '*website_poll.py*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force; "stopped pid $($_.ProcessId)" }
"poller stopped"
```

```powershell
# poller_status.ps1: task state, process count (must be 0 or 1), last log lines.
schtasks /query /tn LyricalPoller /fo list | Select-String 'Status|Last Run|Next Run|Last Result'
$procs = @(Get-CimInstance Win32_Process -Filter "Name = 'python.exe'" |
    Where-Object { $_.CommandLine -like '*website_poll.py*' })
"poller processes: $($procs.Count)"
$log = Get-ChildItem 'C:\lyrical-studio\logs\poller_*.log' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime | Select-Object -Last 1
if ($log) { "latest log: $($log.FullName)"; Get-Content $log.FullName -Tail 5 }
Get-Content 'C:\lyrical-studio\logs\launcher.log' -Tail 3 -ErrorAction SilentlyContinue
```

- [ ] **Step 5: Deploy to the box and install**

```bash
KEY=/c/Users/User/.ssh/lyrical_render_pc; BOX=henry@192.168.86.31
cd /c/Users/User/CascadeProjects/lyrical-studio
ssh -i $KEY $BOX 'if not exist C:\lyrical-studio\deploy\render-pc mkdir C:\lyrical-studio\deploy\render-pc'
scp -i $KEY deploy/render-pc/*.ps1 "$BOX:C:/lyrical-studio/deploy/render-pc/"
ssh -i $KEY $BOX 'powershell -NoProfile -ExecutionPolicy Bypass -File C:\lyrical-studio\deploy\render-pc\stop_poller.ps1'
ssh -i $KEY $BOX 'powershell -NoProfile -ExecutionPolicy Bypass -File C:\lyrical-studio\deploy\render-pc\install_poller_task.ps1'
```

Expected: both tasks listed with State `Ready`. If `Register-ScheduledTask` reports access denied, the ssh session is not elevated: tell Henry to run the install line in an elevated PowerShell on the box.

- [ ] **Step 6: Start it and verify**

```bash
ssh -i $KEY $BOX 'schtasks /run /tn LyricalPoller'
sleep 75
ssh -i $KEY $BOX 'powershell -NoProfile -ExecutionPolicy Bypass -File C:\lyrical-studio\deploy\render-pc\poller_status.ps1'
```

Expected: `Status: Running`, `poller processes: 1`, the log tail shows `polling every 30.0s (Ctrl+C to stop)` and at least one `no queued job`. Then the heartbeat (Bot F adds it; the row appears only if `feat/v2-pipeline` is merged and deployed to the box):

```bash
cd /c/Users/User/CascadeProjects/lyrical-studio && PYTHONUTF8=1 .venv/Scripts/python.exe - <<'EOF'
import os, httpx
from dotenv import load_dotenv
load_dotenv(".env")
url = os.environ["WEBSITE_SUPABASE_URL"].rstrip("/")
key = os.environ["WEBSITE_SUPABASE_SERVICE_ROLE_KEY"]
r = httpx.get(f"{url}/rest/v1/worker_heartbeat", params={"select": "worker,seen_at,version"},
              headers={"apikey": key, "Authorization": f"Bearer {key}"}, timeout=30)
print(r.status_code, r.text[:300])
EOF
```

Expected: `200 [{"worker":"optiplex","seen_at":"<within the last 60 s>",...}]`. A `404` or `[]` means Bot F's heartbeat is not on the box yet; the `no queued job` log line is then the verification, say so in the report.

- [ ] **Step 7: Prove restart on failure**

Write `deploy/render-pc/kill_poller_process.ps1` (kills python only, leaves the task alive so Task Scheduler sees a failure), scp it with the others, run it, wait, check:

```powershell
# kill_poller_process.ps1: simulate a poller crash. The task must restart it within ~1 minute.
Get-CimInstance Win32_Process -Filter "Name = 'python.exe'" |
    Where-Object { $_.CommandLine -like '*website_poll.py*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force; "killed pid $($_.ProcessId)" }
```

```bash
ssh -i $KEY $BOX 'powershell -NoProfile -ExecutionPolicy Bypass -File C:\lyrical-studio\deploy\render-pc\kill_poller_process.ps1'
sleep 90
ssh -i $KEY $BOX 'powershell -NoProfile -ExecutionPolicy Bypass -File C:\lyrical-studio\deploy\render-pc\poller_status.ps1'
```

Expected: `poller processes: 1` and a fresh `starting website_poll.py` line in `launcher.log` after the `poller exited with code` line. If it did not restart, `schtasks /run /tn LyricalPoller`, record it under "Known gaps" in the runbook, and continue.

- [ ] **Step 8: Retire the old launcher on the box (only after Step 6 passed)**

```bash
ssh -i $KEY $BOX 'ren C:\lyrical-studio\run_poll_loop.cmd run_poll_loop.cmd.retired-2026-09 && ren C:\lyrical-studio\run_poll_once.cmd run_poll_once.cmd.retired-2026-09'
```

- [ ] **Step 9: Commit**

```bash
git add deploy/render-pc && git commit -m "ops: LyricalPoller as a restart-on-failure logon task with rotated logs"
```

### Task 5: Runbook `deploy/render-pc.md`

**Files:** Create `deploy/render-pc.md`. Link it from `README.md` under Setup next to the RustDesk line: `- Running the website poller on the render PC: [deploy/render-pc.md](deploy/render-pc.md).`

- [ ] **Step 1: Write the runbook** (fill the two verification timestamps from Task 4; everything else is final):

```markdown
# Render PC (OptiPlex) runbook

The always-on box that renders Door-2 jobs. One poller, here, and nowhere else.

| Item | Value |
|---|---|
| Host | `192.168.86.31` (LAN) or RustDesk `49 289 125` (see `deploy/remote-access/README.md`) |
| SSH | `ssh -i /c/Users/User/.ssh/lyrical_render_pc henry@192.168.86.31` (Git Bash spelling of `C:\Users\User\.ssh\lyrical_render_pc`) |
| Repo | `C:\lyrical-studio`, venv `.venv` (Python 3.13). Its `main` tracks `origin/render-main`; deploy files by scp, do not pull blindly |
| Secrets | `C:\lyrical-studio\.env` (double-quoted values). Never print it |
| Task | `LyricalPoller`: at logon of Henry, interactive token, restart on failure 3x / 1 min, no time limit |
| Log rotation | `LyricalPollerLogRotate` daily 03:30 plus at every poller start; 14 days kept |
| Logs | `C:\lyrical-studio\logs\poller_YYYYMMDD.log` (poller stdout+stderr), `logs\launcher.log` (starts, exits, refusals, rotations) |
| Local state | `C:\lyrical-studio\lyrical.sqlite` (`stage_runs` and the job queue; `LYRICAL_DB_PATH`), `C:\lyrical-studio\work\website\<job_id>\` (downloaded stems, kept 30 days for re-rolls) |
| Standby | AWS VM per `deploy/aws/README.md`, cold. Never run both pollers: two pollers race for the same `claim()` |

## Windows PowerShell over ssh

Inline PowerShell from bash mangles `$_`. Put the commands in a `.ps1`, `scp` it to `henry@192.168.86.31:C:/Users/Henry/thing.ps1`, then `ssh ... 'powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\Henry\thing.ps1'`. The scripts below already live on the box under `C:\lyrical-studio\deploy\render-pc\`.

## Poller: start, stop, inspect

| Do | Command (over ssh, or in PowerShell on the box) |
|---|---|
| Status | `powershell -NoProfile -ExecutionPolicy Bypass -File C:\lyrical-studio\deploy\render-pc\poller_status.ps1` |
| Start | `schtasks /run /tn LyricalPoller` |
| Stop | `powershell -NoProfile -ExecutionPolicy Bypass -File C:\lyrical-studio\deploy\render-pc\stop_poller.ps1` |
| Restart after a deploy | Stop, then Start |
| Reinstall the task | `powershell -NoProfile -ExecutionPolicy Bypass -File C:\lyrical-studio\deploy\render-pc\install_poller_task.ps1` |
| Tail today's log | `powershell -NoProfile -Command "Get-Content (Get-ChildItem C:\lyrical-studio\logs\poller_*.log | Sort-Object LastWriteTime | Select-Object -Last 1).FullName -Tail 40"` |

Healthy looks like: `Status: Running`, `poller processes: 1`, `no queued job` every 30 s, and (once Bot F's heartbeat is deployed) a fresh `worker_heartbeat` row for `optiplex`.

## Before a SynthV render: clear the desktop

The launcher closes Explorer windows and minimises everything at start. If a render fails with "Auto Recovery would not close", a stray window sat over SynthV (memory `synthv-recovery-false-positive`): close it via RustDesk, then re-queue the job. SynthV Studio 2 Pro must be installed and activated on the box, display 1920x1080 at 100%.

## Re-queue a job

    cd /d C:\lyrical-studio && set PYTHONUTF8=1 && set PYTHONIOENCODING=utf-8 && .venv\Scripts\python.exe scripts\requeue_job.py <job_id>

Sets `pipeline_state='queued'`, clears `pipeline_error` and `quota_consumed_at`. The running poller picks it up on its next loop. For a re-roll child whose parent stems are gone from `work\website\<parent_id>\`, the job fails with `stems_expired` by design; the customer makes the song again.

## Deploy pipeline changes

1. `scp -i /c/Users/User/.ssh/lyrical_render_pc <files> henry@192.168.86.31:C:/lyrical-studio/<path>/` (or `git pull` on the box once its tracking branch is `origin/main`).
2. New Python deps: `ssh ... 'cd /d C:\lyrical-studio && .venv\Scripts\pip.exe install -r requirements.txt'`.
3. Stop, Start (table above), watch for `polling every 30.0s`, then run one real omega job.

## Housekeeping

- Supabase uploads: `scripts/purge_supabase_backfill.py --dry-run --days 30` on the desktop, Henry says go, then `--apply`.
- Local stems (Bot F): `scripts/purge_local_stems.py --days 30`, daily task on the box. Disk 22 Sep: C: 136 GB free, `work\` 0.68 GB.

## Known gaps

- Restart-on-failure verified <date/time from Task 4 Step 7, or "not observed, see note">.
- The box's `main` tracks `origin/render-main` and is behind desktop `main`; align it when Bot F deploys.
```

- [ ] **Step 2: Commit**

```bash
git add deploy/render-pc.md README.md && git commit -m "docs(deploy): render PC runbook (poller, logs, re-queue, one-poller rule)"
```

### Task 6: Remove the Vite customer mode

**Files:**
- Delete: `dashboard/frontend/src/mode.ts`, `src/features/songCreation/CustomerCreationPage.tsx`, `CustomerCreationForm.tsx`, `CustomerCreationForm.test.tsx`, `src/features/songsLibrary/CustomerLibrary.tsx`, `CustomerLibrary.test.tsx`, `CustomerSongDetail.tsx`, `CustomerSongDetail.test.tsx`, `mapping.ts`, `mapping.test.ts`, `src/entitlement/` (all), `src/auth/` (all), `src/supabase/` (all), `src/submit/` (all), `src/components/Door1Lock.tsx`, `Door1Lock.test.tsx`, `api/submit.ts`, `dev-api.ts`, `tsconfig.api.json`, `vercel.json`
- Edit: `src/App.tsx`, `src/features/registry.ts`, `vite.config.ts`, `src/test/smoke.test.tsx`, `src/components/shell.test.tsx`, `package.json`, `docs/WEB-STUDIO-DEPLOY-2026-09-10.md`, `docs/WEB-STUDIO-HANDOVER-MASTER-2026-09-17.md`

`mapping.ts`, `auth/`, `supabase/`, `submit/` and `Door1Lock` exist only for the customer mode (`mapping` imports `SongRow` from `supabase/data`; `submit/core` imports `entitlement/quota`); the staff `Library`, `SongCard`, `SongDetail` do not import any of them. `dashboard/frontend/.env.local` (gitignored, holds the old anon values) can be deleted locally; never print it.

- [ ] **Step 1: Delete**

```bash
cd /c/Users/User/CascadeProjects/lyrical-studio/dashboard/frontend
git rm -r src/mode.ts src/entitlement src/auth src/supabase src/submit api dev-api.ts tsconfig.api.json vercel.json \
  src/features/songCreation/CustomerCreationPage.tsx src/features/songCreation/CustomerCreationForm.tsx src/features/songCreation/CustomerCreationForm.test.tsx \
  src/features/songsLibrary/CustomerLibrary.tsx src/features/songsLibrary/CustomerLibrary.test.tsx src/features/songsLibrary/CustomerSongDetail.tsx src/features/songsLibrary/CustomerSongDetail.test.tsx \
  src/features/songsLibrary/mapping.ts src/features/songsLibrary/mapping.test.ts src/components/Door1Lock.tsx src/components/Door1Lock.test.tsx
```

- [ ] **Step 2: `src/App.tsx`** becomes:

```tsx
import { BrowserRouter } from "react-router-dom";
import { AppShell } from "./components/AppShell";

// The staff studio: the local control room started by dashboard/run.ps1, on the
// render PC, LAN only. The customer product is the Next site (lyrical-website).
export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
```

- [ ] **Step 3: `src/features/registry.ts`**: delete the `CustomerCreationPage`, `CustomerLibrary` and `CUSTOMER_MODE` imports, the two-line comment above them, and the `CreatePage` / `SongsPage` constants; the two tab entries become `element: createElement(SongCreationPage)` and `element: createElement(Library)`.

- [ ] **Step 4: `vite.config.ts`**:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Everything under /api and /files goes to the staff FastAPI backend.
      "/api": {
        target: "http://localhost:8000",
        ws: true,
      },
      "/files": {
        target: "http://localhost:8000",
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
```

- [ ] **Step 5: Tests that mocked customer modules**

In `src/test/smoke.test.tsx` delete the `vi.mock("../supabase/client", ...)` and `vi.mock("../supabase/data", ...)` blocks and the "App is auth-gated now" comment; rename the two `it` titles to `"renders the app title"` and `"renders the Lyrical brand mark"`. In `src/components/shell.test.tsx` delete the `vi.mock("../supabase/data", ...)` block and the sentence "The Songs tab mounts the customer library, which reads from Supabase." from the comment above it. Keep every `api/client` mock.

- [ ] **Step 6: Dependencies and leftovers**

```bash
npm uninstall @supabase/supabase-js @aws-sdk/client-ec2 @vercel/node
grep -rn "CUSTOMER_MODE\|VITE_SUPABASE\|entitlement\|supabase\|dev-api\|Door1Lock\|submitCover" src vite.config.ts package.json index.html
```

Expected: no matches. Fix anything that appears before moving on.

- [ ] **Step 7: Mark the old deploy docs superseded** (one line at the top of each, below the title):

`docs/WEB-STUDIO-DEPLOY-2026-09-10.md` and `docs/WEB-STUDIO-HANDOVER-MASTER-2026-09-17.md`: `> Superseded 22 Sep 2026: the Vite customer mode was removed (Bot E). The Door-2 product is the Next site in lyrical-website (omega tracks develop). This file is history.`

- [ ] **Step 8: Green, then commit**

```bash
cd /c/Users/User/CascadeProjects/lyrical-studio/dashboard/frontend && npm test && npm run build
cd /c/Users/User/CascadeProjects/lyrical-studio && git add -A dashboard/frontend docs/WEB-STUDIO-DEPLOY-2026-09-10.md docs/WEB-STUDIO-HANDOVER-MASTER-2026-09-17.md && git commit -m "studio: remove the Vite customer mode (the Next site is the only Door-2 front end)"
```

Expected: `vitest run` all green with the customer suites gone (roughly 56 fewer tests), `tsc && vite build` clean.

### Task 7: Verification, PR, report

- [ ] **Step 1: Full pipeline tests**

```bash
cd /c/Users/User/CascadeProjects/lyrical-studio && PYTHONUTF8=1 PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -m pytest -q
```

- [ ] **Step 2: Push and PR into `main` of lyrical-studio**

```bash
git push -u origin feat/v2-ops
gh pr create --base main --head feat/v2-ops --title "v2 ops: backfill purge, poller as a service, Vite customer mode removed" --body "Spec §10. Purge script (dry-run default, typed confirmation, manual-funnel rows excluded by query). LyricalPoller reinstalled on the OptiPlex: logon trigger, interactive, restart on failure 3x/1min, logs rotated 14 days, runbook deploy/render-pc.md. Vite customer mode deleted; npm test + build green; pytest green. Nothing deploys from this repo (omega tracks lyrical-website@develop)."
```

- [ ] **Step 3: Report to Henry** (chat, short, one table, no secrets):

| Item | State |
|---|---|
| Purge dry run (`--days 30`) | N candidate jobs, X MB (paste the list; today expected 0). Awaiting "go" before `--apply` |
| Supabase plan | the one sentence from Task 3 |
| LyricalPoller | Ready, running as of `<time Melbourne>`, 1 process, restart-on-failure observed / not observed, heartbeat row seen / log line seen |
| Vite customer mode | removed, frontend tests + build green |
| PR | link, into `main` of lyrical-studio |

Then ask, as a multiple-choice question: run `--apply` now on the listed jobs, or wait.

## Done when

- `tests/dashboard/website/test_purge_backfill.py` passes and the live dry run printed a list Henry has seen.
- The Supabase plan sentence is in the report; billing untouched.
- `schtasks /query /tn LyricalPoller` shows Ready or Running on the OptiPlex, `poller_status.ps1` shows exactly one poller process, and a `poller_YYYYMMDD.log` is being appended.
- `deploy/render-pc.md` exists and is linked from `README.md`.
- `dashboard/frontend`: no `CUSTOMER_MODE`, `supabase`, `entitlement` or `dev-api` references; `npm test && npm run build` green.
- `pytest -q` green; PR open into `main` of lyrical-studio.
