# Regulation Podcast — Local Transcripts

Build a complete local transcript archive of every episode of **The Regulation
Podcast** (feeds.megaphone.fm/fface), one episode at a time to keep disk usage
tiny. Design rationale: [DESIGN.md](DESIGN.md)

## Requirements

- Windows + PowerShell, Python 3.11/3.12
- (Optional but recommended) NVIDIA GPU for fast transcription — e.g. RTX 5080.

## Setup

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu128
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

### Hugging Face token (for speaker labels)

Speaker attribution uses the gated `pyannote/speaker-diarization-3.1` model:
1. Accept the terms at https://huggingface.co/pyannote/speaker-diarization-3.1
2. Create a token at https://huggingface.co/settings/tokens
3. Paste it into `data/hf_token.txt` (one line, gitignored)

## Usage

```powershell
# 1. Build the episode manifest (source of truth + progress log)
python scripts/fetch_catalog.py

# 2. Transcribe the next pending episode, oldest -> newest (with speaker labels)
python scripts/transcribe_episode.py

#    - a single specific episode:
python scripts/transcribe_episode.py --index 12
#    - skip speaker labels (no token / text only):
python scripts/transcribe_episode.py --no-diarize
#    - keep the audio file around after transcribing:
python scripts/transcribe_episode.py --keep-audio

# 3. Run the entire archive end-to-end (one episode at a time)
powershell -ExecutionPolicy Bypass -File scripts/run_all.ps1 -Quiet
```

Each finished episode lands in `data/transcripts/` as
`0001 - YYYY-MM-DD - <Ep Title>.txt` (+ `.json` with timestamped segments).
Each segment carries a `[HH:MM:SS] SPEAKER_00` label (cluster id — mapping
clusters to real names can be added later via voice enrollment). The `.json`
also stores a 256-dim `speaker_embeddings` fingerprint per cluster, so you can
resolve `SPEAKER_xx` to the actual hosts after the audio is deleted.
The downloaded mp3 is deleted after transcription. `data/catalog.json` tracks
per-episode status; a crash just leaves the current episode "error" and the
pipeline resumes cleanly on the next run.