import rawBank from "./data/fill-blank-bank.json";
import { WHO_SAID_IT_BANK, type WhoSaidItQuote } from "./who-said-it-data";


export type BlankDifficulty = "easy" | "medium" | "hard";

type FillBlankDefinition = {
  id: string;
  quoteId: string;
  answer: string;
  options: string[];
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

  return {
    ...blank,
    source,
    beforeBlank: source.quote.slice(0, answerIndex),
    afterBlank: source.quote.slice(answerIndex + blank.answer.length),
  };
});

export const FILL_BLANK_LENGTH = 10;

