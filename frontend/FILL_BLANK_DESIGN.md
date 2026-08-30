# Regulation Fill in the Blank — product and curation notes

## Game shape

- The game lives at `/blank` and does not replace Regulation Who Said It.
- Each run serves 10 damaged quotes from a curated 50-question bank.
- A run contains three easy, four medium, and three hard repairs.
- The immediately previous ten questions are avoided whenever the remaining
  bank can satisfy the difficulty mix.
- Every question removes one exact span from a verified transcript quote and
  offers four editorially written replacements.
- A choice locks immediately. The correct repair is shown in the full quote,
  followed by the three preceding transcript turns and the attributed quote.
- Number keys 1–4 select answers on desktop; all controls remain touch friendly.
- Device-local history records games, personal best, and lifetime accuracy.

## Editorial direction

The missing text should be funny to reconstruct, not merely difficult to guess.
The strongest blanks are concrete nouns, suspicious measurements, invented
phrases, or a final turn that changes the sentence from ordinary to absurd.

Distractors are manually written to satisfy three rules:

1. every option should fit the sentence grammatically;
2. at least two wrong answers should feel plausible in the show’s universe;
3. the correct answer must still produce the funniest or most specific line.

The bank reuses source quotes from `who-said-it-bank.json`, which means speaker,
episode, publication date, timestamp, lead-in context, and attribution have
already passed the Who Said It transcript checks. `fill-blank-bank.json` stores
only the source quote ID, exact missing span, options, and game difficulty.

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
span is highlighted and four large choices sit directly below it. After a
choice, both the selected repair and the correct repair remain visible.

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

