"""Transcribe exactly one Regulation Podcast episode.

Pipeline (per episode):
  1. pick the next `pending` episode from data/catalog.json (oldest first),
     or a specific one via --index
  2. download the audio into data/tmp/{episode}.mp3 (resumable, via curl)
  3. transcribe with faster-whisper (large-v3-turbo, English, GPU)
  4. write data/transcripts/000N - {title}.txt  (+ .json with segments/words)
  5. delete the audio file, mark the episode `done`

On any failure the episode is marked `error` (error message recorded) and the
partial audio is deleted; the manifest is left consistent so the pipeline can
simply be re-run. `--index` re-processes a specific episode regardless of state.

Usage:
    python scripts/transcribe_episode.py [--index N] [--model large-v3-turbo]
                                         [--device auto] [--language en]
                                         [--keep-audio]
"""

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "data" / "catalog.json"
TMP_DIR = ROOT / "data" / "tmp"
TRANSCRIPTS_DIR = ROOT / "data" / "transcripts"

DEFAULT_MODEL = "large-v3-turbo"

INITIAL_PROMPT = (
    "The Regulation Podcast. Hosts Andrew, Nick, Eric, Geoff and Gavin. "
    "F**kface, Sausage, Regulation, Rooster Teeth."
)


def load_catalog() -> dict:
    if not CATALOG.exists():
        raise SystemExit(f"No catalog at {CATALOG}. Run: python scripts/fetch_catalog.py")
    return json.loads(CATALOG.read_text(encoding="utf-8"))


def save_catalog(catalog: dict) -> None:
    CATALOG.write_text(json.dumps(catalog, indent=2, ensure_ascii=False), encoding="utf-8")


def pick_episode(catalog: dict, index: int | None) -> dict:
    episodes = catalog["episodes"]
    if index is not None:
        for ep in episodes:
            if ep["index"] == index:
                return ep
        raise SystemExit(f"No episode with index {index}.")
    pending = [ep for ep in episodes if ep["status"] == "pending"]
    if not pending:
        raise SystemExit("No pending episodes — all done, or all errored. "
                         "Use --index to force a specific episode.")
    return pending[0]


def safe_title(title: str, max_len: int = 120) -> str:
    import re
    t = re.sub(r'[<>:"/\\|?*\x00-\x1f]', " ", title)
    t = re.sub(r"\s+", " ", t).strip().rstrip(".")
    return t[:max_len].rstrip()


def download_audio(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    cmd = ["curl.exe", "-L", "--fail", "--silent", "--show-error", "-C", "-",
           "--retry", "5", "--retry-delay", "2", "-o", str(dest), url]
    print(f"  downloading -> {dest.name}")
    subprocess.run(cmd, check=True)
    size = dest.stat().st_size if dest.exists() else 0
    print(f"  downloaded {size / 1024 / 1024:.1f} MB")
    if size == 0:
        raise RuntimeError("downloaded file is empty")


def format_duration(seconds: float) -> str:
    h, rem = divmod(int(seconds), 3600)
    m, s = divmod(rem, 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


def add_cuda_dll_dirs() -> None:
    """Make ctranslate2's CUDA DLLs (cublas/cudnn from the nvidia-* pip wheels)
    loadable on Windows. Requires pip packages nvidia-cublas-cu12 / nvidia-cudnn-cu12."""
    if os.name != "nt":
        return
    try:
        import site
    except ImportError:
        return
    for d in (site.getsitepackages(), site.getusersitepackages()):
        if isinstance(d, str):
            d = [d]
        for base in d:
            for rel in ("nvidia/cublas/bin", "nvidia/cudnn/bin"):
                p = os.path.join(base, rel)
                if os.path.isdir(p):
                    os.add_dll_directory(p)
                    os.environ["PATH"] = p + os.pathsep + os.environ.get("PATH", "")


def transcribe(audio_path: Path, ep: dict, model_name: str, device: str,
               language: str, keep_audio: bool) -> None:
    add_cuda_dll_dirs()
    from faster_whisper import WhisperModel

    try:
        print(f"  loading model '{model_name}' on '{device}' ...")
        model = WhisperModel(model_name, device=device, compute_type="auto")
        print("  model loaded; transcribing (progress: [mm:ss] of episode)...")
        segments, info = model.transcribe(
            str(audio_path),
            language="en" if language in ("en", "english") else language,
            initial_prompt=INITIAL_PROMPT,
            vad_filter=True,
            beam_size=5,
        )

        base = "{:04d} - {} - {}".format(
            ep["index"],
            ep["pub_date"][:10],
            safe_title(ep["title"]),
        )
        txt_path = TRANSCRIPTS_DIR / f"{base}.txt"
        json_path = TRANSCRIPTS_DIR / f"{base}.json"
        TRANSCRIPTS_DIR.mkdir(parents=True, exist_ok=True)

        blocks = []
        segments_out = []
        with txt_path.open("w", encoding="utf-8") as f:
            f.write(f"# Episode {ep['index']}: {ep['title']}\n")
            f.write(f"published: {ep['pub_date']}  |  duration: {format_duration(info.duration)}\n")
            f.write(f"source: {ep['enclosure_url']}\n")
            f.write(f"transcribed: {datetime.now().astimezone().isoformat()}  |  model: {model_name}\n\n")

            for seg in segments:
                stamp = format_duration(seg.start)
                line = seg.text.strip()
                if not line:
                    continue
                f.write(f"\n[{stamp}]\n{line}\n")
                print(f"    [{stamp}] completed  ({line[:60]}...)" if len(line) > 60 else f"    [{stamp}] completed  {line[:80]}")
                blocks.append({"start": seg.start, "end": seg.end, "text": seg.text.strip()})
                segments_out.append({
                    "start": seg.start, "end": seg.end, "text": seg.text.strip(),
                    "words": [{"word": w.word, "start": w.start, "end": w.end} for w in (seg.words or [])],
                })

        json_out = {
            "index": ep["index"],
            "title": ep["title"],
            "pub_date": ep["pub_date"],
            "model": model_name,
            "language": info.language,
            "language_probability": info.language_probability,
            "duration_sec": info.duration,
            "segments": segments_out,
        }
        json_path.write_text(json.dumps(json_out, indent=1, ensure_ascii=False), encoding="utf-8")
        print(f"  transcript written: {txt_path.name} (+ {json_path.name})")
    finally:
        if not keep_audio and audio_path.exists():
            try:
                audio_path.unlink()
                print("  deleted audio file")
            except OSError as e:
                print(f"  warning: could not delete {audio_path}: {e}")


def main() -> int:
    ap = argparse.ArgumentParser(description="Transcribe one episode of the Regulation Podcast")
    ap.add_argument("--index", type=int, help="specific episode index to transcribe")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--device", default="auto")
    ap.add_argument("--language", default="en")
    ap.add_argument("--keep-audio", action="store_true", help="keep the downloaded mp3")
    args = ap.parse_args()

    catalog = load_catalog()
    ep = pick_episode(catalog, args.index)

    print(f"== Episode {ep['index']}: {ep['title']} ==")
    print(f"   published {ep['pub_date']}, {ep['duration_sec']}s")
    print(f"   status: {ep['status']}")

    audio_path = TMP_DIR / f"{ep['index']:03d}.mp3"
    ep["status"] = "downloading"
    save_catalog(catalog)

    try:
        download_audio(ep["enclosure_url"], audio_path)
        ep["status"] = "transcribing"
        save_catalog(catalog)

        import re
        base = "{:03d} - {} - {}".format(ep["index"], ep["pub_date"][:10], safe_title(ep["title"]))
        txt_path = TRANSCRIPTS_DIR / f"{base}.txt"
        json_path = TRANSCRIPTS_DIR / f"{base}.json"
        if txt_path.exists() and json_path.exists():
            print(f"  transcript already exists ({txt_path.name}); skipping model work")
        else:
            for leftover in (txt_path, json_path):
                if leftover.exists():
                    leftover.unlink()
            transcribe(audio_path, ep, args.model, args.device, args.language, args.keep_audio)

        ep["status"] = "done"
        ep["model"] = args.model
        ep["processed_at"] = datetime.now().astimezone().isoformat()
        ep["error"] = None
        ep["transcript_path"] = str(txt_path)
        if not args.keep_audio and audio_path.exists():
            audio_path.unlink(missing_ok=True)
        save_catalog(catalog)
        print(f"== DONE: episode {ep['index']} ==")
        return 0
    except subprocess.CalledProcessError as e:
        ep["status"] = "error"
        ep["error"] = f"download failed (curl exit {e.returncode})"
    except Exception as e:  # noqa: BLE001 - surface any pipeline failure.
        ep["status"] = "error"
        ep["error"] = f"{type(e).__name__}: {e}"
        print(f"ERROR: {ep['error']}")
    finally:
        if not args.keep_audio and audio_path.exists():
            try:
                audio_path.unlink()
                print("  deleted partial audio")
            except OSError:
                pass
        save_catalog(catalog)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())