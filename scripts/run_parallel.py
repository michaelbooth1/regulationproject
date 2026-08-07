"""Run the one-episode pipeline on many episodes in parallel.

Splits the pending episodes (optionally from --start) into N disjoint,
contiguous-by-index ranges, launches one worker subprocess per range, and
waits. Each worker processes its own range exclusively — no two workers ever
touch the same episode — so shared files (data/catalog.json, the transcript
dir, data/tmp) are only touched via per-episode names + an exclusive lock.

Resumes naturally: any episode left pending/error on a later run is re-picked.

Usage:
    python scripts/run_parallel.py --workers 5 --start 77
"""
import argparse
import json
import os
import subprocess
import sys
import threading
import time
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PY = ROOT / ".venv" / "Scripts" / "python.exe"
if not PY.exists():
    PY = Path(sys.executable)
CATALOG = ROOT / "data" / "catalog.json"
TRANSCRIBE = ROOT / "scripts" / "transcribe_episode.py"
LOG_DIR = ROOT / "data" / "tmp"


def load_catalog():
    return json.loads(CATALOG.read_text(encoding="utf-8"))


def pending_indexes(start):
    cat = load_catalog()
    idxs = [ep["index"] for ep in cat["episodes"]
            if ep["status"] in ("pending", "error")
            and (start is None or ep["index"] >= start)]
    return sorted(idxs)


def reset_stale_claims():
    """Any episode marked transcribing/downloading was owned by a worker that is
    gone now (e.g. a killed orchestrator). Reclaim them as pending, guarded by the
    catalog lock so they cannot collide with a live worker."""
    import msvcrt
    lock = ROOT / "data" / "tmp" / "catalog.lock"
    ROOT.joinpath("data", "tmp").mkdir(parents=True, exist_ok=True)
    fd = os.open(str(lock), os.O_RDWR | os.O_CREAT)
    try:
        while True:
            try:
                msvcrt.locking(fd, msvcrt.LK_NBLCK, 1)
                break
            except OSError:
                time.sleep(0.05)
        try:
            cat = load_catalog()
            for ep in cat["episodes"]:
                if ep["status"] in ("downloading", "transcribing") and not ep.get("transcript_path"):
                    ep["status"] = "pending"
                    ep["error"] = None
            CATALOG.write_text(json.dumps(cat, indent=2, ensure_ascii=False), encoding="utf-8")
        finally:
            msvcrt.locking(fd, msvcrt.LK_UNLCK, 1)
            os.close(fd)
    except Exception as e:
        print(f"warning: reset_stale_claims failed: {e}")


def split_contiguous_ranges(idxs, workers):
    """Split sorted indexes into `workers` disjoint, roughly-equal, contiguous ranges."""
    if workers <= 1 or not idxs:
        return [idxs] if idxs else []
    n = len(idxs)
    per = (n + workers - 1) // workers
    groups = [idxs[w * per:(w + 1) * per] for w in range(workers)]
    return [g for g in groups if g]


def run_worker(args, ep_indexes, worker_id, log_path):
    cmd = [str(PY), "-u", str(TRANSCRIBE), "--indexes", *[str(i) for i in ep_indexes]]
    if args.model:
        cmd += ["--model", args.model]
    if args.quiet:
        cmd.append("--quiet")
    with log_path.open("w", encoding="utf-8") as log:
        proc = subprocess.run(cmd, stdout=log, stderr=subprocess.STDOUT, text=True)
    return proc.returncode


def main():
    ap = argparse.ArgumentParser(description="Transcribe many episodes in parallel")
    ap.add_argument("--workers", type=int, default=5)
    ap.add_argument("--start", type=int, default=None,
                    help="only process episodes with index >= this (resume point)")
    ap.add_argument("--model", default="large-v3-turbo")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()
    workers = max(1, args.workers)

    pending = pending_indexes(args.start)
    if not pending:
        print("nothing pending")
        return 0
    reset_stale_claims()
    pending = pending_indexes(args.start)

    ranges = split_contiguous_ranges(pending, workers)
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    print(f"{len(pending)} pending episodes -> {len(ranges)} worker ranges:")
    for r in ranges:
        print(f"   range {r[0]:>3}..{r[-1]:>3}  ({len(r)} eps)")

    results = {}

    def w(worker_id):
        log_path = LOG_DIR / f"worker{worker_id}.log"
        results[worker_id] = run_worker(args, ranges[worker_id], worker_id, log_path)

    t0 = time.time()
    threads = [threading.Thread(target=w, args=(i,), name=f"w{i}")
               for i in range(len(ranges))]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    dur = time.time() - t0

    fails = [i for i, rci in results.items() if rci != 0]
    statuses = defaultdict(int)
    for ep in load_catalog()["episodes"]:
        statuses[ep["status"]] += 1
    print(f"\nfinished {len(ranges)} workers in {dur / 60:.1f} min")
    print("catalog:", dict(statuses))
    if fails:
        print("failed worker ranges:", fails, "-> see data/tmp/worker*.log")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
