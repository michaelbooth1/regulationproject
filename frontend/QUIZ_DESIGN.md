# Regulation Quiz — product and comedy design

## Product promise

This is not a psychological assessment. It is an absurd conversational-alignment
machine: ten escalating situations are drawn from a larger bank, and the result
identifies which of the four primary hosts the player most resembled *inside
those bits*. The result must explain itself using the player's actual choices.

Primary line: **Ten bad decisions. One familiar voice.**

## Corpus grounding

The repeatable research script is `../scripts/analyze_host_language.py`. It reads
the complete speaker-mapped archive and writes
`app/data/host-language-profiles.json`.

| Host | Measured conversational signal | Comedy engine for the quiz |
| --- | --- | --- |
| Geoff | Longest mean turn (47.1 words), most story-language markers, lowest question rate, highest profanity rate | Turns a minor event into personal lore; commits emotionally to the version that makes the best story |
| Andrew | 39.6-word mean turn, strongest first-person and negation rates, distinctive language around scenarios, premises, context, categories, and “second of all” | Builds a defensible alternate legal system around an absurd premise; finds the edge case and lives there |
| Gavin | Highest question rate (131.9 per 1,000 segments), fastest speech, most hypothetical and physical-language markers, frequent “what if we…” and “could potentially…” | Finds the unanswered physical question; runs the tiny dangerous experiment everyone else overlooked |
| Eric | Strongest agreement, intensifier, “we,” and control-language rates; shortest/most operational turns; frequent “hang on,” voting, picks, and decisive questions | Referees the room, names the insanity, creates a format, and keeps the bit from consuming the month |

The episode-title corpus supplies recurring comic ingredients rather than trivia:
drafts, sausage talk, hot dogs, bean holes, cosmic crisps, malls, horses, tubs,
sleep, tuxedos, sloppy joes, dogs, bets, supplemental episodes, and regulation
versions of things that did not previously require regulation.

## Question-writing rules

1. Start with a normal decision, then add one unnecessary physical or procedural
   complication: a bean hole, a formal draft, a bathtub measurement, an apple
   ranking, a ceremonial pencil, or a person dressed for the wrong event.
2. Answers should be funny before the player knows which host they score for.
   Never write “the responsible answer” beside three joke answers.
3. Score conversational behavior, not biography. Avoid “Do you like bikes?” or
   “Are you British?” The player should resemble how a host handles the premise.
4. Every answer carries a short evidence sentence used verbatim on the result
   page. The explanation therefore comes from the player's choices rather than
   a generic horoscope paragraph.
5. The four recurring engines are story escalation, premise lawyering,
   experimental curiosity, and reality refereeing. Secondary points allow a
   choice to contain more than one flavor of chaos.
6. Exactly ten categories appear in a run. The bank contains multiple questions
   per category so retakes change the situations without becoming unbalanced.

## Experience design

- **Intro:** one loud promise, four host stamps, corpus/bank counts, and a single
  start control. Say plainly that it is “scientifically unnecessary.”
- **Quiz:** one question at a time, visible category and progress, four large
  answer cards, Back/Next controls, keyboard focus, and no countdown timer.
- **Result:** large host-color takeover, match title, three answer-specific
  reasons, all four score bars, one transcript-analysis signal, and Retake.
- **Visual direction:** editorial evidence board meets brightly colored game-show
  paperwork. Warm paper, black ink, four loud host colors, stamps, ruled lines,
  oversized type, and slightly misregistered decorative blocks. No fake podcast
  photography and no clinical personality-test language.

## Scoring

- Each answer gives 3 points to its primary conversational engine and may give
  1 point to a compatible secondary engine.
- The result is the highest total after ten questions. Ties resolve by number of
  direct 3-point answers, then stable host order so the same answers always
  produce the same result.
- The result explanation selects the three chosen answers that contributed the
  most to the winner and displays their evidence sentences.
- The full four-host score distribution stays visible. The quiz should feel
  transparent, playful, and replayable—not mysteriously authoritative.
