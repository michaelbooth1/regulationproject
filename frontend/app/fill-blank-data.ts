import rawBank from "./data/fill-blank-bank.json";
import rawExtraSources from "./data/fill-blank-extra-sources.json";
import { WHO_SAID_IT_BANK, type WhoSaidItQuote } from "./who-said-it-data";


export type BlankDifficulty = "easy" | "medium" | "hard";

type FillBlankDefinition = {
  id: string;
  quoteId: string;
  excerpt?: string;
  answer: string;
  distractors: string[];
  difficulty: BlankDifficulty;
};

export type FillBlankQuestion = {
  id: string;
  source: WhoSaidItQuote;
  displayQuote: string;
  answer: string;
  options: string[];
  difficulty: BlankDifficulty;
  beforeBlank: string;
  afterBlank: string;
};

const sourceBank = [
  ...WHO_SAID_IT_BANK,
  ...(rawExtraSources as WhoSaidItQuote[]),
];
const quoteById = new Map(sourceBank.map((quote) => [quote.id, quote]));
const MAX_CHOICE_WORDS = 3;
const MAX_QUOTE_CHARACTERS = 145;

function choiceWordCount(choice: string): number {
  return choice.trim().split(/\s+/).length;
}

/**
 * Join each curated blank to an attributed transcript record. Most sources are
 * shared with Who Said It; the few lines mined specifically for this game live
 * in a small companion source file with the same provenance fields.
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

  if (blank.distractors.length !== 3) {
    throw new Error(`${blank.id} must have exactly three distractors`);
  }

  const options = [blank.answer, ...blank.distractors];
  for (const option of options) {
    const wordCount = choiceWordCount(option);
    if (option !== option.trim() || wordCount < 1 || wordCount > MAX_CHOICE_WORDS) {
      throw new Error(`${blank.id} has a choice outside the 1–${MAX_CHOICE_WORDS} word limit: "${option}"`);
    }
  }

  if (new Set(options.map((option) => option.toLocaleLowerCase())).size !== 4) {
    throw new Error(`${blank.id} must have four distinct choices`);
  }

  const sourceIndex = source.quote.indexOf(displayQuote);
  const omittedBefore = sourceIndex > 0 ? "…" : "";
  const omittedAfter = sourceIndex + displayQuote.length < source.quote.length ? "…" : "";

  return {
    id: blank.id,
    source,
    displayQuote,
    answer: blank.answer,
    options,
    difficulty: blank.difficulty,
    beforeBlank: omittedBefore + displayQuote.slice(0, answerIndex),
    afterBlank: displayQuote.slice(answerIndex + blank.answer.length) + omittedAfter,
  };
});

export const FILL_BLANK_LENGTH = 10;
