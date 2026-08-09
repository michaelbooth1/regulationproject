# Regulation Who Said It — game and curation notes

## Game shape

- A run serves 10 quotes sampled from a 100-quote bank.
- Every run guarantees at least two quotes from Geoff, Andrew, Gavin, and Eric.
- Every run contains three easy, four medium, and three hard quotes.
- A replay avoids all ten quotes from the immediately previous game.
- A choice locks immediately. The game first reveals three mapped transcript
  turns leading into the quote, then the correct host, episode, date, timestamp,
  and a short editorial context note before continuing.
- Host choices stay in a consistent order and support the 1–4 keyboard shortcuts.
- The result screen includes the score, share action, device-local history,
  host-by-host accuracy, and the full accusation/reveal record.

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

`--write-lead-ins` rebuilds the three-line reveal context for every quote from
its preceding transcript window. It joins adjacent diarization fragments from
the same named speaker, rejects ads and unnamed voices, and validation confirms
that every shipped excerpt still matches its episode's speaker map.

## Bank balance

The final bank contains 100 unique quotes from 100 different episodes, with the expansion deliberately emphasizing early and middle-era episodes:

- Geoff: 25
- Andrew: 25
- Gavin: 25
- Eric: 25

Difficulty remains nearly even across the full bank: 34 easy, 33 medium, and 33 hard.

Each record in `app/data/who-said-it-bank.json` has a stable ID, quote, speaker,
episode number and title, publication date, timestamp, difficulty, topic, and
post-answer context. `/who-said-it/bank` exposes the complete bank with search
and host/difficulty filters so it can be reviewed without reading source code.

## Editorial rule

The game is an archive comedy game, not a speaker-identification benchmark.
Funny, self-contained lines beat perfect linguistic separability. Difficulty is
assigned editorially based on how strongly the line resembles a host's recurring
conversational habits without giving away a name.
