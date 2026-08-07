"""Build/maintain data/catalog.json from the Regulation Podcast RSS feed.

The manifest is the project's source of truth: every episode, one row,
chronologically ordered (oldest first), with pipeline status.

Usage:
    python scripts/fetch_catalog.py [--feed URL] [--raw PATH] [--catalog PATH]

Idempotent: re-running preserves existing per-episode status (matched by
enclosure URL) and appends newly published episodes.
"""

import argparse
import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_FEED = "https://feeds.megaphone.fm/fface"
DEFAULT_RAW = ROOT / "data" / "raw" / "feed.xml"
DEFAULT_CATALOG = ROOT / "data" / "catalog.json"

NAMESPACES = {
    "itunes": "http://www.itunes.com/dtds/podcast-1.0.dtd",
    "content": "http://purl.org/rss/1.0/modules/content/",
}
ITUNES_URI = "http://www.itunes.com/dtds/podcast-1.0.dtd"


def fetch_feed(url: str, raw_path: Path) -> str:
    raw_path.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "regulation-transcripts/0.1"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = resp.read()
    raw_path.write_bytes(body)
    return body.decode("utf-8", errors="replace")


def parse_episodes(xml_text: str) -> list[dict]:
    root = ET.fromstring(xml_text)
    items = []
    for item in root.iter("item"):
        def text(tag):
            el = item.find(tag)
            return el.text.strip() if el is not None and el.text else ""

        def ns_text(uri, tag):
            el = item.find(f"{{{uri}}}{tag}")
            return el.text.strip() if el is not None and el.text else ""

        title = text("title")
        pub_date = text("pubDate")
        duration = ns_text(ITUNES_URI, "duration")
        enclosure = item.find("enclosure")
        guid_el = item.find("guid")
        guid = guid_el.text.strip() if guid_el is not None and guid_el.text else title

        parsed = None
        for fmt in ("%a, %d %b %Y %H:%M:%S %z", "%a, %d %b %Y %H:%M:%S %Z"):
            try:
                parsed = datetime.strptime(pub_date, fmt)
                break
            except ValueError:
                continue
        if parsed is None:
            parsed = datetime.now(timezone.utc)

        try:
            duration_sec = int(duration)
        except ValueError:
            parts = [p for p in duration.split(":") if p]
            if not parts:
                duration_sec = 0
            else:
                duration_sec = sum(int(p) * 60 ** (len(parts) - 1 - i) for i, p in enumerate(parts))

        items.append(
            {
                "guid": guid,
                "title": title,
                "pub_date": parsed.astimezone(timezone.utc).isoformat(),
                "duration_sec": duration_sec,
                "enclosure_url": enclosure.get("url") if enclosure is not None else "",
            }
        )
    items.sort(key=lambda e: (e["pub_date"], e["guid"]))
    return items


def safe_title(title: str, max_len: int = 120) -> str:
    t = re.sub(r'[<>:"/\\|?*\x00-\x1f]', " ", title)
    t = re.sub(r"\s+", " ", t).strip().rstrip(".")
    return t[:max_len].rstrip()


def build_catalog(episodes: list[dict], old: dict | None) -> dict:
    old_by_url = {}
    if old and isinstance(old.get("episodes"), list):
        old_by_url = {ep["enclosure_url"]: ep for ep in old["episodes"]}

    catalog_eps = []
    for idx, ep in enumerate(episodes, start=1):
        prev = old_by_url.get(ep["enclosure_url"])
        entry = {
            "index": idx,
            "title": ep["title"],
            "pub_date": ep["pub_date"],
            "duration_sec": ep["duration_sec"],
            "enclosure_url": ep["enclosure_url"],
            "status": (prev or {}).get("status", "pending"),
            "transcript_path": (prev or {}).get("transcript_path"),
            "model": (prev or {}).get("model"),
            "error": (prev or {}).get("error"),
            "processed_at": (prev or {}).get("processed_at"),
        }
        catalog_eps.append(entry)

    return {
        "feed_url": DEFAULT_FEED,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "episode_count": len(catalog_eps),
        "episodes": catalog_eps,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Fetch RSS feed and (re)build catalog.json")
    ap.add_argument("--feed", default=DEFAULT_FEED)
    ap.add_argument("--raw", type=Path, default=DEFAULT_RAW)
    ap.add_argument("--catalog", type=Path, default=DEFAULT_CATALOG)
    args = ap.parse_args()

    xml_text = fetch_feed(args.feed, args.raw)
    episodes = parse_episodes(xml_text)

    old = None
    if args.catalog.exists():
        old = json.loads(args.catalog.read_text(encoding="utf-8"))
        if len(old.get("episodes", [])) == len(episodes):
            print(f"Feed unchanged ({len(episodes)} episodes).")
            return 0

    catalog = build_catalog(episodes, old)
    args.catalog.parent.mkdir(parents=True, exist_ok=True)
    args.catalog.write_text(json.dumps(catalog, indent=2, ensure_ascii=False), encoding="utf-8")

    done = sum(1 for e in catalog["episodes"] if e["status"] == "done")
    print(f"Catalog written: {len(episodes)} episodes ({done} done, "
          f"{len(episodes) - done} remaining) -> {args.catalog}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
