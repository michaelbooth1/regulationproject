"""Second-pass audio attribution audit for the Who Said It quote bank.

The original transcription pipeline assigned one speaker to each Whisper segment.
That was normally correct, but a short reply could share a segment with the previous
speaker and inherit the majority label. This audit seeks directly to each quiz
moment, realigns around dynamically inserted ads, and checks the quote at both
speaker-turn and sentence granularity.

It is intentionally read-only with respect to transcripts and the quote bank.
Results are written incrementally so a long audit can be resumed safely.

Usage:
    python scripts/audit_quote_speakers.py
    python scripts/audit_quote_speakers.py --ids eric-flip-a-bird
    python scripts/audit_quote_speakers.py --resume
"""

from __future__ import annotations

import argparse
import difflib
import gc
import json
import math
import os
import re
import sys
import time
import warnings
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Iterable

import av
import numpy as np
import torch
from faster_whisper import WhisperModel
from pyannote.audio import Pipeline


ROOT = Path(__file__).resolve().parent.parent
BANK_PATH = ROOT / "frontend" / "app" / "data" / "who-said-it-bank.json"
CATALOG_PATH = ROOT / "data" / "catalog.json"
SPEAKER_MAP_PATH = ROOT / "data" / "speaker_map.json"
SPEAKER_NAMES_PATH = ROOT / "data" / "speaker_names.json"
TRANSCRIPTS_DIR = ROOT / "data" / "transcripts"
TOKEN_PATH = ROOT / "data" / "hf_token.txt"
DEFAULT_OUTPUT = ROOT / "data" / "analysis" / "who-said-it-audio-audit.json"

WHISPER_MODEL = "large-v3-turbo"
DIARIZATION_MODEL = "pyannote/speaker-diarization-community-1"
MAIN_HOSTS = {"geoff", "andrew", "gavin", "eric"}
SAMPLE_RATE = 16_000
INITIAL_PROMPT = (
    "The Regulation Podcast, hosted by Geoff Ramsey, Andrew Panton, "
    "Nick Maher, Eric Baudour and Gavin Free. Regulation, F**kface, Sausage."
)

# A block must clear both thresholds before it can overturn an attribution.
MIN_CLASSIFICATION_SIMILARITY = 0.52
MIN_CLASSIFICATION_MARGIN = 0.08
MIN_EVIDENCE_SECONDS = 0.55
MIN_SENTENCE_EVIDENCE_SECONDS = 1.5


def add_cuda_dll_dirs() -> None:
    """Expose CUDA DLLs installed inside the project virtual environment."""

    if os.name != "nt":
        return
    site_packages = ROOT / ".venv" / "Lib" / "site-packages"
    for relative in ("nvidia/cublas/bin", "nvidia/cudnn/bin"):
        folder = site_packages / relative
        if folder.is_dir():
            os.add_dll_directory(str(folder))
            os.environ["PATH"] = str(folder) + os.pathsep + os.environ.get("PATH", "")


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def resolve_hf_token() -> str:
    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")
    if not token and TOKEN_PATH.exists():
        token = next(
            (
                line.strip()
                for line in TOKEN_PATH.read_text(encoding="utf-8").splitlines()
                if line.strip() and not line.lstrip().startswith("#")
            ),
            None,
        )
    if not token:
        raise RuntimeError("A Hugging Face token is required for the diarization model.")
    return token


def transcript_for_episode(index: int) -> Path:
    matches = sorted(TRANSCRIPTS_DIR.glob(f"{index:03d} - *.json"))
    if len(matches) != 1:
        raise RuntimeError(f"Expected one transcript JSON for episode {index}, found {len(matches)}")
    return matches[0]


def normalize_tokens(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+(?:'[a-z0-9]+)?", text.lower().replace("’", "'"))


def direct_audio_url(url: str) -> str:
    """Skip analytics redirects when the underlying Megaphone URL is embedded."""

    marker = "traffic.megaphone.fm/"
    if marker not in url:
        return url
    return f"https://{marker}{url.rsplit(marker, 1)[1]}"


def load_remote_clip(url: str, start: float, end: float) -> np.ndarray:
    """Decode only [start, end] from a remote MP3 using HTTP range seeking."""

    url = direct_audio_url(url)
    start = max(0.0, float(start))
    end = max(start + 1.0, float(end))
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            container = av.open(url, options={"rw_timeout": "60000000"})
            stream = next(item for item in container.streams if item.type == "audio")
            container.seek(int(start / float(stream.time_base)), stream=stream, backward=True)
            resampler = av.AudioResampler(format="s16", layout="mono", rate=SAMPLE_RATE)
            chunks: list[np.ndarray] = []
            actual_start: float | None = None

            for frame in container.decode(stream):
                if frame.pts is None:
                    continue
                frame_time = float(frame.pts * stream.time_base)
                if frame_time + frame.samples / stream.rate < start:
                    continue
                if frame_time > end:
                    break
                if actual_start is None:
                    actual_start = frame_time
                for output in resampler.resample(frame):
                    chunks.append(output.to_ndarray())
            container.close()

            if not chunks:
                raise RuntimeError("remote seek returned no audio")
            audio = np.concatenate(chunks, axis=1).reshape(-1).astype(np.float32) / 32768.0
            trim = max(0, int((start - (actual_start or start)) * SAMPLE_RATE))
            wanted = int((end - start) * SAMPLE_RATE)
            audio = audio[trim : trim + wanted]
            if len(audio) < SAMPLE_RATE:
                raise RuntimeError("remote seek returned less than one second of audio")
            return audio
        except Exception as error:  # noqa: BLE001 - retry transient media host failures
            last_error = error
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"could not read remote audio: {last_error}")


def transcribe_words(model: WhisperModel, audio: np.ndarray) -> list[dict]:
    segments, _ = model.transcribe(
        audio,
        language="en",
        initial_prompt=INITIAL_PROMPT,
        beam_size=3,
        condition_on_previous_text=False,
        vad_filter=True,
        word_timestamps=True,
    )
    words: list[dict] = []
    for segment in segments:
        for word in segment.words or []:
            tokens = normalize_tokens(word.word)
            if not tokens:
                continue
            words.append(
                {
                    "text": word.word.strip(),
                    "tokens": tokens,
                    "start": float(word.start),
                    "end": float(word.end),
                }
            )
    return words


def best_quote_alignment(quote: str, words: list[dict]) -> dict | None:
    """Fuzzy-match the edited bank quote against word-timestamp output."""

    target = normalize_tokens(quote)
    if not target or not words:
        return None

    observed: list[str] = []
    token_to_word: list[int] = []
    for word_index, word in enumerate(words):
        for token in word["tokens"]:
            observed.append(token)
            token_to_word.append(word_index)

    target_len = len(target)
    slack = max(3, math.ceil(target_len * 0.22))
    best: tuple[float, int, int] | None = None
    for length in range(max(2, target_len - slack), target_len + slack + 1):
        for start in range(0, len(observed) - length + 1):
            end = start + length
            score = difflib.SequenceMatcher(None, target, observed[start:end], autojunk=False).ratio()
            if best is None or score > best[0]:
                best = (score, start, end)

    if best is None:
        return None
    score, token_start, token_end = best
    word_start = token_to_word[token_start]
    word_end = token_to_word[token_end - 1] + 1
    return {
        "score": round(float(score), 4),
        "wordStart": word_start,
        "wordEnd": word_end,
        "words": words[word_start:word_end],
    }


def align_dynamic_audio(entry: dict, episode: dict, model: WhisperModel) -> dict:
    """Find the quote despite request-time ad insertion changing timestamps."""

    expected = float(entry["startSec"])
    duration = float(episode.get("duration_sec") or expected + 300)
    attempts = (80.0, 210.0)
    best_result: dict | None = None

    for radius in attempts:
        clip_start = max(0.0, expected - radius)
        clip_end = min(duration, expected + radius)
        audio = load_remote_clip(episode["enclosure_url"], clip_start, clip_end)
        words = transcribe_words(model, audio)
        alignment = best_quote_alignment(entry["quote"], words)
        if alignment and (best_result is None or alignment["score"] > best_result["score"]):
            aligned_words = alignment["words"]
            best_result = {
                **alignment,
                "audio": audio,
                "clipStart": clip_start,
                "matchStart": clip_start + aligned_words[0]["start"],
                "matchEnd": clip_start + aligned_words[-1]["end"],
            }
        if best_result and best_result["score"] >= 0.72:
            return best_result

    if best_result and best_result["score"] >= 0.58:
        return best_result
    raise RuntimeError(
        f"could not align quote near {expected:.1f}s "
        f"(best score {best_result['score'] if best_result else 'none'})"
    )


def episode_references(
    episode_index: int,
    transcript: dict,
    speaker_map: dict,
    speaker_names: dict,
) -> list[dict]:
    assignments = speaker_map["episodes"].get(str(episode_index), {})
    references: list[dict] = []
    for label, vector in (transcript.get("speaker_embeddings") or {}).items():
        gid = assignments.get(label)
        name = (speaker_names.get(gid, {}) or {}).get("name", "").strip().lower()
        if name not in MAIN_HOSTS:
            continue
        embedding = np.asarray(vector, dtype=np.float32)
        norm = float(np.linalg.norm(embedding))
        if norm == 0:
            continue
        references.append({"label": label, "gid": gid, "host": name, "embedding": embedding / norm})
    if len(references) < 2:
        raise RuntimeError(f"episode {episode_index} has too few named host references")
    return references


def classify_audio_span(
    diarizer: Pipeline,
    audio: np.ndarray,
    start: float,
    end: float,
    references: list[dict],
) -> dict:
    start = max(0.0, start - 0.06)
    end = min(len(audio) / SAMPLE_RATE, end + 0.06)
    sample_start = int(start * SAMPLE_RATE)
    sample_end = int(end * SAMPLE_RATE)
    waveform = torch.from_numpy(audio[sample_start:sample_end])[None, None, :]
    if waveform.shape[-1] < int(MIN_EVIDENCE_SECONDS * SAMPLE_RATE):
        return {"host": None, "similarity": None, "margin": None}

    embedding = np.asarray(diarizer._embedding(waveform))[0]  # noqa: SLF001 - model's public pipeline component
    embedding /= np.linalg.norm(embedding)
    similarities = np.asarray([float(embedding @ item["embedding"]) for item in references])
    order = np.argsort(-similarities)
    best_index = int(order[0])
    second_similarity = float(similarities[order[1]]) if len(order) > 1 else -1.0
    best_similarity = float(similarities[best_index])
    margin = best_similarity - second_similarity
    confident = best_similarity >= MIN_CLASSIFICATION_SIMILARITY and margin >= MIN_CLASSIFICATION_MARGIN
    return {
        "host": references[best_index]["host"] if confident else None,
        "bestHost": references[best_index]["host"],
        "similarity": round(best_similarity, 4),
        "margin": round(margin, 4),
    }


def label_at(annotation, timestamp: float) -> str | None:
    nearest: tuple[float, str] | None = None
    for turn, _, label in annotation.itertracks(yield_label=True):
        if turn.start <= timestamp < turn.end:
            return label
        distance = min(abs(timestamp - turn.start), abs(timestamp - turn.end))
        if nearest is None or distance < nearest[0]:
            nearest = (distance, label)
    return nearest[1] if nearest and nearest[0] <= 0.3 else None


def collapse_turn_blocks(words: list[dict], annotation) -> list[dict]:
    blocks: list[dict] = []
    for word in words:
        midpoint = (word["start"] + word["end"]) / 2
        label = label_at(annotation, midpoint)
        if blocks and blocks[-1]["label"] == label:
            blocks[-1]["words"].append(word)
            blocks[-1]["end"] = word["end"]
        else:
            blocks.append(
                {
                    "label": label,
                    "start": word["start"],
                    "end": word["end"],
                    "words": [word],
                }
            )
    return blocks


def sentence_blocks(words: list[dict]) -> list[dict]:
    blocks: list[dict] = []
    current: list[dict] = []
    for word in words:
        current.append(word)
        if re.search(r"[.!?][\"']?$", word["text"]):
            blocks.append({"start": current[0]["start"], "end": current[-1]["end"], "words": current})
            current = []
    if current:
        blocks.append({"start": current[0]["start"], "end": current[-1]["end"], "words": current})
    return blocks


def serialize_blocks(
    blocks: Iterable[dict],
    diarizer: Pipeline,
    audio: np.ndarray,
    references: list[dict],
    minimum_duration: float = MIN_EVIDENCE_SECONDS,
) -> list[dict]:
    serialized: list[dict] = []
    for block in blocks:
        duration = float(block["end"] - block["start"])
        if duration < minimum_duration:
            continue
        classification = classify_audio_span(
            diarizer,
            audio,
            float(block["start"]),
            float(block["end"]),
            references,
        )
        serialized.append(
            {
                "text": " ".join(word["text"] for word in block["words"]),
                "start": round(float(block["start"]), 3),
                "end": round(float(block["end"]), 3),
                "duration": round(duration, 3),
                "diarizationLabel": block.get("label"),
                **classification,
            }
        )
    return serialized


def confident_hosts(blocks: list[dict]) -> set[str]:
    return {block["host"] for block in blocks if block.get("host") in MAIN_HOSTS}


def audit_entry(
    entry: dict,
    episode: dict,
    transcript: dict,
    speaker_map: dict,
    speaker_names: dict,
    whisper: WhisperModel,
    diarizer: Pipeline,
    num_speakers: int | None = None,
) -> dict:
    aligned = align_dynamic_audio(entry, episode, whisper)
    quote_words = aligned["words"]
    wide_audio = aligned["audio"]
    clip_start = float(aligned["clipStart"])

    # Convert word timestamps from the wide search clip into a compact audit clip.
    wide_quote_start = float(quote_words[0]["start"])
    wide_quote_end = float(quote_words[-1]["end"])
    narrow_start = max(0.0, wide_quote_start - 4.0)
    narrow_end = min(len(wide_audio) / SAMPLE_RATE, wide_quote_end + 4.0)
    sample_start = int(narrow_start * SAMPLE_RATE)
    sample_end = int(narrow_end * SAMPLE_RATE)
    audio = wide_audio[sample_start:sample_end]
    words = [
        {**word, "start": word["start"] - narrow_start, "end": word["end"] - narrow_start}
        for word in quote_words
    ]

    diarization_kwargs = (
        {"num_speakers": num_speakers}
        if num_speakers
        else {"min_speakers": 1, "max_speakers": 4}
    )
    diarization = diarizer(
        {"waveform": torch.from_numpy(audio)[None, :], "sample_rate": SAMPLE_RATE},
        **diarization_kwargs,
    )
    annotation = (
        getattr(diarization, "exclusive_speaker_diarization", None)
        or getattr(diarization, "speaker_diarization", diarization)
    )
    references = episode_references(entry["episode"], transcript, speaker_map, speaker_names)

    turns = serialize_blocks(collapse_turn_blocks(words, annotation), diarizer, audio, references)
    sentences = serialize_blocks(
        sentence_blocks(words),
        diarizer,
        audio,
        references,
        minimum_duration=MIN_SENTENCE_EVIDENCE_SECONDS,
    )
    whole = classify_audio_span(diarizer, audio, words[0]["start"], words[-1]["end"], references)

    expected = entry["speaker"].lower()
    turn_hosts = confident_hosts(turns)
    sentence_hosts = confident_hosts(sentences)
    evidence_hosts = turn_hosts | sentence_hosts
    reasons: list[str] = []
    if len(turn_hosts) > 1:
        reasons.append("multiple turn-level host fingerprints")
    if len(sentence_hosts) > 1:
        reasons.append("multiple sentence-level host fingerprints")
    if whole.get("host") and whole["host"] != expected:
        reasons.append(f"whole quote matches {whole['host']}, not {expected}")
    if expected in evidence_hosts and any(host != expected for host in evidence_hosts):
        status = "mixed_speakers"
    elif evidence_hosts and expected not in evidence_hosts and whole.get("host") not in (None, expected):
        status = "wrong_speaker"
    elif reasons:
        status = "review"
    else:
        status = "clean"

    return {
        "id": entry["id"],
        "episode": entry["episode"],
        "expectedSpeaker": expected,
        "status": status,
        "reasons": reasons,
        "alignmentScore": aligned["score"],
        "expectedStartSec": round(float(entry["startSec"]), 3),
        "matchedStartSec": round(float(aligned["matchStart"]), 3),
        "matchedEndSec": round(float(aligned["matchEnd"]), 3),
        "dynamicOffsetSec": round(float(aligned["matchStart"] - entry["startSec"]), 3),
        "matchedText": " ".join(word["text"] for word in quote_words),
        "wholeQuote": whole,
        "turnBlocks": turns,
        "sentenceBlocks": sentences,
    }


def save_report(
    output: Path,
    entries: list[dict],
    total_requested: int,
    complete: bool,
    num_speakers: int | None = None,
) -> None:
    counts = defaultdict(int)
    for entry in entries:
        counts[entry["status"]] += 1
    report = {
        "generatedAt": datetime.now().astimezone().isoformat(),
        "complete": complete,
        "models": {"transcription": WHISPER_MODEL, "diarization": DIARIZATION_MODEL},
        "forcedSpeakers": num_speakers,
        "thresholds": {
            "minimumSimilarity": MIN_CLASSIFICATION_SIMILARITY,
            "minimumMargin": MIN_CLASSIFICATION_MARGIN,
            "minimumEvidenceSeconds": MIN_EVIDENCE_SECONDS,
            "minimumSentenceEvidenceSeconds": MIN_SENTENCE_EVIDENCE_SECONDS,
        },
        "totals": {"requested": total_requested, "processed": len(entries), **dict(sorted(counts.items()))},
        "entries": entries,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ids", nargs="*", help="audit only these quote IDs")
    parser.add_argument("--resume", action="store_true", help="skip entries already present in the output")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--num-speakers",
        type=int,
        help="force a speaker count for targeted corroboration (normally auto-detected)",
    )
    args = parser.parse_args()

    add_cuda_dll_dirs()
    warnings.filterwarnings("ignore", message="torchcodec is not installed correctly")
    warnings.filterwarnings("ignore", message="std\(\): degrees of freedom")

    bank = load_json(BANK_PATH)
    if args.ids:
        requested = set(args.ids)
        bank = [entry for entry in bank if entry["id"] in requested]
        missing = requested - {entry["id"] for entry in bank}
        if missing:
            raise SystemExit(f"Unknown quote IDs: {', '.join(sorted(missing))}")

    catalog = {entry["index"]: entry for entry in load_json(CATALOG_PATH)["episodes"]}
    speaker_map = load_json(SPEAKER_MAP_PATH)
    speaker_names = load_json(SPEAKER_NAMES_PATH)
    completed: list[dict] = []
    completed_ids: set[str] = set()
    if args.resume and args.output.exists():
        previous = load_json(args.output)
        completed = previous.get("entries", [])
        completed_ids = {entry["id"] for entry in completed}

    print(f"Loading {DIARIZATION_MODEL} on CUDA...", flush=True)
    diarizer = Pipeline.from_pretrained(DIARIZATION_MODEL, token=resolve_hf_token())
    diarizer.to(torch.device("cuda"))
    print(f"Loading {WHISPER_MODEL} on CUDA...", flush=True)
    whisper = WhisperModel(WHISPER_MODEL, device="cuda", compute_type="auto")

    started = time.monotonic()
    pending = [entry for entry in bank if entry["id"] not in completed_ids]
    for position, entry in enumerate(pending, start=1):
        prefix = f"[{position}/{len(pending)}] {entry['id']} (episode {entry['episode']})"
        try:
            transcript = load_json(transcript_for_episode(entry["episode"]))
            result = audit_entry(
                entry,
                catalog[entry["episode"]],
                transcript,
                speaker_map,
                speaker_names,
                whisper,
                diarizer,
                num_speakers=args.num_speakers,
            )
            completed.append(result)
            print(
                f"{prefix}: {result['status']} "
                f"(align {result['alignmentScore']:.2f}, offset {result['dynamicOffsetSec']:+.1f}s)",
                flush=True,
            )
        except Exception as error:  # noqa: BLE001 - preserve progress and continue the audit
            completed.append(
                {
                    "id": entry["id"],
                    "episode": entry["episode"],
                    "expectedSpeaker": entry["speaker"].lower(),
                    "status": "error",
                    "error": f"{type(error).__name__}: {error}",
                }
            )
            print(f"{prefix}: ERROR {type(error).__name__}: {error}", flush=True)
        save_report(
            args.output,
            completed,
            len(bank),
            complete=False,
            num_speakers=args.num_speakers,
        )

    order = {entry["id"]: index for index, entry in enumerate(bank)}
    completed.sort(key=lambda entry: order.get(entry["id"], len(order)))
    save_report(
        args.output,
        completed,
        len(bank),
        complete=True,
        num_speakers=args.num_speakers,
    )
    elapsed = time.monotonic() - started
    print(f"Audit complete: {len(completed)} entries in {elapsed / 60:.1f} minutes", flush=True)

    del whisper, diarizer
    gc.collect()
    torch.cuda.empty_cache()
    return 0


if __name__ == "__main__":
    sys.exit(main())
