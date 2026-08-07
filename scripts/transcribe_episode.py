"""Transcribe exactly one Regulation Podcast episode, with speaker labels.

Pipeline (per episode):
  1. pick the next `pending` episode from data/catalog.json (oldest first),
     or a specific one via --index
  2. download the audio into data/tmp/{episode}.mp3 (resumable)
  3. decode it once with PyAV to mono 16 kHz float audio (no system ffmpeg)
  4. transcribe with faster-whisper (large-v3-turbo, English, GPU)
  5. diarize speakers with pyannote (official speaker-diarization-3.1)
  6. merge: assign each whisper segment its dominant speaker
  7. write data/transcripts/000N - YYYY-MM-DD - <Title>.txt and .json
     (speaker labels per segment)
  8. delete the audio file; update the manifest

On failure the episode is marked "error", the partial audio is deleted, and the
manifest is left consistent so the run can simply be re-run.

Usage:
    python scripts/transcribe_episode.py [--index N] [--model large-v3-turbo]
                                         [--device auto] [--language en]
                                         [--keep-audio] [--quiet]
                                         [--no-diarize] [--num-speakers N]
"""

import argparse
import json
import os
import subprocess
import sys
import time
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "data" / "catalog.json"
TMP_DIR = ROOT / "data" / "tmp"
TRANSCRIPTS_DIR = ROOT / "data" / "transcripts"
TOKEN_FILE = ROOT / "data" / "hf_token.txt"
LOCK_FILE = TMP_DIR / "catalog.lock"

DEFAULT_MODEL = "large-v3-turbo"
DIARIZATION_MODEL = "pyannote/speaker-diarization-3.1"

INITIAL_PROMPT = (
    "The Regulation Podcast, hosted by Geoff Ramsey, Andrew Panton, "
    "Nick Maher, Eric Baudour and Gavin Free. Regulation, F**kface, "
    "Sausage, Rooster Teeth."
)


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------
def load_catalog() -> dict:
    if not CATALOG.exists():
        raise SystemExit(f"No catalog at {CATALOG}. Run: python scripts/fetch_catalog.py")
    return json.loads(CATALOG.read_text(encoding="utf-8"))


def save_catalog(catalog: dict) -> None:
    CATALOG.write_text(json.dumps(catalog, indent=2, ensure_ascii=False), encoding="utf-8")


@contextmanager
def catalog_lock():
    """Exclusive lock around the shared data/catalog.json for parallel workers."""
    import msvcrt
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    fd = os.open(str(LOCK_FILE), os.O_RDWR | os.O_CREAT)
    try:
        while True:
            try:
                msvcrt.locking(fd, msvcrt.LK_NBLCK, 1)
                break
            except OSError:
                time.sleep(0.05)
        yield
    finally:
        try:
            msvcrt.locking(fd, msvcrt.LK_UNLCK, 1)
        finally:
            os.close(fd)


def with_catalog_lock(mutator):
    """Run mutator(catalog) while holding the exclusive lock; returns its result.

    The mutator should read/modify the passed-in catalog dict. Any mutations
    are persisted iff the mutator returns True.
    """
    with catalog_lock():
        catalog = load_catalog()
        changed = mutator(catalog)
        if changed:
            save_catalog(catalog)
        return catalog, changed


def pick_episode(catalog: dict, index: int | None) -> dict:
    episodes = catalog["episodes"]
    if index is not None:
        for ep in episodes:
            if ep["index"] == index:
                return ep
        raise SystemExit(f"No episode with index {index}.")
    pending = [ep for ep in episodes if ep["status"] == "pending"]
    if not pending:
        raise SystemExit("No pending episodes — all done, or error/transcribing. "
                         "Use --index to force a specific episode.")
    return pending[0]


def safe_title(title: str, max_len: int = 120) -> str:
    import re
    t = re.sub(r'[<>:"/\\|?*\x00-\x1f]', " ", title)
    t = re.sub(r"\s+", " ", t).strip().rstrip(".")
    return t[:max_len].rstrip()


def format_duration(seconds: float) -> str:
    h, rem = divmod(int(seconds), 3600)
    m, s = divmod(rem, 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


def add_cuda_dll_dirs() -> None:
    """Make ctranslate2's CUDA DLLs (cublas/cudnn) loadable on Windows."""
    if os.name != "nt":
        return
    import site
    for d in (site.getsitepackages(), site.getusersitepackages()):
        if isinstance(d, str):
            d = [d]
        for base in d:
            for rel in ("nvidia/cublas/bin", "nvidia/cudnn/bin"):
                p = os.path.join(base, rel)
                if os.path.isdir(p):
                    os.add_dll_directory(p)
                    os.environ["PATH"] = p + os.pathsep + os.environ.get("PATH", "")


def resolve_hf_token() -> str | None:
    token = os.environ.get("HF_TOKEN") or os.environ.get(
        "HUGGING_FACE_HUB_TOKEN")
    if not token and TOKEN_FILE.exists():
        for line in TOKEN_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                token = line
                break
    return token or None


def load_audio_mono16k(path: Path, sample_rate: int = 16000):
    """Decode an audio file to a mono float32 numpy array at 16 kHz.

    Uses PyAV (bundled with faster-whisper) so no system ffmpeg is required.
    The same array is handed to both Whisper and pyannote.
    """
    import av
    import numpy as np

    container = av.open(str(path))
    try:
        stream = next(s for s in container.streams if s.type == "audio")
    except StopIteration:
        container.close()
        raise RuntimeError("no audio stream in file")
    resampler = av.AudioResampler(format="s16", layout="mono", rate=sample_rate)
    chunks = []
    for frame in container.decode(stream):
        for out in resampler.resample(frame):
            chunks.append(out.to_ndarray())
    container.close()
    if not chunks:
        raise RuntimeError("no decodable audio in file")
    audio = np.concatenate(chunks, axis=1).reshape(-1).astype(np.float32) / 32768.0
    return audio, sample_rate


def download_audio(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    cmd = ["curl.exe", "-L", "--silent", "--show-error", "-C-",
           "--retry", "5", "--retry-delay", "2", "-o", str(dest), url]
    print(f"  downloading {dest.name} ...")
    subprocess.run(cmd, check=True)
    size = dest.stat().st_size if dest.exists() else 0
    print(f"  downloaded {size / 1024 / 1024:.1f} MB")
    if size == 0:
        raise RuntimeError("downloaded file is empty")


# --------------------------------------------------------------------------
# diarization
# --------------------------------------------------------------------------
def load_diarizer(hf_token: str | None, device: str):
    from pyannote.audio import Pipeline
    kwargs = {"token": hf_token} if hf_token else {}
    pipeline = Pipeline.from_pretrained(DIARIZATION_MODEL, **kwargs)
    if "cuda" in str(device).lower():
        try:
            import torch
            pipeline.to(torch.device("cuda"))
        except Exception:
            pass
    return pipeline


def diarize(pipeline, audio, sample_rate: int, num_speakers: int | None):
    """Run diarization; returns (annotation, embeddings_by_label) or (None, {}).

    annotation is the interval->speaker map; embeddings_by_label maps each
    SPEAKER_xx to its (256,) voice embedding so clusters can be matched to
    persons later even after the audio is deleted.
    """
    import torch
    waveform = torch.from_numpy(audio)[None, :] if audio.dtype.kind == "f" else audio
    kwargs = {"num_speakers": num_speakers} if num_speakers else {}
    out = pipeline({"waveform": waveform, "sample_rate": sample_rate}, **kwargs)
    # pyannote>=4 returns a DiarizeOutput dataclass wrapping an Annotation,
    # with speaker_embeddings ordered to match annotation.labels().
    ann = getattr(out, "speaker_diarization", out)
    embeddings = getattr(out, "speaker_embeddings", None)
    embeddings_by_label = {}
    if embeddings is not None:
        for label, vec in zip(sorted(set(ann.labels())), embeddings):
            embeddings_by_label[label] = [round(float(x), 6) for x in vec]
    return ann, embeddings_by_label


def segment_speaker(diarization, start: float, end: float) -> str:
    """Speaker with majority overlap in [start, end); 'SPEAKER_99' if none."""
    best_label, best_overlap = None, 0.0
    for turn, _, label in diarization.itertracks(yield_label=True):
        overlap = max(0.0, min(end, turn.end) - max(start, turn.start))
        if overlap > best_overlap:
            best_overlap, best_label = overlap, label
    return best_label if best_overlap > 0 else "SPEAKER_99"


# --------------------------------------------------------------------------
# main transcription + diarization pass
# --------------------------------------------------------------------------
def transcribe_episode(ep: dict, audio, sample_rate: int, model_name: str,
                       device: str, language: str, quiet: bool,
                       hf_token: str | None, do_diarize: bool,
                       num_speakers: int | None) -> None:
    add_cuda_dll_dirs()
    from faster_whisper import WhisperModel

    diar = None
    speaker_embeddings = {}
    if do_diarize:
        if hf_token is None:
            raise RuntimeError(
                "Diarization requires a Hugging Face token (HF_TOKEN or "
                f"{TOKEN_FILE}). Use --no-diarize to skip speaker labels.")
        print("  loading & running speaker diarization (pyannote) ...")
        pipeline = load_diarizer(hf_token, device)
        diar, speaker_embeddings = diarize(pipeline, audio, sample_rate, num_speakers)
        n = len(set(diar.labels()))
        print(f"  diarization done: {n} speakers found")

    print("  loading Whisper model ...")
    model = WhisperModel(model_name, device=device, compute_type="auto")
    segments, info = model.transcribe(
        audio,  # numpy array: no rewrite to disk
        language="en" if language in ("en", "english") else language,
        initial_prompt=INITIAL_PROMPT,
        vad_filter=True,
        beam_size=5,
    )

    base = "{:03d} - {} - {}".format(ep["index"], ep["pub_date"][:10],
                                     safe_title(ep["title"]))
    txt_path = TRANSCRIPTS_DIR / f"{base}.txt"
    json_path = TRANSCRIPTS_DIR / f"{base}.json"
    TRANSCRIPTS_DIR.mkdir(parents=True, exist_ok=True)

    segments_out = []
    with txt_path.open("w", encoding="utf-8") as f:
        f.write(f"# Episode {ep['index']}: {ep['title']}\n")
        f.write(f"published: {ep['pub_date']}  |  duration: {format_duration(info.duration)}\n")
        f.write(f"source: {ep['enclosure_url']}\n")
        f.write(f"transcribed: {datetime.now().astimezone().isoformat()}  |  model: {model_name}\n")
        f.write(f"diarization: {DIARIZATION_MODEL if do_diarize else 'off'}\n\n")
        for seg in segments:
            line = seg.text.strip()
            if not line:
                continue
            speaker = segment_speaker(diar, seg.start, seg.end) if diar else ""
            f.write(f"\n[{format_duration(seg.start)}] {speaker}\n{line}\n")
            if not quiet:
                print(f"    {format_duration(seg.start)} {speaker}  {line[:60]}{'...' if len(line) > 60 else ''}")
            segments_out.append({
                "start": seg.start,
                "end": seg.end,
                "text": line,
                "speaker": speaker or None,
            })

    json_out = {
        "index": ep["index"],
        "title": ep["title"],
        "pub_date": ep["pub_date"],
        "model": model_name,
        "diarization_model": DIARIZATION_MODEL if do_diarize else None,
        "language": getattr(info, "language", None),
        "language_probability": getattr(info, "language_probability", None),
        "duration_sec": info.duration,
        "speaker_embeddings": speaker_embeddings or None,
        "segments": segments_out,
    }
    json_path.write_text(json.dumps(json_out, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"  transcript written: {txt_path.name} (+ {json_path.name})")


# --------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------
def main() -> int:
    ap = argparse.ArgumentParser(
        description="Transcribe (and speaker-label) Regulation Podcast episodes")
    ap.add_argument("--index", type=int, help="specific episode index")
    ap.add_argument("--indexes", type=int, nargs="*",
                    help="one or more specific episode indexes to process (parallel worker)")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--device", default="auto")
    ap.add_argument("--language", default="en")
    ap.add_argument("--keep-audio", action="store_true", help="keep the downloaded mp3")
    ap.add_argument("--quiet", action="store_true", help="don't print each segment")
    ap.add_argument("--no-diarize", action="store_true", help="skip speaker diarization")
    ap.add_argument("--num-speakers", type=int, help="force N speakers (default: auto-detect)")
    args = ap.parse_args()

    indexes = list(args.indexes) if args.indexes else ([args.index] if args.index else [])
    if not indexes:
        # default: next pending
        catalog = load_catalog()
        ep = pick_episode(catalog, None)
        indexes = [ep["index"]]

    status = 0
    for idx in indexes:
        rc = process_one(idx, args)
        status = status or rc
    return status


def process_one(index: int, args) -> int:
    """Claim, download, transcribe, save, complete one episode index."""
    print(f"== Episode {index} (claimed) ==")

    def claim(catalog):
        for e in catalog["episodes"]:
            if e["index"] == index:
                if e["status"] in ("pending", "error"):
                    e["status"] = "transcribing"
                    e["error"] = None
                    return True
                if e["status"] == "done":
                    ep_replayed = e
                    return True
                return False  # downloading/transcribing: owned by another worker
        raise SystemExit(f"No episode with index {index}.")

    catalog, claimed = with_catalog_lock(claim)
    if not claimed:
        print(f"  ↻ episode {index} is owned by another worker — skipping")
        return 0
    ep = next(e for e in catalog["episodes"] if e["index"] == index)

    audio_path = TMP_DIR / f"{ep['index']:03d}.mp3"
    base = "{:03d} - {} - {}".format(ep["index"], ep["pub_date"][:10],
                                     safe_title(ep["title"]))
    txt_path = TRANSCRIPTS_DIR / f"{base}.txt"
    json_path = TRANSCRIPTS_DIR / f"{base}.json"

    try:
        if ep["status"] == "done":
            print(f"  ↻ {txt_path.name} already done — skipping")
            return 0

        download_audio(ep["enclosure_url"], audio_path)
        audio, sr = load_audio_mono16k(audio_path)
        hf_token = resolve_hf_token()

        if txt_path.exists() and json_path.exists():
            print(f"  transcript already exists ({txt_path.name}); skipping")
        else:
            for leftover in (txt_path, json_path):
                if leftover.exists():
                    leftover.unlink()
            transcribe_episode(ep, audio, sr, args.model, args.device,
                               args.language, args.quiet, hf_token,
                               do_diarize=not args.no_diarize,
                               num_speakers=args.num_speakers)

        if not args.keep_audio and audio_path.exists():
            audio_path.unlink(missing_ok=True)

        def complete(catalog):
            for e in catalog["episodes"]:
                if e["index"] == index:
                    e["status"] = "done"
                    e["model"] = args.model
                    e["diarized"] = not args.no_diarize
                    e["processed_at"] = datetime.now().astimezone().isoformat()
                    e["error"] = None
                    e["transcript_path"] = str(txt_path)
            return True

        with_catalog_lock(complete)
        print(f"== DONE: episode {index} ==")
        return 0
    except subprocess.CalledProcessError as e:
        err = f"download failed (curl exit {e.returncode})"
    except Exception as e:  # noqa: BLE001 - surface any pipeline failure
        err = f"{type(e).__name__}: {e}"
        print(f"ERROR ep{index}: {err}")
    finally:
        if not args.keep_audio and audio_path.exists():
            try:
                audio_path.unlink()
            except OSError:
                pass

    def fail(catalog):
        for e in catalog["episodes"]:
            if e["index"] == index:
                e["status"] = "error"
                e["error"] = err
        return True

    with_catalog_lock(fail)
    return 1


if __name__ == "__main__":
    sys.exit(main())