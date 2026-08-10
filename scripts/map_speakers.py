"""Map per-episode diarization clusters (SPEAKER_xx) to global people.

Uses the saved `speaker_embeddings` (one 256-d vector per SPEAKER_xx per
episode). Clusters from different episodes are grouped by the cosine distance
between their normalized embeddings. Global identities collapse the whole
archive to a set of recurring voices you name once.

Algorithm: average-linkage agglomerative clustering. Unlike single linkage,
average linkage does not merge two people merely because a chain of noisy
embeddings connects them across a large archive.

Outputs:
    data/speaker_map.json      {episodes: {<idx>: {<label>: <gid>}}}
    data/speaker_summary.json  {globals: {<gid>: {name, talk_sec, episodes, members}}}

Usage:
    python scripts/map_speakers.py [--threshold 0.80] [--output-dir data] [--report]
"""
import argparse
import glob
import json
import os
from collections import defaultdict

import numpy as np
from scipy.cluster.hierarchy import fcluster, linkage as hierarchical_linkage


def load_done_transcripts():
    units = []
    for path in sorted(glob.glob(os.path.join("data", "transcripts", "*.json"))):
        d = json.load(open(path, encoding="utf-8"))
        idx = d.get("index")
        talk = defaultdict(float)
        for s in d.get("segments", []):
            talk[s.get("speaker")] += max(0.0, (s.get("end") or 0) - (s.get("start") or 0))
        for label, vec in (d.get("speaker_embeddings") or {}).items():
            a = np.asarray(vec, dtype=np.float64)
            if a.size == 0:
                continue
            units.append({"episode": idx, "label": label, "vec": a, "talk_sec": talk.get(label, 0.0)})
    return units


def norm(u):
    n = np.linalg.norm(u)
    return u / n if n > 0 else u


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--threshold", type=float, default=0.80,
                    help="minimum average cosine similarity to merge speaker groups")
    ap.add_argument("--linkage", choices=("average", "complete"), default="average",
                    help="agglomerative linkage method (average avoids single-link chaining)")
    ap.add_argument("--min-talk", type=float, default=5.0,
                    help="drop clusters with fewer than this many seconds of speech")
    ap.add_argument("--output-dir", default="data",
                    help="directory for speaker_map.json and speaker_summary.json")
    ap.add_argument("--report", action="store_true",
                    help="print top matching clusters across episodes instead of final map")
    args = ap.parse_args()

    units_all = load_done_transcripts()
    units = [u for u in units_all if u["talk_sec"] >= args.min_talk]
    print(f"{len(units_all)} clusters total, {len(units)} after min-talk {args.min_talk}s", file=os.sys.stderr)

    n = len(units)
    if n == 0:
        print("no clusters found")
        return

    X = np.stack([norm(u["vec"]) for u in units])
    if args.report:
        sim = X @ X.T
        for i in range(0, len(units), max(1, len(units) // 40)):
            u = units[i]
            row = sorted(
                ((float(sim[i, j]), units[j]) for j in range(n) if j != i),
                key=lambda t: -t[0],
            )
            top = " | ".join(f"{r['episode']}:{r['label']} {s:.2f}" for s, r in row[:3])
            print(f"{u['episode']:>3}:{u['label']:10s} {u['talk_sec']:7.0f}s -> {top}")
        return

    thr = args.threshold
    tree = hierarchical_linkage(X, method=args.linkage, metric="cosine")
    cluster_labels = fcluster(tree, t=1.0 - thr, criterion="distance")
    groups = defaultdict(list)
    for i, label in enumerate(cluster_labels):
        groups[int(label)].append(i)

    order = sorted(groups.values(), key=lambda g: -sum(units[i]["talk_sec"] for i in g))
    assignments = defaultdict(dict)
    speakers = {}
    for off, grp in enumerate(order, start=1):
        gid = f"G{off:02d}"
        members = [{"episode": units[i]["episode"], "label": units[i]["label"],
                    "talk_sec": round(units[i]["talk_sec"], 1)} for i in grp]
        total = sum(m["talk_sec"] for m in members)
        for m in members:
            assignments[str(m["episode"])][m["label"]] = gid
        speakers[gid] = {"name": None, "talk_sec": round(total, 1),
                         "episodes": len({m["episode"] for m in members}), "members": members}

    os.makedirs(args.output_dir, exist_ok=True)
    map_path = os.path.join(args.output_dir, "speaker_map.json")
    summary_path = os.path.join(args.output_dir, "speaker_summary.json")
    with open(map_path, "w", encoding="utf-8") as f:
        json.dump({"episodes": dict(assignments)}, f, indent=1)
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump({"globals": speakers}, f, indent=2)

    print(
        f"{len(units)} clusters -> {len(speakers)} global speakers "
        f"({args.linkage} linkage, threshold {thr:.2f})"
    )
    print(f"{'gid':6s} {'talk':>9s} {'eps':>3s}  members")
    for gid, sp in speakers.items():
        cols = sp["members"][:5]
        tail = " ..." if sp["episodes"] > len(cols) else ""
        shows = ", ".join(f"{m['episode']}:{m['label']}" for m in cols)
        print(f"{gid:6s} {sp['talk_sec']/3600:8.1f}h {sp['episodes']:3d}  {shows}{tail}")


if __name__ == "__main__":
    import sys
    main()
