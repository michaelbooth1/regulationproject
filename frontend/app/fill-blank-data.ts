import rawBank from "./data/fill-blank-bank.json";
import { WHO_SAID_IT_BANK, type WhoSaidItQuote } from "./who-said-it-data";


export type BlankDifficulty = "easy" | "medium" | "hard";

type FillBlankDefinition = {
  id: string;
  quoteId: string;
  answer: string;
  distractors: string[];
  difficulty: BlankDifficulty;
};

export type FillBlankQuestion = {
  id: string;
  source: WhoSaidItQuote;
  answer: string;
  options: string[];
  difficulty: BlankDifficulty;
  beforeBlank: string;
  afterBlank: string;
};

const quoteById = new Map(WHO_SAID_IT_BANK.map((quote) => [quote.id, quote]));
const MAX_CHOICE_WORDS = 3;
const MAX_QUOTE_CHARACTERS = 120;

function choiceWordCount(choice: string): number {
  return choice.trim().split(/\s+/).length;
}

/**
 * Join the curated blank choices to the already-audited quote records. Keeping
 * one source of truth means speaker, episode, timestamp, and transcript context
 * stay in sync with Who Said It.
 */
export const FILL_BLANK_BANK: FillBlankQuestion[] = (rawBank as FillBlankDefinition[]).map((blank) => {
  const source = quoteById.get(blank.quoteId);
  if (!source) throw new Error(`Unknown fill-in-the-blank quote: ${blank.quoteId}`);

  if (source.quote.length > MAX_QUOTE_CHARACTERS) {
    throw new Error(`${blank.id} uses a quote longer than ${MAX_QUOTE_CHARACTERS} characters`);
  }

  const answerIndex = source.quote.indexOf(blank.answer);
  if (answerIndex < 0) {
    throw new Error(`Answer "${blank.answer}" is not present in ${blank.quoteId}`);
  }
  if (source.quote.indexOf(blank.answer, answerIndex + blank.answer.length) >= 0) {
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

  return {
    id: blank.id,
    source,
    answer: blank.answer,
    options,
    difficulty: blank.difficulty,
    beforeBlank: source.quote.slice(0, answerIndex),
    afterBlank: source.quote.slice(answerIndex + blank.answer.length),
  };
});

export const FILL_BLANK_LENGTH = 10;
