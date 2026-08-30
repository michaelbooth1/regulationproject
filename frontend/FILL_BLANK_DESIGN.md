# Regulation Fill in the Blank — product and curation notes

## Game shape

- The game lives at `/blank` and does not replace Regulation Who Said It.
- Each run serves 10 damaged quotes from a curated 50-question bank.
- A run contains three easy, four medium, and three hard repairs.
- The bank contains 10 easy, 20 medium, and 20 hard files; “easy” describes the
  amount of contextual leakage, not throwaway wrong answers.
- The immediately previous ten questions are avoided whenever the remaining
  bank can satisfy the difficulty mix.
- Every question uses a verified transcript prompt no longer than 145
  characters, removes one exact span of one to three words, and offers four
  choices that are each no longer than three words.
- A choice locks immediately. The correct repair is shown in the full quote,
  followed by the three preceding transcript turns and the attributed quote.
- Number keys 1–4 select answers on desktop; all controls remain touch friendly.
- Device-local history records games, personal best, and lifetime accuracy.
- The complete spoiler-filled review desk lives at `/blank/bank`. It shows all
  50 damaged lines, their four choices, correct repairs, attribution, source
  IDs, and optional transcript context.
- Review-desk removal marks persist in the current browser and affect the next
  game immediately. They do not edit the published JSON; the page can copy a
  stable ID list for permanent editorial cleanup.
- The picker prefers unmarked questions while retaining the three/four/three
  difficulty mix. If a difficulty is over-curated, it uses only the minimum
  number of marked files required to keep a ten-question game playable.

## Editorial direction

The blank is the joke. A prompt only belongs in the bank when removing one to
three words conceals its vivid, memorable payoff: the strange object, bodily
image, invented food, impossible action, or exact phrase that made the original
line worth remembering. Never blank connective tissue, filler, a generic verb,
or an ordinary number while leaving the comic image visible.

The damaged sentence should create a real moment of curiosity. Restoring the
answer should deliver the line's comic turn, not merely make an already-complete
joke grammatically accurate.

Distractors are manually written to satisfy five rules:

1. every option should fit the sentence grammatically;
2. every answer is one to three words, with no exception;
3. all four answers should occupy the same semantic class and have a similar
   cadence, specificity, and length;
4. all three wrong answers should be equally vivid, plausible Regulation
   phrases—not ordinary filler sitting beside one conspicuously funny answer;
5. the full restored transcript must still identify one unambiguous historical
   answer.

Decoys should come from the sentence's immediate semantic world: other grotesque
fixtures for a grotesque fixture, other invented foods for an invented food,
other questionable stunts for a questionable stunt, and so on. They should feel
like things the show plausibly could have said without borrowing unrelated
callbacks. The correct answer must not be the sole option wearing a neon comedy
hat, and none of the options should collapse into generic connective language.

The bank primarily reuses attributed records from `who-said-it-bank.json` and
keeps a small companion source file for lines mined specifically for this game.
Both carry speaker, episode, publication date, timestamp, lead-in context, and
attribution. `fill-blank-bank.json` stores the source ID, an optional exact
short excerpt, the missing span, three short distractors, and game difficulty.
The application verifies that excerpts and answers occur verbatim in the source
transcript and constructs the final four choices at runtime, so the repair
cannot drift away from the archive.

## Visual system

The page extends the current Regulation evidence-file direction:

- full-width warm gray field rather than a black page;
- black rules, square paper panels, hard offset shadows, and yellow evidence
  highlights;
- oversized lowercase headlines and compact monospaced file labels;
- a conspicuous yellow blank inside the quote rather than a text input;
- two-by-two answer files on desktop and one answer per row on mobile;
- the existing host colors appear only after attribution is restored.

## Page states

### Intro

The first viewport explains the mechanic, offers an immediate start action, and
shows one completed sample evidence card. It also states the bank size, round
length, and number of possible repairs.

### Question

Progress and file difficulty sit above one dominant quote panel. The missing
span is highlighted and four large choices sit directly below it. The source
topic stays hidden until the answer is locked because several archive labels
would reveal the missing phrase. After a choice, both the selected repair and
the correct repair remain visible.

### Reveal

The restored full line appears first. Beneath it, the reveal shows exactly three
earlier transcript turns followed by the quote, with speaker names restored.
The final case note names the speaker and includes episode, title, date, and
timestamp.

### Results

The closing file reports score, lifetime stats, accuracy by difficulty, and a
complete restoration record. Incorrect choices remain visible beside the right
answer. The player can start another round or return to Who Said It.

## Accessibility and responsive behavior

- Choice buttons expose pressed and disabled states and retain visible focus.
- Reveal content uses a polite live region without announcing hover states.
- The quote’s missing span has an accessible label.
- The desktop question surface uses the available viewport height; revealed
  context can extend the document naturally.
- Navigation and answers collapse cleanly at mobile widths without horizontal
  scrolling or text smaller than the existing site’s secondary labels.
