"""Map per-episode diarization clusters (SPEAKER_xx) to global people.

Uses the saved `speaker_embeddings` (one 256-d vector per SPEAKER_xx per
episode). Two clusters from different episodes are the same person when their
normalized embeddings are similar (cosine >= threshold). Global identities
collapse the whole archive to a handful of people you name once.

Algorithm: single-linkage (union-find) on the cosine-similarity matrix, keeping
clusters whose centroid is at least `threshold` apart (agglomerative).

Outputs:
    data/speaker_map.json      {episodes: {<idx>: {<label>: <gid>}}}
    data/speaker_summary.json  {globals: {<gid>: {name, talk_sec, episodes, members}}}

Usage:
    python scripts/map_speakers.py [--threshold 0.85] [--output-dir data] [--report]
"""
import argparse
import glob
import json
import os
from collections import defaultdict

import numpy as np


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


class DSU:
    def __init__(self, n):
        self.p = list(range(n))

    def find(self, x):
        while self.p[x] != x:
            self.p[x] = self.p[self.p[x]]
            x = self.p[x]
        return x

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.p[ra] = rb


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--threshold", type=float, default=0.85,
                    help="minimum cosine similarity to link clusters as the same person")
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
    sim = X @ X.T

    if args.report:
        for i in range(0, len(units), max(1, len(units) // 40)):
            u = units[i]
            row = sorted(
                ((float(sim[i, j]), units[j]) for j in range(n) if j != i),
                key=lambda t: -t[0],
            )
            top = " | ".join(f"{r['episode']}:{r['label']} {s:.2f}" for s, r in row[:3])
            print(f"{u['episode']:>3}:{u['label']:10s} {u['talk_sec']:7.0f}s -> {top}")
        return

    # single-linkage: union any pair above threshold, then require centroids apart
    dsu = DSU(n)
    thr = args.threshold
    for i in range(n):
        for j in range(i + 1, n):
            if sim[i, j] >= thr:
                dsu.union(i, j)

    # centroid refinement: iteratively merge groups whose centroid cosine >= thr
    def centroid(idxs):
        return norm(np.mean(np.stack([X[i] for i in idxs]), axis=0))

    groups = defaultdict(list)
    for i in range(n):
        groups[dsu.find(i)].append(i)
    for _ in range(8):
        gs = list(groups.values())
        merged_any = False
        for a in range(len(gs)):
            if a >= len(gs):
                break
            for b in range(a + 1, len(gs)):
                if b >= len(gs):
                    break
                if float(centroid(gs[a]) @ centroid(gs[b])) >= thr:
                    dsu.union(gs[a][0], gs[b][0])
                    gs[a] = gs[a] + gs[b]
                    del gs[b]
                    merged_any = True
                    break
            if merged_any:
                break
        groups = defaultdict(list)
        for i in range(n):
            groups[dsu.find(i)].append(i)
        if not merged_any:
            break

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

    print(f"{len(units)} clusters -> {len(speakers)} global speakers")
    print(f"{'gid':6s} {'talk':>9s} {'eps':>3s}  members")
    for gid, sp in speakers.items():
        cols = sp["members"][:5]
        tail = " ..." if sp["episodes"] > len(cols) else ""
        shows = ", ".join(f"{m['episode']}:{m['label']}" for m in cols)
        print(f"{gid:6s} {sp['talk_sec']/3600:8.1f}h {sp['episodes']:3d}  {shows}{tail}")


if __name__ == "__main__":
    import sys
    main()
