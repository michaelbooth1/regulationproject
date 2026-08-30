# Regulation Fill in the Blank — product and curation notes

## Game shape

- The game lives at `/blank` and does not replace Regulation Who Said It.
- Each run serves 10 damaged quotes from a curated 50-question bank. The
  current bank is a complete second edition: none of its source quotes overlap
  the retired launch bank.
- A run contains three easy, four medium, and three hard repairs.
- The harder second-edition bank contains 10 easy, 20 medium, and 20 hard
  files; “easy” now describes the amount of contextual leakage, not throwaway
  wrong answers.
- The immediately previous ten questions are avoided whenever the remaining
  bank can satisfy the difficulty mix.
- Every question removes one exact span from a verified transcript quote and
  offers four editorially written replacements.
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

The missing text should be funny to reconstruct, not merely difficult to guess.
The strongest blanks are concrete nouns, suspicious measurements, invented
phrases, or a final turn that changes the sentence from ordinary to absurd.

Distractors are manually written to satisfy five rules:

1. every option should fit the sentence grammatically;
2. every wrong answer must derive its central phrase or premise from another
   audited quote in the archive;
3. all four answers should occupy the same semantic class and have a similar
   cadence, specificity, and length;
4. at least two wrong answers should be credible completions even to a regular
   listener—not merely random jokes;
5. the full restored transcript must still identify one unambiguous historical
   answer.

The preferred decoy vocabulary comes from recurring Regulation dialects: food
engineering, animal logic, fake products, plumbing and body systems, canonical
show bits, and suspiciously exact measurements. Generic absurdity is rejected
when a real archive premise can do the same job more convincingly.

The bank reuses source quotes from `who-said-it-bank.json`, which means speaker,
episode, publication date, timestamp, lead-in context, and attribution have
already passed the Who Said It transcript checks. `fill-blank-bank.json` stores
the source quote ID, exact missing span, three distractors, their archive-source
IDs, and game difficulty. The application constructs the final four choices at
runtime, so the correct answer cannot drift away from the transcript.

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
