"""Mine host-attributed transcript lines for a Who Said It game.

This is a discovery tool, not the final editorial pass. It joins the per-episode
speaker labels to the global speaker map, rejects obvious promos and boilerplate,
then ranks short turns using transparent "absurdity" signals. The curated game
bank lives separately in the frontend and is manually verified against these
results.

Usage:
    python scripts/analyze_who_said_it.py
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TRANSCRIPTS = ROOT / "data" / "transcripts"
SPEAKER_MAP = ROOT / "data" / "speaker_map.json"
SPEAKER_NAMES = ROOT / "data" / "speaker_names.json"
OUTPUT = ROOT / "data" / "analysis" / "who-said-it-candidates.json"
CURATED_BANK = ROOT / "frontend" / "app" / "data" / "who-said-it-bank.json"

HOSTS = {
    "G01": "Geoff",
    "G02": "Andrew",
    "G03": "Gavin",
    "G04": "Eric",
}
HOST_SLUGS = {
    "geoff": "G01",
    "andrew": "G02",
    "gavin": "G03",
    "eric": "G04",
}

WORD_RE = re.compile(r"[A-Za-z0-9]+(?:['’][A-Za-z]+)?")
SPACE_RE = re.compile(r"\s+")

ABSURD_WORDS = {
    "ankle", "anus", "ass", "bagel", "banana", "bean", "beef", "bird",
    "bog", "bovril", "bread", "butt", "buttplug", "cat", "clown", "cock",
    "cosmic", "cucumber", "dick", "dog", "donkey", "egg", "fart", "fish",
    "floor", "foot", "garfield", "ghost", "gooch", "gravy", "ham", "horse",
    "icy", "krampus", "monkey", "nugget", "pants", "pencil", "pickle", "pig",
    "piss", "pizza", "poop", "potato", "rat", "sausage", "shirt", "shit",
    "sloppy", "sock", "spaghetti", "swan", "toilet", "tuxedo", "waffle",
    "worm",
}
COMMITMENT_WORDS = {
    "absolutely", "always", "entire", "every", "exactly", "forever", "hundred",
    "impossible", "never", "nobody", "nothing", "only", "perfect", "thousand",
    "worst",
}
FIRST_PERSON = {"i", "i'm", "i’ve", "i've", "i’ll", "i'll", "me", "my"}
PROMO_PHRASES = {
    "ad free", "available now", "bonus episodes", "click the link", "download the",
    "go to ", "hello fresh", "link in the description", "mint mobile", "patreon",
    "promo code", "rooster teeth", "shop dot", "sponsored by", "subscribe to",
    "this episode is brought", "use code", "visit ", "www dot", ".com",
}
BOILERPLATE_PHRASES = {
    "my name is", "welcome back", "welcome to", "thanks for listening",
    "thank you for listening", "we'll see you next", "see you next week",
    "that's the episode", "end of the episode", "start the podcast",
}
LOW_SIGNAL = {
    "i don't know", "oh my god", "that's true", "that's fair", "there you go",
    "what do you mean", "are you serious", "i have no idea", "okay that's",
}


def read_json(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def clean(text: str) -> str:
    return SPACE_RE.sub(" ", text).strip()


def words(text: str) -> list[str]:
    return [word.lower() for word in WORD_RE.findall(text)]


def forbidden(text: str) -> bool:
    lowered = text.lower()
    return any(phrase in lowered for phrase in PROMO_PHRASES | BOILERPLATE_PHRASES)


def transcript_index() -> dict[int, dict]:
    return {
        int(transcript["index"]): transcript
        for path in TRANSCRIPTS.glob("*.json")
        for transcript in [read_json(path)]
    }


def named_speaker(global_id: str | None, speaker_names: dict) -> str | None:
    name = clean(speaker_names.get(global_id or "", {}).get("name", ""))
    if not name or name.lower() == "ad":
        return None
    return name


def find_segment_index(segments: list[dict], timestamp: float) -> tuple[int, float]:
    index = min(
        range(len(segments)),
        key=lambda position: abs(float(segments[position].get("start") or 0) - timestamp),
    )
    distance = abs(float(segments[index].get("start") or 0) - timestamp)
    return index, distance


def build_lead_in(
    item: dict,
    transcript: dict,
    assignments: dict[str, str],
    speaker_names: dict,
) -> list[dict]:
    """Return three nearby, named transcript turns immediately before a quote."""
    segments = transcript.get("segments", [])
    target_time = float(item["startSec"])
    target_index, distance = find_segment_index(segments, target_time)
    if distance > 0.15:
        raise ValueError(f"no transcript segment begins near {target_time:.2f}s")

    # Whisper often splits a single thought into several short segments. Join
    # adjacent segments from the same mapped speaker into readable transcript
    # lines, while capping each line so the reveal stays quick to scan.
    lines: list[dict] = []
    last_index = -2
    last_end = -1.0
    for index in range(max(0, target_index - 72), target_index):
        segment = segments[index]
        start = float(segment.get("start") or 0)
        if target_time - start > 150:
            continue
        text = clean(segment.get("text", ""))
        speaker = named_speaker(assignments.get(segment.get("speaker")), speaker_names)
        if not text or not speaker or forbidden(text):
            last_index = -2
            last_end = -1.0
            continue

        can_join = (
            lines
            and lines[-1]["speaker"] == speaker
            and index == last_index + 1
            and start - last_end <= 2.5
            and len(lines[-1]["text"]) + len(text) + 1 <= 240
        )
        if can_join:
            lines[-1]["text"] += " " + text
        else:
            lines.append({
                "speaker": speaker,
                "text": text,
                "startSec": round(start, 2),
            })
        last_index = index
        last_end = float(segment.get("end") or start)

    meaningful = [line for line in lines if len(words(line["text"])) >= 3]
    lead_in = meaningful[-3:]
    if len(lead_in) < 3:
        lead_in = lines[-3:]
    if len(lead_in) < 3:
        raise ValueError("fewer than three usable named lines precede this quote")
    return lead_in


def write_lead_ins() -> None:
    """Enrich the curated bank with source-backed context for answer reveals."""
    bank = read_json(CURATED_BANK)
    episode_map = read_json(SPEAKER_MAP)["episodes"]
    speaker_names = read_json(SPEAKER_NAMES)
    transcripts = transcript_index()
    errors: list[str] = []

    for item in bank:
        episode = int(item["episode"])
        try:
            item["leadIn"] = build_lead_in(
                item,
                transcripts[episode],
                episode_map.get(str(episode), {}),
                speaker_names,
            )
        except (KeyError, ValueError) as error:
            errors.append(f"{item['id']}: {error}")

    if errors:
        raise SystemExit("Lead-in enrichment failed:\n- " + "\n- ".join(errors))
    with CURATED_BANK.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(bank, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
    print(f"Wrote three transcript lead-in lines for {len(bank)} curated quotes")
    validate_curated_bank()


def score_quote(text: str, title: str, word_counts: Counter) -> tuple[float, list[str]]:
    lowered = text.lower()
    tokens = words(text)
    token_set = set(tokens)
    score = 0.0
    reasons: list[str] = []

    absurd_hits = sorted(token_set & ABSURD_WORDS)
    if absurd_hits:
        score += min(9.0, 3.0 * len(absurd_hits))
        reasons.append("absurd nouns: " + ", ".join(absurd_hits))

    commitment_hits = sorted(token_set & COMMITMENT_WORDS)
    if commitment_hits:
        score += min(3.0, 1.25 * len(commitment_hits))
        reasons.append("overcommitment")

    if token_set & FIRST_PERSON:
        score += 1.2
        reasons.append("personal claim")
    if "?" in text:
        score += 0.7
        reasons.append("question")
    if "!" in text:
        score += 0.5
    if re.search(r"\b\d+(?:,\d+)?\b", text):
        score += 1.4
        reasons.append("suspiciously specific number")
    if any(word in lowered for word in ("what if", "imagine", "scenario", "technically", "somehow")):
        score += 1.5
        reasons.append("hypothetical logic")
    if any(word in token_set for word in ("fuck", "fucking", "fucked", "shit", "piss", "ass", "dick")):
        score += 1.0
        reasons.append("strong wording")

    # Reward uncommon content words. This helps surface show-specific premises
    # without pretending rarity alone is comedy.
    rare = [
        token for token in token_set
        if len(token) >= 5 and word_counts[token] <= 14
    ]
    if rare:
        score += min(3.0, len(rare) * 0.3)
        reasons.append("archive-specific wording")

    title_tokens = set(words(title))
    if len(token_set & title_tokens) >= 2:
        score += 1.0
        reasons.append("episode-defining premise")

    length = len(tokens)
    score += max(0.0, 2.0 - abs(length - 17) / 8)
    if any(phrase in lowered for phrase in LOW_SIGNAL):
        score -= 2.5
    if text.endswith((",", "and", "but", "so")):
        score -= 1.0
    return round(score, 2), reasons


def validate_curated_bank() -> None:
    """Verify every shipped quote points at a segment mapped to its named host."""
    bank = read_json(CURATED_BANK)
    episode_map = read_json(SPEAKER_MAP)["episodes"]
    speaker_names = read_json(SPEAKER_NAMES)
    transcripts = transcript_index()
    errors: list[str] = []

    if len(bank) != 60:
        errors.append(f"Expected 60 curated quotes, found {len(bank)}")
    if len({item["id"] for item in bank}) != len(bank):
        errors.append("Curated quote IDs are not unique")
    if len({item["episode"] for item in bank}) != len(bank):
        errors.append("The curated bank should use 60 different episodes")

    for item in bank:
        episode = int(item["episode"])
        transcript = transcripts.get(episode)
        if not transcript:
            errors.append(f"{item['id']}: episode {episode} is missing")
            continue
        segments = transcript.get("segments", [])
        if not segments:
            errors.append(f"{item['id']}: episode {episode} has no segments")
            continue
        timestamp = float(item["startSec"])
        segment_index, distance = find_segment_index(segments, timestamp)
        segment = segments[segment_index]
        if distance > 0.15:
            errors.append(
                f"{item['id']}: no segment begins near {timestamp:.2f}s "
                f"(nearest is {distance:.2f}s away)"
            )
            continue
        mapped_id = episode_map.get(str(episode), {}).get(segment.get("speaker"))
        expected_id = HOST_SLUGS.get(item["speaker"])
        if mapped_id != expected_id:
            errors.append(
                f"{item['id']}: maps to {mapped_id or 'nothing'}, expected {expected_id}"
            )

        lead_in = item.get("leadIn")
        if not isinstance(lead_in, list) or len(lead_in) != 3:
            errors.append(f"{item['id']}: expected exactly three transcript lead-in lines")
            continue
        try:
            expected_lead_in = build_lead_in(
                item,
                transcript,
                episode_map.get(str(episode), {}),
                speaker_names,
            )
        except ValueError as error:
            errors.append(f"{item['id']}: could not rebuild lead-in: {error}")
            continue
        if lead_in != expected_lead_in:
            errors.append(f"{item['id']}: lead-in does not match its mapped transcript window")

    if errors:
        raise SystemExit("Curated bank validation failed:\n- " + "\n- ".join(errors))
    print(f"Verified {len(bank)} curated quotes against transcript timestamps and speaker map")


def main() -> None:
    episode_map = read_json(SPEAKER_MAP)["episodes"]
    raw_rows: list[dict] = []
    corpus_counts: Counter = Counter()

    for path in sorted(TRANSCRIPTS.glob("*.json")):
        transcript = read_json(path)
        episode = int(transcript["index"])
        assignments = episode_map.get(str(episode), {})
        if not assignments:
            continue
        segments = transcript.get("segments", [])
        for index, segment in enumerate(segments):
            global_id = assignments.get(segment.get("speaker"))
            if global_id not in HOSTS:
                continue
            text = clean(segment.get("text", ""))
            corpus_counts.update(words(text))
            raw_rows.append({
                "hostId": global_id,
                "host": HOSTS[global_id],
                "episode": episode,
                "title": transcript.get("title", ""),
                "published": transcript.get("pub_date", ""),
                "start": round(float(segment.get("start") or 0), 2),
                "end": round(float(segment.get("end") or 0), 2),
                "text": text,
                "previous": clean(segments[index - 1].get("text", "")) if index else "",
                "next": clean(segments[index + 1].get("text", "")) if index + 1 < len(segments) else "",
            })

    candidates: list[dict] = []
    seen: set[str] = set()
    for row in raw_rows:
        count = len(words(row["text"]))
        key = re.sub(r"[^a-z0-9]", "", row["text"].lower())
        if count < 7 or count > 34 or len(key) < 24 or key in seen or forbidden(row["text"]):
            continue
        seen.add(key)
        score, reasons = score_quote(row["text"], row["title"], corpus_counts)
        candidates.append({**row, "wordCount": count, "score": score, "signals": reasons})

    ranked: dict[str, list[dict]] = {}
    for global_id, host in HOSTS.items():
        host_rows = [row for row in candidates if row["hostId"] == global_id]
        ranked[host] = sorted(
            host_rows,
            key=lambda row: (-row["score"], row["episode"], row["start"]),
        )[:1500]

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8") as handle:
        json.dump(
            {
                "method": (
                    "Mapped transcript segments from G01–G04, filtered promos and boilerplate, "
                    "then ranked 7–34-word lines for absurd vocabulary, specificity, premise "
                    "language, archive rarity, and quotable length. Final bank requires human review."
                ),
                "transcriptFiles": len(list(TRANSCRIPTS.glob("*.json"))),
                "candidateCounts": {host: len(rows) for host, rows in ranked.items()},
                "candidates": ranked,
            },
            handle,
            indent=2,
            ensure_ascii=False,
        )
        handle.write("\n")

    print(f"Wrote {OUTPUT}")
    for host, rows in ranked.items():
        print(f"{host}: {len(rows)} ranked candidates")
    validate_curated_bank()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Validate the shipped 60-quote bank without regenerating candidates.",
    )
    parser.add_argument(
        "--write-lead-ins",
        action="store_true",
        help="Write three verified, speaker-attributed lines before every curated quote.",
    )
    arguments = parser.parse_args()
    if arguments.write_lead_ins:
        write_lead_ins()
    elif arguments.validate_only:
        validate_curated_bank()
    else:
        main()
