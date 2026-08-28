"""Build the transcript-derived host speaking timeline used by the stats page.

The output groups completed episodes into twenty-episode windows. Segment
durations are assigned through the canonical episode speaker map, then reduced
to the four hosts shown in the game.
"""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "frontend" / "app" / "data" / "speaker-timeline.json"
HOSTS = ("Geoff", "Andrew", "Gavin", "Eric")
WINDOW_SIZE = 20


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def host_seconds_for_episode(document: dict, episode_map: dict, names: dict) -> dict[str, float]:
    totals: dict[str, float] = defaultdict(float)
    for segment in document.get("segments", []):
        global_id = episode_map.get(segment.get("speaker"))
        name = names.get(global_id, {}).get("name", "")
        if name not in HOSTS:
            continue
        duration = max(0.0, float(segment.get("end", 0)) - float(segment.get("start", 0)))
        totals[name] += duration
    return {host: totals[host] for host in HOSTS}


def summarize(episodes: list[dict]) -> dict:
    totals = {
        host: sum(episode["hosts"][host] for episode in episodes)
        for host in HOSTS
    }
    main_host_total = sum(totals.values())
    episode_count = len(episodes)
    return {
        host: {
            "minutesPerEpisode": round(totals[host] / 60 / episode_count, 2),
            "share": round(totals[host] / main_host_total * 100, 2) if main_host_total else 0,
        }
        for host in HOSTS
    }


def main() -> None:
    speaker_map = read_json(ROOT / "data" / "speaker_map.json")["episodes"]
    names = read_json(ROOT / "data" / "speaker_names.json")
    documents = {}
    for path in (ROOT / "data" / "transcripts").glob("*.json"):
        document = read_json(path)
        index = int(document["index"])
        if str(index) in speaker_map:
            documents[index] = document

    episodes = []
    for index, document in sorted(documents.items()):
        episodes.append(
            {
                "index": index,
                "date": document["pub_date"][:10],
                "hosts": host_seconds_for_episode(document, speaker_map[str(index)], names),
            }
        )

    windows = []
    for offset in range(0, len(episodes), WINDOW_SIZE):
        chunk = episodes[offset : offset + WINDOW_SIZE]
        windows.append(
            {
                "startIndex": chunk[0]["index"],
                "endIndex": chunk[-1]["index"],
                "startDate": chunk[0]["date"],
                "endDate": chunk[-1]["date"],
                "episodeCount": len(chunk),
                "hosts": summarize(chunk),
            }
        )

    output = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "completedEpisodes": len(episodes),
        "windowSize": WINDOW_SIZE,
        "method": (
            "Approximate Whisper segment durations assigned to canonical diarized "
            "speaker identities. Shares use only Geoff, Andrew, Gavin, and Eric."
        ),
        "first100": summarize(episodes[:100]),
        "latest100": summarize(episodes[-100:]),
        "windows": windows,
    }
    OUTPUT.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUTPUT} with {len(windows)} windows from {len(episodes)} episodes")


if __name__ == "__main__":
    main()
