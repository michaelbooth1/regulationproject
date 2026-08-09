"""Build repeatable linguistic profiles for the four primary hosts.

The report is intentionally descriptive rather than diagnostic. It measures
observable transcript features—pacing, vocabulary, conversational markers,
and phrases that are unusually common for one host versus the other three.

Usage:
    python scripts/analyze_host_language.py
"""

from __future__ import annotations

import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TRANSCRIPTS = ROOT / "data" / "transcripts"
SPEAKER_MAP = ROOT / "data" / "speaker_map.json"
OUTPUT = ROOT / "frontend" / "app" / "data" / "host-language-profiles.json"

HOSTS = {
    "G01": "Geoff",
    "G02": "Andrew",
    "G03": "Gavin",
    "G04": "Eric",
}

TOKEN_RE = re.compile(r"[a-z]+(?:'[a-z]+)?")
FILLERS = {"uh", "um", "like", "well", "actually", "basically", "literally"}
HEDGES = {"maybe", "perhaps", "probably", "possibly", "guess", "think", "seems", "kinda", "kind"}
INTENSIFIERS = {"absolutely", "completely", "definitely", "extremely", "fucking", "really", "so", "totally", "very"}
AGREEMENT = {"yeah", "yes", "right", "exactly", "sure", "okay", "correct", "fair"}
NEGATIONS = {"no", "not", "never", "nothing", "can't", "cannot", "don't", "didn't", "won't", "wouldn't"}
FIRST_PERSON = {"i", "i'm", "i've", "i'll", "i'd", "me", "my", "mine", "myself"}
WE_LANGUAGE = {"we", "we're", "we've", "we'll", "we'd", "us", "our", "ours"}
SECOND_PERSON = {"you", "you're", "you've", "you'll", "you'd", "your", "yours"}
PROFANITY = {"fuck", "fucking", "fucked", "shit", "damn", "ass", "bitch", "cock", "dick"}
HYPOTHETICAL = {"if", "would", "could", "imagine", "scenario", "suppose", "hypothetically", "premise"}
STORY_LANGUAGE = {"then", "when", "remember", "yesterday", "ago", "story", "happened", "once", "years"}
CONTROL_LANGUAGE = {"stop", "wait", "hang", "need", "decide", "pick", "move", "start", "finish", "hold"}
UNCERTAINTY = {"maybe", "might", "perhaps", "possibly", "probably", "guess", "unsure", "whether"}
PHYSICAL_LANGUAGE = {"look", "see", "feel", "sound", "touch", "move", "hit", "inside", "outside", "body"}

STOPWORDS = {
    "a", "about", "all", "am", "an", "and", "are", "as", "at", "be", "because", "been",
    "but", "by", "can", "do", "for", "from", "get", "got", "had", "has", "have", "he",
    "her", "here", "him", "his", "how", "if", "in", "is", "it", "it's", "just", "know",
    "like", "me", "my", "no", "not", "of", "oh", "on", "one", "or", "out", "really",
    "right", "say", "she", "so", "some", "that", "that's", "the", "their", "them", "then",
    "there", "they", "thing", "think", "this", "to", "up", "was", "we", "well", "were",
    "what", "when", "where", "which", "who", "why", "with", "would", "yeah", "yes", "you",
    "your",
}


def read_json(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def tokens(text: str) -> list[str]:
    return TOKEN_RE.findall(text.lower().replace("’", "'"))


def rate(count: int, total_words: int) -> float:
    return round((count / total_words * 1000) if total_words else 0, 2)


def percentile(values: list[int], fraction: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, round((len(ordered) - 1) * fraction))
    return float(ordered[index])


def distinctive_items(
    target: Counter,
    other: Counter,
    target_total: int,
    other_total: int,
    minimum: int,
    limit: int,
) -> list[dict]:
    vocabulary = set(target) | set(other)
    width = max(len(vocabulary), 1)
    rows = []
    for item, count in target.items():
        if count < minimum:
            continue
        target_rate = (count + 0.5) / (target_total + 0.5 * width)
        other_rate = (other.get(item, 0) + 0.5) / (other_total + 0.5 * width)
        score = math.log(target_rate / other_rate)
        rows.append((score, count, item))
    return [
        {"text": item, "count": count, "lift": round(math.exp(score), 2)}
        for score, count, item in sorted(rows, reverse=True)[:limit]
    ]


def main() -> None:
    episode_map = read_json(SPEAKER_MAP)["episodes"]
    records = {
        global_id: {
            "segments": 0,
            "talkSec": 0.0,
            "questionSegments": 0,
            "exclamationSegments": 0,
            "tokens": Counter(),
            "bigrams": Counter(),
            "trigrams": Counter(),
            "questionOpeners": Counter(),
            "turnWordCounts": [],
            "episodes": set(),
        }
        for global_id in HOSTS
    }

    mapped_episode_count = 0
    title_tokens = Counter()
    title_bigrams = Counter()
    for path in sorted(TRANSCRIPTS.glob("*.json")):
        transcript = read_json(path)
        episode = int(transcript["index"])
        assignments = episode_map.get(str(episode), {})
        if not assignments:
            continue
        mapped_episode_count += 1
        title_words = [
            word for word in tokens(transcript.get("title", "")) if word not in STOPWORDS
        ]
        title_tokens.update(title_words)
        title_bigrams.update(zip(title_words, title_words[1:]))
        active_host = None
        active_turn_words = 0

        def flush_turn() -> None:
            nonlocal active_host, active_turn_words
            if active_host in records and active_turn_words:
                records[active_host]["turnWordCounts"].append(active_turn_words)
            active_host = None
            active_turn_words = 0

        for segment in transcript.get("segments", []):
            global_id = assignments.get(segment.get("speaker"))
            if global_id not in records:
                flush_turn()
                continue
            text = segment.get("text", "")
            words = tokens(text)
            if not words:
                continue
            if global_id != active_host:
                flush_turn()
                active_host = global_id
            active_turn_words += len(words)
            record = records[global_id]
            record["segments"] += 1
            record["talkSec"] += max(
                0.0, float(segment.get("end") or 0) - float(segment.get("start") or 0)
            )
            record["episodes"].add(episode)
            record["questionSegments"] += int("?" in text)
            record["exclamationSegments"] += int("!" in text)
            record["tokens"].update(words)
            record["bigrams"].update(zip(words, words[1:]))
            record["trigrams"].update(zip(words, words[1:], words[2:]))
            if "?" in text:
                record["questionOpeners"].update([" ".join(words[: min(3, len(words))])])
        flush_turn()

    all_tokens = Counter()
    all_bigrams = Counter()
    all_trigrams = Counter()
    for record in records.values():
        all_tokens.update(record["tokens"])
        all_bigrams.update(record["bigrams"])
        all_trigrams.update(record["trigrams"])

    profiles = {}
    for global_id, name in HOSTS.items():
        record = records[global_id]
        token_counts = record["tokens"]
        bigram_counts = record["bigrams"]
        trigram_counts = record["trigrams"]
        word_count = sum(token_counts.values())
        talk_minutes = record["talkSec"] / 60
        content_tokens = Counter(
            {word: count for word, count in token_counts.items() if word not in STOPWORDS and len(word) > 2}
        )
        other_tokens = all_tokens - token_counts
        other_bigrams = all_bigrams - bigram_counts
        other_trigrams = all_trigrams - trigram_counts
        turn_word_counts = record["turnWordCounts"]
        profiles[name] = {
            "globalId": global_id,
            "episodes": len(record["episodes"]),
            "talkHours": round(record["talkSec"] / 3600, 1),
            "segments": record["segments"],
            "words": word_count,
            "vocabulary": len(token_counts),
            "wordsPerSegment": round(word_count / record["segments"], 2),
            "turnWordsMean": round(sum(turn_word_counts) / len(turn_word_counts), 2),
            "turnWordsMedian": percentile(turn_word_counts, 0.5),
            "turnWordsP90": percentile(turn_word_counts, 0.9),
            "wordsPerMinute": round(word_count / talk_minutes, 1) if talk_minutes else 0,
            "questionSegmentsPerThousand": round(
                record["questionSegments"] / record["segments"] * 1000, 1
            ),
            "exclamationSegmentsPerThousand": round(
                record["exclamationSegments"] / record["segments"] * 1000, 1
            ),
            "markersPerThousandWords": {
                "firstPerson": rate(sum(token_counts[word] for word in FIRST_PERSON), word_count),
                "weLanguage": rate(sum(token_counts[word] for word in WE_LANGUAGE), word_count),
                "secondPerson": rate(sum(token_counts[word] for word in SECOND_PERSON), word_count),
                "agreement": rate(sum(token_counts[word] for word in AGREEMENT), word_count),
                "negation": rate(sum(token_counts[word] for word in NEGATIONS), word_count),
                "hedging": rate(sum(token_counts[word] for word in HEDGES), word_count),
                "intensifiers": rate(sum(token_counts[word] for word in INTENSIFIERS), word_count),
                "fillers": rate(sum(token_counts[word] for word in FILLERS), word_count),
                "profanity": rate(sum(token_counts[word] for word in PROFANITY), word_count),
                "hypotheticals": rate(sum(token_counts[word] for word in HYPOTHETICAL), word_count),
                "storyLanguage": rate(sum(token_counts[word] for word in STORY_LANGUAGE), word_count),
                "controlLanguage": rate(sum(token_counts[word] for word in CONTROL_LANGUAGE), word_count),
                "uncertainty": rate(sum(token_counts[word] for word in UNCERTAINTY), word_count),
                "physicalLanguage": rate(sum(token_counts[word] for word in PHYSICAL_LANGUAGE), word_count),
            },
            "frequentContentWords": [
                {"text": word, "count": count}
                for word, count in content_tokens.most_common(15)
            ],
            "distinctiveWords": distinctive_items(
                token_counts,
                other_tokens,
                word_count,
                sum(other_tokens.values()),
                minimum=80,
                limit=18,
            ),
            "distinctivePhrases": distinctive_items(
                Counter({" ".join(pair): count for pair, count in bigram_counts.items()}),
                Counter({" ".join(pair): count for pair, count in other_bigrams.items()}),
                sum(bigram_counts.values()),
                sum(other_bigrams.values()),
                minimum=24,
                limit=18,
            ),
            "distinctiveThreeWordPhrases": distinctive_items(
                Counter({" ".join(item): count for item, count in trigram_counts.items()}),
                Counter({" ".join(item): count for item, count in other_trigrams.items()}),
                sum(trigram_counts.values()),
                sum(other_trigrams.values()),
                minimum=10,
                limit=24,
            ),
            "commonQuestionOpeners": [
                {"text": text, "count": count}
                for text, count in record["questionOpeners"].most_common(15)
            ],
        }

    output = {
        "method": (
            "Descriptive transcript analysis of speaker-mapped segments. Distinctive terms use "
            "smoothed frequency lift against the other three hosts; features are not psychological diagnoses."
        ),
        "mappedEpisodes": mapped_episode_count,
        "recurringTitleTerms": [
            {"text": text, "count": count}
            for text, count in title_tokens.most_common(80)
        ],
        "recurringTitlePhrases": [
            {"text": " ".join(pair), "count": count}
            for pair, count in title_bigrams.most_common(60)
        ],
        "profiles": profiles,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUTPUT}")
    for name, profile in profiles.items():
        phrases = ", ".join(item["text"] for item in profile["distinctivePhrases"][:6])
        print(
            f"{name}: {profile['words']:,} words, {profile['wordsPerMinute']} wpm, "
            f"{profile['wordsPerSegment']} words/segment | {phrases}"
        )


if __name__ == "__main__":
    main()
