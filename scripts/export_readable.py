"""Export a clean, human-readable transcript for a finished episode.

Merges consecutive same-speaker whisper segments into turn paragraphs and writes
a `.readable.txt` next to the raw .txt/.json. Design: one block per person-turn
so you can read along with the episode, then confirm/fill in real names.

Speaker labels:
  - default: per-episode SPEAKER_xx (raw diarization)
  - --use-map: cross-episode globals (G01, ...) from data/speaker_map.json
  - names: if data/speaker_names.json maps a gid to a name, use it

Usage:
    python scripts/export_readable.py --index 16 --write
    python scripts/export_readable.py --index 16 --use-map --write
    python scripts/export_readable.py                    # next done ep w/o .readable.txt
"""
import argparse
import glob
import json
import os
import sys
from collections import Counter
from datetime import timedelta

MERGEGAP_S = 1.0


def fmt_ts(sec):
    sec = max(0, int(round(sec)))
    return str(timedelta(seconds=sec))


def merge_turns(segments):
    segs = sorted(segments, key=lambda s: s["start"])
    turns = []
    for s in segs:
        sp = s.get("speaker")
        txt = (s.get("text") or "").strip()
        if not txt:
            continue
        if turns and turns[-1]["speaker"] == sp and (s["start"] - turns[-1]["end"]) < MERGEGAP_S:
            turns[-1]["end"] = max(turns[-1]["end"], s["end"])
            turns[-1]["text"] += " " + txt
        else:
            turns.append({"start": s["start"], "end": s["end"], "speaker": sp, "text": txt})
    return turns


def speak_time(turns):
    d = Counter()
    for t in turns:
        d[t["speaker"]] += max(0.0, t["end"] - t["start"])
    return d


def find_src(index=None):
    pat = os.path.join("data", "transcripts", f"{index:03d}*") if index else os.path.join("data", "transcripts", "*")
    jsons = sorted(glob.glob(pat + ".json"))
    if index:
        return jsons[0] if jsons else None
    for j in jsons:
        if not os.path.exists(j.rsplit(".", 1)[0] + ".readable.txt"):
            return j
    return None


def load_speaker_meta():
    """Return (label_map, names) where label_map maps (episode_idx, raw_label)->global,
    names maps global->str."""
    label_map = None
    names = {}
    mp = os.path.join("data", "speaker_map.json")
    if os.path.exists(mp):
        label_map = json.load(open(mp, encoding="utf-8"))["episodes"]
    nm = os.path.join("data", "speaker_names.json")
    if os.path.exists(nm):
        names = json.load(open(nm, encoding="utf-8"))
    return label_map, names


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--index", type=int)
    ap.add_argument("--use-map", action="store_true",
                    help="label by cross-episode global id (Gxx), with names if available")
    ap.add_argument("--write", action="store_true", help="write file next to transcript (default prints to stdout)")
    args = ap.parse_args()

    src = find_src(args.index)
    if not src:
        msg = f"no transcript for index {args.index}" if args.index else "no finished episode missing a .readable.txt"
        print(msg, file=sys.stderr)
        sys.exit(1)

    data = json.load(open(src, encoding="utf-8"))
    ep = data.get("index")
    turns = merge_turns(data["segments"])
    talk = speak_time(turns)

    label_map, names = load_speaker_meta()

    def display(sp):
        if args.use_map and label_map:
            gid = label_map.get(str(ep), {}).get(sp)
            if gid:
                if gid in names and names[gid]["name"]:
                    return names[gid]["name"]
                return gid
        return sp

    # Rebuild turns with display labels, then recompute talk time/ordering.
    labelled = [dict(t, speaker=display(t["speaker"])) for t in turns]
    talk = speak_time(labelled)
    ordered_spks = []
    for t in labelled:
        if t["speaker"] not in ordered_spks:
            ordered_spks.append(t["speaker"])

    lines = []
    lines.append(f"# {data['title']}")
    lines.append(f"published: {data['pub_date']}  |  duration: {fmt_ts(data.get('duration_sec', 0))}")
    lines.append(f"segments: {len(data['segments'])} -> {len(turns)} turns  |  labels: {'globals'+(' + names' if names else '') if args.use_map else 'raw per-episode'}")
    lines.append(f"model: {data.get('model')}")
    lines.append("")
    if args.use_map:
        lines.append("Speaker map (fill in data/speaker_names.json once):")
        for sp in ordered_spks:
            lines.append(f"  {sp:12s} = ")
        lines.append("")
    lines.append("Speaker talk time:")
    for sp in ordered_spks:
        lines.append(f"  {sp:12s} {fmt_ts(talk.get(sp, 0))}  ({sum(1 for t in labelled if t['speaker'] == sp)} turns)")
    lines.append("")
    for t in labelled:
        lines.append(f"[{fmt_ts(t['start'])}] {t['speaker']}")
        lines.append(t["text"])
        lines.append("")

    if args.write:
        out = src.rsplit(".", 1)[0] + ".readable.txt"
        with open(out, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        print(f"wrote {out}")
    else:
        print("\n".join(lines))


if __name__ == "__main__":
    main()
