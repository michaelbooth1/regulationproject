import rawBank from "./data/fill-blank-bank.json";
import rawSources from "./data/fill-blank-sources.json";
import { compactGuess, isSolved, judgeGuess } from "./fill-blank-match";
import type { WhoSaidItQuote } from "./who-said-it-data";


export type BlankDifficulty = "easy" | "medium" | "hard";

type FillBlankDefinition = {
  id: string;
  quoteId: string;
  excerpt?: string;
  answer: string;
  accept?: string[];
  reject?: string[];
  difficulty: BlankDifficulty;
};

/** One character of the blank: a letter tile, fixed punctuation, or a word gap. */
export type PatternCell =
  | { kind: "letter"; char: string; word: number; position: number }
  | { kind: "fixed"; char: string }
  | { kind: "space" };

export type FillBlankQuestion = {
  id: string;
  source: WhoSaidItQuote;
  displayQuote: string;
  answer: string;
  accept: string[];
  reject: string[];
  difficulty: BlankDifficulty;
  beforeBlank: string;
  afterBlank: string;
  pattern: PatternCell[];
  /** Letter count of each space-separated word in the answer. */
  wordLengths: number[];
};

const sourceBank = rawSources as WhoSaidItQuote[];
const quoteById = new Map(sourceBank.map((quote) => [quote.id, quote]));
const MAX_ANSWER_WORDS = 3;
const MAX_ALIASES = 6;
const MAX_QUOTE_CHARACTERS = 145;
const LETTER = /[\p{L}\p{N}]/u;

function buildPattern(answer: string): { pattern: PatternCell[]; wordLengths: number[] } {
  const pattern: PatternCell[] = [];
  const wordLengths: number[] = [];
  let word = 0;
  let position = 0;
  for (const char of answer) {
    if (char === " ") {
      wordLengths.push(position);
      word += 1;
      position = 0;
      pattern.push({ kind: "space" });
    } else if (LETTER.test(char)) {
      pattern.push({ kind: "letter", char, word, position });
      position += 1;
    } else {
      pattern.push({ kind: "fixed", char });
    }
  }
  wordLengths.push(position);
  return { pattern, wordLengths };
}

/** Letters a hint level reveals in one word; the last letter of every word stays hidden. */
export function revealedLetterCount(wordLength: number, hintLevel: number): number {
  return Math.min(hintLevel, Math.max(0, wordLength - 1));
}

/** True when one more hint would reveal at least one new letter. */
export function canRevealMore(question: FillBlankQuestion, hintLevel: number): boolean {
  return question.wordLengths.some(
    (length) => revealedLetterCount(length, hintLevel + 1) > revealedLetterCount(length, hintLevel),
  );
}

/**
 * This game has its own transcript selections. Short ASR fragments are joined
 * in source order; excerpts remove only a contiguous span of surrounding text.
 * Tests verify the source segments, attribution, and preceding context.
 */
export const FILL_BLANK_BANK: FillBlankQuestion[] = (rawBank as FillBlankDefinition[]).map((blank) => {
  const source = quoteById.get(blank.quoteId);
  if (!source) throw new Error(`Unknown fill-in-the-blank quote: ${blank.quoteId}`);

  const displayQuote = blank.excerpt ?? source.quote;
  if (!source.quote.includes(displayQuote)) {
    throw new Error(`${blank.id} uses an excerpt that is not an exact part of its transcript quote`);
  }
  if (displayQuote.length > MAX_QUOTE_CHARACTERS) {
    throw new Error(`${blank.id} uses a prompt longer than ${MAX_QUOTE_CHARACTERS} characters`);
  }

  const answerIndex = displayQuote.indexOf(blank.answer);
  if (answerIndex < 0) {
    throw new Error(`Answer "${blank.answer}" is not present in ${blank.quoteId}`);
  }
  if (displayQuote.indexOf(blank.answer, answerIndex + blank.answer.length) >= 0) {
    throw new Error(`Answer "${blank.answer}" appears more than once in ${blank.quoteId}`);
  }

  const wordCount = blank.answer.split(/\s+/).length;
  if (blank.answer !== blank.answer.trim() || /\s{2}/.test(blank.answer)
    || wordCount > MAX_ANSWER_WORDS || !LETTER.test(blank.answer)) {
    throw new Error(`${blank.id} needs a 1–${MAX_ANSWER_WORDS} word answer: "${blank.answer}"`);
  }

  const accept = blank.accept ?? [];
  const reject = blank.reject ?? [];
  if (accept.length > MAX_ALIASES || reject.length > MAX_ALIASES) {
    throw new Error(`${blank.id} has more than ${MAX_ALIASES} accept or reject forms`);
  }
  if (new Set([blank.answer, ...accept].map(compactGuess)).size !== accept.length + 1) {
    throw new Error(`${blank.id} has an accept form that duplicates the answer or another alias`);
  }
  const target = { answer: blank.answer, accept, reject };
  for (const form of accept) {
    if (!isSolved(judgeGuess(form, target))) throw new Error(`${blank.id} accept form "${form}" does not match`);
  }
  for (const form of reject) {
    if (isSolved(judgeGuess(form, target))) throw new Error(`${blank.id} reject form "${form}" still matches`);
  }

  const sourceIndex = source.quote.indexOf(displayQuote);
  const omittedBefore = sourceIndex > 0 ? "…" : "";
  const omittedAfter = sourceIndex + displayQuote.length < source.quote.length ? "…" : "";

  return {
    id: blank.id,
    source,
    displayQuote,
    answer: blank.answer,
    accept,
    reject,
    difficulty: blank.difficulty,
    beforeBlank: omittedBefore + displayQuote.slice(0, answerIndex),
    afterBlank: displayQuote.slice(answerIndex + blank.answer.length) + omittedAfter,
    ...buildPattern(blank.answer),
  };
});

export const FILL_BLANK_LENGTH = 10;
export const BLANK_POINTS_PER_QUESTION = 3;
export const BLANK_MAX_SCORE = FILL_BLANK_LENGTH * BLANK_POINTS_PER_QUESTION;
