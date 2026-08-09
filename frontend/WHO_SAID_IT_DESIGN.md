# Who Said It — game and curation notes

## Game shape

- A run serves 10 quotes sampled from a 30-quote bank.
- Every run guarantees at least two quotes from Geoff, Andrew, Gavin, and Eric.
- The remaining two slots are sampled from the unused bank, then the full run is shuffled.
- A choice locks immediately. The game reveals the correct host, episode, date,
  transcript timestamp, and a short context note before continuing.
- The result screen scores the run and keeps the full accusation/reveal record.

## Transcript analysis

`scripts/analyze_who_said_it.py` joins each local transcript's diarized speaker
labels to `data/speaker_map.json`, restricts the search to G01–G04, and removes
obvious ad reads and show boilerplate. It ranks 7–34-word segments using:

- absurd or unusually concrete nouns;
- suspicious specificity and numbers;
- hypothetical/scenario language;
- overcommitment and strong wording;
- archive-specific vocabulary;
- quotable length and connection to an episode-defining premise.

The score is only a discovery aid. Every shipped quote was manually checked in
its surrounding transcript, rejected if it was a fragment or attribution looked
unclear, and lightly trimmed only for readability.

## Bank balance

The final bank contains 30 unique quotes from 30 different episodes:

- Geoff: 8
- Andrew: 8
- Gavin: 7
- Eric: 7

Each record in `app/data/who-said-it-bank.json` has a stable ID, quote, speaker,
episode number and title, publication date, timestamp, difficulty, topic, and
post-answer context. `/who-said-it/bank` exposes the complete bank with search
and host/difficulty filters so it can be reviewed without reading source code.

## Editorial rule

The game is an archive comedy game, not a speaker-identification benchmark.
Funny, self-contained lines beat perfect linguistic separability. Difficulty is
assigned editorially based on how strongly the line resembles a host's recurring
conversational habits without giving away a name.
