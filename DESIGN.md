# Regulation Podcast — Local Transcript Project

## Goal

Produce a local, durable transcript of **every** episode of *The Regulation Podcast*
(https://feeds.megaphone.fm/fface, 415 episodes, May 2020 → present).

## Design principles

1. **One episode at a time.** A full mirror of the audio would be ~60+ GB. We
   instead hold exactly one episode's audio on disk at any moment:
   `download → transcribe → save transcript → delete audio → next`.
2. **Everything is logged.** The `data/catalog.json` manifest is the source of
   truth: one entry per episode with status (`pending|downloading|transcribing|done|error`).
   The pipeline is fully resumable — a crash just leaves the current episode marked
   `error`, and the next run picks up where it stopped.
3. **Free, open-source stack.**
   - Fetch: the public RSS feed (free, no paywall) via Python stdlib.
   - Transcribe: **faster-whisper** (OpenAI Whisper, CTranslate2, Apache-2.0),
     GPU-accelerated on the RTX 5080. It bundles its own audio decoder (PyAV),
     so no system ffmpeg is required.
   - Storage: plain-text transcripts + JSON segments. Tiny.
4. **Never store the whole archive.** Only `data/catalog.json` and the finished
   transcripts are kept on disk (and committed to git). Audio lives in
   `data/tmp/` (gitignored) and is deleted after transcription.

## Data layout

```
regulationproject/
├── requirements.txt
├── DESIGN.md
├── README.md
├── .gitignore
├── scripts/
│   ├── fetch_catalog.py        # RSS → data/catalog.json (the episode log)
│   ├── transcribe_episode.py   # one episode: download → transcribe → save → delete
│   └── run_all.ps1             # convenience loop: transcribe every pending episode
└── data/
    ├── catalog.json            # episode manifest + status (committed)
    ├── raw/                    # cached RSS (gitignored, regenerable)
    ├── tmp/                    # active audio download (deleted after transcribe)
    └── transcripts/
        ├── 0001 - {title}.txt  # plain text with [mm:ss] timestamp headings
        └── 0001 - {title}.json # structured segments + words
```

## Workflow

### Step 1 — Build the manifest (once, and to pick up new episodes)
```powershell
python scripts/fetch_catalog.py
```
Parses the RSS feed, derives a stable chronological index (oldest = #1, newest
episodes get appended as they publish), and writes `data/catalog.json`. Existing
statuses are preserved (matched by enclosure URL), so re-running never loses
progress.

### Step 2 — Transcribe one episode
```
python scripts/transcribe_episode.py              # → the next pending episode
python scripts/transcribe_episode.py --index 12   # → a specific episode
```
Flow per episode:
1. load the next `pending` episode from the manifest
2. mark `downloading`, stream audio into `data/tmp/{episode}.mp3` (resumable)
3. mark `transcribing`, run faster-whisper (model `large-v3-turbo`, English)
4. write `data/transcripts/000N - {title}.txt` (+ `.json` with segments)
5. delete `data/tmp/{episode}.mp3`, mark `done`
   On any failure → mark `error` with message, delete partial audio; rerun resets it.

### Step 3 — Run the whole archive (optional)
```
powershell -File scripts/run_all.ps1
```
Loops Step 2 oldest→newest until every episode is `done`.

## Model choice

- Default: `large-v3-turbo` — near `large-v3` quality at several× faster throughput;
  ideal for ~1-hour episodes.
- This is a conversational podcast with overlapping speakers; Whisper is
  speaker-agnostic, so voice labels are not produced. Episodes that nominally have
  known lineup can be annotated later. Long/intro/outro music can produce mild
  hallucinations — expected and acceptable.
- `initial_prompt` nudges spelling of "Regulation", host names (Andrew, Nick,
  Eric, Geoff, Gavin), "F**kface", "Sausage", etc.

## Cost/complexity notes
- No downloads beyond one episode (~100–180 MB) at a time.
- Model weights (~1.6 GB) are cached by faster-whisper in the HF cache, one-time.
- Transcription speed on RTX 5080 ≈ several× realtime → ~10–20 min per hour-long
  episode, near-zero cost (local).