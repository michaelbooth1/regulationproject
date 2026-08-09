import rawBank from "./data/who-said-it-bank.json";
import type { HostId } from "./quiz-data";


export type QuoteDifficulty = "easy" | "medium" | "hard";

export type WhoSaidItQuote = {
  id: string;
  quote: string;
  speaker: HostId;
  episode: number;
  title: string;
  published: string;
  startSec: number;
  difficulty: QuoteDifficulty;
  topic: string;
  context: string;
  leadIn: Array<{
    speaker: string;
    text: string;
    startSec: number;
  }>;
};

export const WHO_SAID_IT_BANK = rawBank as WhoSaidItQuote[];
export const WHO_SAID_IT_LENGTH = 10;
