import rawBank from "./data/fill-blank-bank.json";
import { WHO_SAID_IT_BANK, type WhoSaidItQuote } from "./who-said-it-data";


export type BlankDifficulty = "easy" | "medium" | "hard";

type FillBlankDefinition = {
  id: string;
  quoteId: string;
  answer: string;
  distractors: Array<{
    text: string;
    sourceQuoteIds: string[];
  }>;
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

/**
 * Join the curated blank choices to the already-audited quote records. Keeping
 * one source of truth means speaker, episode, timestamp, and transcript context
 * stay in sync with Who Said It.
 */
export const FILL_BLANK_BANK: FillBlankQuestion[] = (rawBank as FillBlankDefinition[]).map((blank) => {
  const source = quoteById.get(blank.quoteId);
  if (!source) throw new Error(`Unknown fill-in-the-blank quote: ${blank.quoteId}`);

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

  for (const distractor of blank.distractors) {
    if (!distractor.sourceQuoteIds.length) {
      throw new Error(`${blank.id} has an ungrounded distractor: "${distractor.text}"`);
    }
    for (const sourceQuoteId of distractor.sourceQuoteIds) {
      if (!quoteById.has(sourceQuoteId)) {
        throw new Error(`${blank.id} cites an unknown distractor source: ${sourceQuoteId}`);
      }
      if (sourceQuoteId === blank.quoteId) {
        throw new Error(`${blank.id} cannot cite its own quote as distractor material`);
      }
    }
  }

  const options = [blank.answer, ...blank.distractors.map((distractor) => distractor.text)];
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
