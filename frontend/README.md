# Regulation Quiz

A replayable comedy quiz that serves ten absurd scenarios from a larger,
balanced question bank and reports whether the player's answers most resemble
Geoff, Andrew, Gavin, or Eric.

This is an entertainment classifier, not a psychological personality test. Its
four scoring dimensions come from descriptive analysis of the locally mapped
podcast transcripts: story escalation, premise lawyering, experimental
curiosity, and reality refereeing.

## Project shape

- `app/QuizApp.tsx` — client-side quiz flow, balanced random draw, scoring, and
  answer-specific result explanation
- `app/quiz-data.ts` — host profiles and the editable question bank
- `app/data/host-language-profiles.json` — generated corpus research used to
  ground the host profiles
- `QUIZ_DESIGN.md` — product promise, evidence, comedy rules, and scoring model
- `../scripts/analyze_host_language.py` — repeatable transcript-analysis script
- `.openai/hosting.json` — Sites project configuration

## Local development

```bash
pnpm install
pnpm dev
```

## Validation

```bash
pnpm test
```

The test command builds the production worker, verifies the rendered landing
page, checks the question-bank balance, and validates the expected linguistic
contrasts in the generated corpus report.

## Refreshing the research

From the repository root, after transcript or speaker-map changes:

```bash
.venv\Scripts\python.exe scripts\analyze_host_language.py
```

The quiz currently keeps all state in the browser for one play session. No user
accounts, tracking, or database are required for the initialized version.
