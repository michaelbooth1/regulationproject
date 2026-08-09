"""Build the static speaker-time snapshot used by the frontend.

The fresh clustering output may renumber global IDs as the archive grows. This
script transfers the user's existing names by matching old and new cluster
members, then merges duplicate display names (for example multiple Ad clusters).
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
FRONTEND = ROOT / "frontend"
GENERATED = FRONTEND / "generated"
OUTPUT = FRONTEND / "app" / "data" / "speaker-stats.json"

COLORS = {
    "Geoff": "#ff5a36",
    "Andrew": "#ffc93d",
    "Gavin": "#70d6ff",
    "Eric": "#aa8cff",
    "Nick": "#ff8bd1",
    "Graysie": "#c8ff66",
    "Ad": "#63e6a7",
    "Other voices": "#8891a7",
}


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value) -> None:
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def member_keys(speaker: dict) -> set[tuple[int, str]]:
    return {(int(m["episode"]), m["label"]) for m in speaker.get("members", [])}


def main(promote: bool = False) -> None:
    old_summary = read_json(ROOT / "data" / "speaker_summary.json")["globals"]
    names = read_json(ROOT / "data" / "speaker_names.json")
    fresh_summary = read_json(GENERATED / "speaker_summary.json")["globals"]
    fresh_map = read_json(GENERATED / "speaker_map.json")["episodes"]

    fresh_members = {gid: member_keys(sp) for gid, sp in fresh_summary.items()}
    named_fresh: dict[str, str] = {}
    used_fresh: set[str] = set()
    transfers: list[tuple[str, str, str, int]] = []
    unmatched: list[tuple[str, str]] = []

    # Match each old named identity to the fresh group with the most shared
    # episode-local speaker clusters. This is stable even when G IDs reorder.
    old_named = []
    for old_gid, name_record in names.items():
        name = (name_record.get("name") or "").strip()
        if name and old_gid in old_summary:
            old_named.append((old_gid, name, member_keys(old_summary[old_gid])))

    old_named.sort(key=lambda item: len(item[2]), reverse=True)
    for _old_gid, name, old_members in old_named:
        candidates = sorted(
            (
                (len(old_members & members), gid)
                for gid, members in fresh_members.items()
                if gid not in used_fresh
            ),
            reverse=True,
        )
        if candidates and candidates[0][0] > 0:
            overlap, fresh_gid = candidates[0]
            named_fresh[fresh_gid] = name
            used_fresh.add(fresh_gid)
            transfers.append((_old_gid, fresh_gid, name, overlap))
        else:
            unmatched.append((_old_gid, name))

    if promote and unmatched:
        missing = ", ".join(f"{gid}={name}" for gid, name in unmatched)
        raise RuntimeError(f"refusing to promote: named identities had no overlap: {missing}")

    totals = defaultdict(float)
    episode_sets: dict[str, set[int]] = defaultdict(set)
    for gid, speaker in fresh_summary.items():
        name = named_fresh.get(gid, "Other voices")
        totals[name] += float(speaker.get("talk_sec", 0))
        episode_sets[name].update(int(m["episode"]) for m in speaker.get("members", []))

    transcript_files = sorted((ROOT / "data" / "transcripts").glob("*.json"))
    transcript_docs = [read_json(path) for path in transcript_files]
    mapped_indexes = {int(index) for index in fresh_map}
    unique_docs = {
        int(doc["index"]): doc
        for doc in transcript_docs
        if int(doc["index"]) in mapped_indexes
    }
    total_duration = sum(float(doc.get("duration_sec") or 0) for doc in unique_docs.values())
    total_talk = sum(totals.values())

    speakers = []
    for name, seconds in sorted(totals.items(), key=lambda item: item[1], reverse=True):
        speakers.append(
            {
                "name": name,
                "seconds": round(seconds, 1),
                "hours": round(seconds / 3600, 1),
                "episodes": len(episode_sets[name]),
                "share": round((seconds / total_talk * 100) if total_talk else 0, 2),
                "color": COLORS.get(name, COLORS["Other voices"]),
            }
        )

    output = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "completedEpisodes": len(unique_docs),
        "episodeHours": round(total_duration / 3600, 1),
        "measuredTalkHours": round(total_talk / 3600, 1),
        "method": "Whisper segment durations assigned to diarized speaker clusters; approximate.",
        "speakers": speakers,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    write_json(OUTPUT, output)
    print(f"wrote {OUTPUT} for {len(unique_docs)} completed episodes")
    for old_gid, fresh_gid, name, overlap in transfers:
        print(f"transferred {old_gid}={name} -> {fresh_gid} ({overlap} shared clusters)")

    if promote:
        data_dir = ROOT / "data"
        fresh_names = {
            gid: {"name": named_fresh.get(gid, "")}
            for gid in fresh_summary
        }
        write_json(data_dir / "speaker_map.json", {"episodes": fresh_map})
        write_json(data_dir / "speaker_summary.json", {"globals": fresh_summary})
        write_json(data_dir / "speaker_names.json", fresh_names)
        print(f"promoted full map, summary, and {len(fresh_names)} name slots to {data_dir}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--promote",
        action="store_true",
        help="replace data/speaker_map.json and summary, migrating existing names to fresh IDs",
    )
    args = parser.parse_args()
    main(promote=args.promote)
