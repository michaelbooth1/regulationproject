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
.venv\Scripts\python.exe -m pip install -r requirements.txt   # faster-whisper
```

## Usage

```powershell
# 1. Build the episode manifest (source of truth + progress log)
python scripts/fetch_catalog.py

# 2. Transcribe the next pending episode, oldest -> newest
python scripts/transcribe_episode.py

#    - a single specific episode:
python scripts/transcribe_episode.py --index 12
#    - keep the audio file around after transcribing:
python scripts/transcribe_episode.py --keep-audio

# 3. Run the entire archive end-to-end (one episode at a time)
powershell -File scripts/run_all.ps1
```

Each finished episode lands in `data/transcripts/` as
`0001 - YYYY-MM-DD - <Ep Title>.txt` (+ `.json` with timestamped segments).
The downloaded mp3 is deleted after transcription. `data/catalog.json` tracks
per-episode status; a crash just leaves the current episode "error" and the
pipeline resumes cleanly on the next run.