# Regulation Fill in the Blank — product and curation notes

## Game shape

- The game lives at `/blank` and does not replace Regulation Who Said It.
- Each run serves 10 damaged quotes from a curated 60-question bank. Players
  type the missing words; there are no multiple-choice options.
- A run contains three easy, four medium, and three hard repairs.
- The bank contains 15 easy, 25 medium, and 20 hard files. Difficulty is an
  editorial estimate of how hard the missing words are to type from the
  sentence, the letter pattern, and memory of the bit. It decides the round
  mix, not the reward.
- The immediately previous ten questions are avoided whenever the remaining
  bank can satisfy the difficulty mix. The bank is sized at roughly twice the
  3/4/3 minimum per difficulty so that avoidance works.
- Every question uses a verified transcript prompt no longer than 145
  characters and removes one exact span of one to three words.
- After a question is solved or failed, the restored line is shown, followed by
  three preceding transcript sentences and the attributed quote.
- Device-local history records games, personal best, points, solves, and clean
  solves.
- The complete spoiler-filled review desk lives at `/blank/bank`. It shows all
  60 damaged lines, their accepted and rejected forms, attribution, source IDs,
  and optional transcript context.
- Review-desk removal marks persist in the current browser and affect the next
  game immediately. They do not edit the published JSON; the page can copy a
  stable ID list for permanent editorial cleanup.
- The picker prefers unmarked questions while retaining the three/four/three
  difficulty mix. If a difficulty is over-curated, it uses only the minimum
  number of marked files required to keep a ten-question game playable.

## Why typed answers

The game began as multiple choice with three hand-written decoys per question.
The decoys were the weakest part of the bank: four comparably plausible answers
are slow to write, and a decoy that is slightly off gives the real answer away.
Typing the missing words removes decoys entirely. Curation becomes "pick a good
line and say what else counts as right".

Typing is harder than recognising: a four-way choice always gives 25%, a blank
text box gives nothing. The game makes up for that with a free letter-count
pattern, paid letter hints, and a lenient matcher.

## Core loop

1. Show the damaged quote. The blank appears as letter tiles, one per letter,
   grouped by word, with punctuation already filled in:
   `▢▢▢▢▢▢ ▢▢▢▢▢▢▢▢` for "shower curtains", `▢▢▢▢-▢-▢▢▢▢▢` for "port-a-potty".
2. The player types into a single text input under the quote. What they type
   shows up live in the tiles (overflow letters spill past the last tile in a
   muted style rather than getting cut off).
3. **Enter** / **Submit** checks the guess.
   - Correct → solved, reveal.
   - Near miss (see matcher) → "So close — check your spelling." Costs nothing;
     once per question.
   - Wrong → lose a point, the guess is added to a struck-through list under
     the input, the input clears, keep going.
4. **Hint** reveals the next letter of every word, left to right, and costs a
   point.
5. **Give up** reveals the answer for 0 points.
6. The reveal shows the restored line, three lead-in lines with speaker names,
   and the case note, then **Next damaged line**.

## Scoring

Each question starts at **3 points**. Every wrong guess and every hint takes
off 1. When it hits 0 the question fails and the answer is revealed.

| Path | Points |
| --- | --- |
| First guess, no hints | 3 |
| One wrong guess or one hint, then correct | 2 |
| Two misses/hints, then correct | 1 |
| Third miss, or give up | 0 |

- Hint is disabled at 1 point, so the last point always goes to a guess.
- Hints never reveal the last letter of a word. A word stops getting letters
  once only its last letter is hidden, and Hint is disabled when every word has
  reached that point (so a one-letter word never gets a hint).
- Submitting the same normalised guess twice is ignored (no second penalty).
- Empty or whitespace-only submits do nothing.
- A run is 10 questions, so the max is **30**. The results page shows
  points / 30, solved / 10, and clean solves (3-pointers).
- Difficulty does not change point values.

## Answer matching

`app/fill-blank-match.ts` is a pure module with no React dependency. The game,
the review desk, the bank loader, and the unit tests share it.

### 1. Normalise (both the guess and every accepted answer)

1. Unicode NFKD, strip combining marks (`Pokémon` → `pokemon`).
2. Lowercase.
3. Straighten curly quotes; delete apostrophes (`somebody's` → `somebodys`).
4. Turn hyphens, slashes, underscores and other punctuation into spaces.
5. Collapse whitespace, trim.
6. Drop a single leading article: `a`, `an`, `the`.
7. Make a **compact** form with all spaces removed. Comparisons use this, so
   `port-a-potty`, `porta potty` and `portapotty` all match each other.

### 2. Equivalence passes (cheapest first; the first hit wins)

| Pass | Example | Verdict |
| --- | --- | --- |
| Compact forms are equal | `The Fan` = `the fan` = `fan` | exact |
| Equal after dropping a trailing `s`/`es` on the last word | `shower curtain` = `shower curtains` | accepted |
| Matches a curated `accept` alias (same normalisation) | `Serkis` for `Andy Serkis` | accepted |
| Weighted edit distance within budget | `Andy Sirkis`, `wafle iron` | accepted (typo) |
| Within budget + 1 | `andy surkus` | near miss |
| Anything else | | wrong |

A curated `reject` list beats every pass except the first. It exists for
known false positives spotted in the review desk.

### 3. Weighted edit distance

Damerau–Levenshtein (optimal string alignment) on the compact strings:

- insert, delete, adjacent transposition: **1**
- substitute a **QWERTY-adjacent** key (`i`↔`u`, `n`↔`m`): **1**
- substitute vowel for vowel (`serkis`↔`serkus`): **1**
- any other substitution: **2**

Budget by the length of the compact answer:

| Answer length | Budget |
| --- | --- |
| 1–3 | 0 (exact only) |
| 4–5 | 1 |
| 6–9 | 2 |
| 10+ | 3 |

The first letter has to match for a typo or near-miss verdict, unless the edit
is a swap of the first two letters. This one rule blocks most "different real
word" false positives.

- `milk` → `mlik` (transposition, 1) accepted; `mink` (l→n not adjacent, 2)
  rejected.
- `beans` → `beams` (n→m adjacent, 1) accepted; `bears` (n→r, 2) rejected.
- `bowel` → `bowl` (deletion, 1) accepted. Add it to `reject` if it becomes a
  problem.
- `gravy` → `grave`: `y`↔`e` are not adjacent and `y` is not a vowel, so cost 2:
  near miss, not accepted.

The matcher returns `{ verdict, reason, matchedForm, distance }`, so the reveal
can say *"you typed 'wafle iron'"* when a typo was let through.

### 4. What the matcher won't do

No synonyms, no stemming beyond the trailing `s`, no phonetic matching, no
number words (`10` vs `ten`). Each would add false positives across the whole
bank; per-question `accept` aliases cover the real cases more safely.

## Bank format

`fill-blank-bank.json` entries:

```json
{
  "id": "fresh-curtains",
  "quoteId": "transcript-curtains",
  "excerpt": "optional exact substring",
  "answer": "shower curtains",
  "accept": ["curtains"],
  "reject": [],
  "difficulty": "medium"
}
```

- `accept` / `reject` are optional, at most 6 each.
- Load-time checks in `fill-blank-data.ts`, on top of the excerpt, length and
  single-occurrence checks:
  - the answer is 1–3 words and has at least one letter or digit;
  - every `accept` normalises to something other than the answer and other
    than each other;
  - every `accept` judges as accepted, and every `reject` judges as wrong.
- Each `FillBlankQuestion` carries a `pattern` of letter, fixed-punctuation
  and space cells, built once at load.
- Tests additionally require that no entry carries the retired `distractors`
  field and that every `accept` alias is one the matcher would not already
  accept on its own.

## Editorial direction

Start with what makes the actual conversation funny: an unnecessary invention,
a surprisingly specific confession, a bad justification, or ordinary logic
taken too far. The missing span should hide the detail that makes the thought
distinctive, so restoring it delivers the line's comic turn. Avoid filler,
arbitrary quantities, and blanks whose answers are already repeated elsewhere
in the visible sentence.

For typed blanks, the test is: **could a fan who remembers the bit, or a
newcomer reading closely, type this?**

1. **Inferable or memorable.** The sentence, the letter count, or the bit
   itself should point to the answer. "dear ____, please look after Millie"
   (5 letters) is great. "the ____ philosophy" → `child picking` isn't.
2. **Few rival completions.** If several common words fit the sentence and the
   tile count, the blank is a coin flip (`balloons and ____ on drones` →
   `knives`).
3. **Spellable.** Avoid obscure proper nouns unless the bit is the name. If a
   name stays, add a surname-only alias.
4. **Still the punchline.** The blank should hide the comic turn.
5. **Write the `accept` list while curating:** surname-only names, alternate
   spellings and regional terms (`bog roll`, `porta-loo`), and the near forms a
   fan would reasonably type (`bat` for `baseball bat`, `waffle maker` for
   `waffle iron`). Check each one with `judgeGuess`; don't add plurals,
   articles, spacing or hyphen variants, or small typos, since the matcher
   already accepts them.
6. **Don't spoil another blank.** A visible prompt should not contain another
   question's answer (two sleep spaghetti lines would give each other away).

The review desk's **Try a guess** box and its log of guesses players typed are
the main tools for growing alias lists from real play rather than guesswork.

## Current bank

The October 2026 typed-answer pass started from the September 2026 bank of 50
multiple-choice selections:

- **Kept as they were (20):** Alexa, Andy Serkis, in a circle, the fan, jelly
  bean hole, play chess, weaver dies, waffle iron, baseball bat, iPad, bat
  enthusiast, Nintendo Switch, toilet scrubber, ASMR channel, bowel, gambling,
  milk, gravy, beans, shower curtains.
- **Kept and graded harder (12):** inverse throat (easy → medium); training,
  ride the skateboard, port-a-potty, kidnapping myself, bird toilet (medium →
  hard); Anthony Bourdain, snake, goose, eggs, wore hats, hot dog guy (already
  hard).
- **Retired (18):** magnet of itself, cover a noodle, Canadian law, child
  picking, Sylvia Spaghetti, a harder burger, pretend store, ham sandwich, hot
  dog buns, hot dog, stick feathers, knives, melting pot, win an award, having
  a meeting, Bovril, magnet, steal somebody's pie. Most only worked because
  four options framed the guess.
- **Added (28):** 7 easy, 14 medium, 7 hard, chosen with the rules above.

All 60 selections come from 60 distinct episodes. Host distribution follows the
material: Andrew 26, Geoff 12, Gavin 12, Eric 10. Equal host counts are
unnecessary for a word-completion game and should not force weaker selections
into the bank.

The bank uses its own `fill-blank-sources.json`, independent of the Who Said It
bank. Source records keep episode metadata, raw transcript filename, segment
ranges, character offsets, timestamps, mapped attribution, and three preceding
sentences. Consecutive ASR fragments from the same speaker are joined with
spaces; wording is preserved. Ellipses mark omitted text around an excerpt.
Context notes are editorial summaries, not quotations. Attribution is checked
against the existing speaker map; these selections have not been reverified
against the audio.

Tests check every source passage and context sentence against the raw archive,
including order, timestamp, and speaker mapping. The application separately
checks excerpts, missing spans, and alias validity when loading the bank.

## Visual system

The page extends the Regulation evidence-file direction:

- full-width warm gray field rather than a black page;
- black rules, square paper panels, hard offset shadows, and yellow evidence
  highlights;
- oversized lowercase headlines and compact monospaced file labels;
- the blank as a row of letter tiles inside the quote, with the text input
  directly beneath it;
- the existing host colors appear only after attribution is restored.

## Page states

### Intro

The first viewport explains the mechanic, offers an immediate start action, and
shows one sample evidence card: the quote with tiles, a mocked input showing
`alexa`, and a "+3" stamp. Stats row: *Question bank · Repairs per run · Max
score 30*. Fine print explains the 3-point scoring and that small spelling
slips are forgiven.

### Question

```
 Blank 04          17 pts / streak 2
 ███████████░░░░░░░░░░░░░░░░░░░░
 medium file              1 2 3 [4] 5 6 7 8 9 10

 ┌──────────────────────────────────────────────┐
 │ "I used seven-month expired dough and cooked │
 │  it in a ▢▢▢▢▢▢ ▢▢▢▢, and I would have        │
 │  scored higher than that."                   │
 │                    2 words · 6, 4 letters    │
 └──────────────────────────────────────────────┘

  ●●○  worth 2                    ~~toaster~~
 ┌────────────────────────────┐ ┌────────┐
 │ waffle i▌                  │ │ Submit │
 └────────────────────────────┘ └────────┘
  [ Hint −1 ]  [ Give up ]
```

- The input is a real `<input type="text">` with `autoComplete="off"`,
  `autoCorrect="off"`, `autoCapitalize="none"`, `spellCheck={false}`,
  `enterKeyHint="go"`, `maxLength={48}`. Autocorrect is off on purpose.
- The input gets focus on question load and after **Next** (a user gesture,
  so mobile keyboards open too). On mobile it sits right under the quote card
  and calls `scrollIntoView({ block: "nearest" })` on focus, so the quote stays
  visible above the keyboard.
- The points meter (●●●) drains as guesses and hints are spent.
- A wrong guess shakes the tiles (skipped under `prefers-reduced-motion`) and
  adds the guess to a struck-through list.
- Revealed letters are locked into their tiles in a different ink and can't
  be changed. Typed letters skip them and fill the remaining tiles in order,
  so after a hint the player types only the missing letters. The guess judged
  is the whole blank, locked letters included. Taking a hint drops any typed
  letter that was sitting in a tile it locks.
- The source topic stays hidden until reveal, because several archive labels
  would reveal the missing phrase.

### Reveal

The restored full line appears first. Beneath it, the reveal shows exactly
three earlier transcript sentences followed by the quote, with speaker names
restored. The case note names the speaker and includes episode, title, date,
and timestamp. The header reads "Repair accepted · +2" (plus "you typed
'wafle iron'" when a typo was accepted) or "Repair rejected · +0" with the
list of guesses. **Enter** on the focused Next button moves on, so a keyboard
player can run type → Enter → Enter.

### Results

- Big score `21 / 30`, with solved and clean-solve counts underneath.
- Verdict thresholds on the 30-point scale (30 perfect, ≥24, ≥18, ≥9, under 9).
- Difficulty breakdown shows points per difficulty.
- The restoration record shows each line, the points earned (●●○), and for
  misses, what the player typed. The player can start another round or return
  to Who Said It.

## Review desk (`/blank/bank`)

- Each card lists **Accepted forms** (answer + `accept`) and **Rejected
  forms**.
- A **Try a guess** box on each card runs the live matcher and shows the
  verdict and distance.
- **Guesses players typed here** lists every wrong or near-miss guess made on
  this device, per question, stored locally (capped at 20 per question). One
  click copies a suggested `accept` entry.
- Search covers blanks, answers, aliases, logged guesses, episodes, and IDs.
- Removal marks use the `regulation-fill-blank-removals-v5` key; marks made
  while judging multiple-choice decoys do not carry over.

## State model (per question)

```
answering { points: 3→1, revealed: 0..n, guesses: string[], nearMissUsed }
  submit(g)  → exact|accepted        → solved(points)
             → near && !nearMissUsed → answering(nearMissUsed = true)
             → wrong                 → points-1 ; 0 ? failed : answering
  hint()     → points-1, revealed+1          (needs points ≥ 2)
  giveUp()   → failed
solved | failed → reveal → next()
```

`AnswerRecord` is `{ question, guesses, hintsUsed, points, solved,
acceptedAs? }`.

## Storage

- `regulation-fill-blank-stats-v2`: `{ games, best, totalPoints, totalSolved,
  totalClean, totalQuestions }`. The multiple-choice v1 stats are left alone;
  the two scores aren't comparable.
- `regulation-fill-blank-guesses-v1`: `{ [questionId]: string[] }` for the
  review desk.
- `regulation-fill-blank-removals-v5`: review-desk removal marks.
- Every read and write is wrapped in try/catch.

## Accessibility and responsive behavior

- The input has the visible label "Type the missing words". The tiles are
  `aria-hidden` and the pattern gets an `aria-label` instead: "2 words: 6
  letters, 4 letters; first letters W, I" once hinted.
- Wrong / near-miss / solved feedback goes through one polite live region.
- Hint and Give up are real buttons with `aria-disabled` and an explanation
  when they're unavailable; all controls keep visible focus.
- Tiles stay at least 1.6ch wide and wrap per word on narrow screens. No word
  is split across lines.
- The desktop question surface uses the available viewport height; revealed
  context can extend the document naturally.
- Navigation and controls collapse cleanly at mobile widths without horizontal
  scrolling or text smaller than the existing site's secondary labels.

## Open questions

1. **Is the free letter-count pattern too generous** for hard files? Option:
   hard files show only the word count until the first hint.
2. **Difficulty multiplier** (e.g. hard ×1.5)? Currently no, to keep the score
   easy to read.
3. **Near-miss freebie:** once per question as now, or not at all?
