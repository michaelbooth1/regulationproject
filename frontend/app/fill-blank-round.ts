import {
  FILL_BLANK_BANK,
  FILL_BLANK_LENGTH,
  type BlankDifficulty,
  type FillBlankQuestion,
} from "./fill-blank-data";


export const BLANK_DIFFICULTY_TARGETS: Record<BlankDifficulty, number> = {
  easy: 3,
  medium: 4,
  hard: 3,
};

function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

/**
 * Draw a balanced round using four priority tiers per difficulty: fresh and
 * active, repeated and active, fresh and marked, then repeated and marked.
 * Marked files therefore disappear whenever each active difficulty pool can
 * fill its quota, while an over-curated local bank can still start a game.
 */
export function pickBlankRound(
  avoidIds: ReadonlySet<string> = new Set(),
  removalIds: ReadonlySet<string> = new Set(),
): FillBlankQuestion[] {
  const selected = (Object.keys(BLANK_DIFFICULTY_TARGETS) as BlankDifficulty[]).flatMap(
    (difficulty) => {
      const quota = BLANK_DIFFICULTY_TARGETS[difficulty];
      const matching = FILL_BLANK_BANK.filter((question) => question.difficulty === difficulty);
      const tiers = [
        matching.filter((question) => !removalIds.has(question.id) && !avoidIds.has(question.id)),
        matching.filter((question) => !removalIds.has(question.id) && avoidIds.has(question.id)),
        matching.filter((question) => removalIds.has(question.id) && !avoidIds.has(question.id)),
        matching.filter((question) => removalIds.has(question.id) && avoidIds.has(question.id)),
      ];

      const picked: FillBlankQuestion[] = [];
      for (const tier of tiers) {
        picked.push(...shuffle(tier).slice(0, quota - picked.length));
        if (picked.length === quota) break;
      }

      if (picked.length !== quota) {
        throw new Error(`Not enough ${difficulty} fill-in-the-blank questions for a round`);
      }
      return picked;
    },
  );

  if (selected.length !== FILL_BLANK_LENGTH) {
    throw new Error(`Expected ${FILL_BLANK_LENGTH} fill-in-the-blank questions`);
  }
  return shuffle(selected);
}
