# Regulation Who Said It

A transcript-powered fan game for identifying which Regulation Podcast host
said an absurd line. Each game draws ten quotes from a curated 100-quote bank,
reveals the three preceding transcript lines after an answer, and reports the
player's results by host.

The app is intentionally self-contained: gameplay, history, and lifetime stats
run in the browser, while the quote bank and mapped-episode count are bundled at
build time. It does not require a database or user account.

## Important files

- `app/WhoSaidItGame.tsx` — game stages, answers, keyboard controls, results,
  and optional browser-persisted statistics
- `app/who-said-it-round.ts` — balanced round selection and repeat avoidance
- `app/WhoSaidItBankBrowser.tsx` — searchable, spoiler-filled quote-bank view
- `app/HostBadge.tsx` — shared host attribution badge
- `app/data/who-said-it-bank.json` — curated quotes, sources, and reveal context
- `app/who-said-it-data.ts` — quote types and shared transcript formatting
- `tests/rendered-html.test.mjs` — rendered-route and quote-bank integrity tests
- `WHO_SAID_IT_DESIGN.md` — product rules, tone, and selection rationale

## Quote-bank guarantees

The automated tests enforce the assumptions used by the game:

- 100 unique quotes and 100 distinct source episodes
- 25 quotes for each of Geoff, Andrew, Gavin, and Eric
- 34 easy, 33 medium, and 33 hard entries
- every mystery quote is shorter than 200 characters
- mystery quotes do not contain an eligible host's name
- every reveal contains exactly three earlier transcript lines

Round selection independently guarantees at least two quotes from every host
and a `3 easy / 4 medium / 3 hard` difficulty mix. It prefers entries that did
not appear in the immediately preceding game.

## Local development

Requires Node.js 22.13 or newer and pnpm.

```bash
pnpm install
pnpm dev
```

The primary routes are:

- `/` — game
- `/who-said-it` — direct game URL
- `/blank` — ten-question typed-answer transcript fill-in-the-blank game
- `/blank/bank` — all 60 blanks, accepted answers, a guess tester, and source context
- `/who-said-it/bank` — fully attributed quote bank

The fill-in-the-blank game has 60 questions from 60 distinct episodes, stored
in `app/data/fill-blank-bank.json`. Players type the missing words, and
`app/fill-blank-match.ts` forgives case, punctuation, articles, plurals,
per-question aliases, and small typos. Its independent
`app/data/fill-blank-sources.json` records exact transcript passages, segment
ranges, timestamps, speaker mappings, and three preceding sentences. Tests
verify these against the raw archive. See `FILL_BLANK_DESIGN.md` for the
interaction and curation rules.

## Validation

```bash
pnpm run lint
pnpm test
```

`pnpm test` creates the production Worker build before checking rendered HTML,
data balance, quote constraints, transcript context, and key responsive styles.

## Cloudflare deployment

Wrangler authentication is required once on a new machine:

```bash
pnpm exec wrangler login
```

Then build and deploy the existing Cloudflare Worker with:

```bash
pnpm run deploy:cloudflare
```

Use `pnpm run deploy:cloudflare:dry-run` to validate the upload bundle without
changing the live Worker.
