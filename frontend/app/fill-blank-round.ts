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

function hasTargetMix(round: FillBlankQuestion[]) {
  return (Object.keys(BLANK_DIFFICULTY_TARGETS) as BlankDifficulty[]).every(
    (difficulty) => (
      round.filter((question) => question.difficulty === difficulty).length
      === BLANK_DIFFICULTY_TARGETS[difficulty]
    ),
  );
}

/** Draw ten questions, avoiding the immediately previous game when possible. */
export function pickBlankRound(avoidIds: ReadonlySet<string> = new Set()): FillBlankQuestion[] {
  const fresh = FILL_BLANK_BANK.filter((question) => !avoidIds.has(question.id));

  for (const pool of [fresh, FILL_BLANK_BANK]) {
    if (pool.length < FILL_BLANK_LENGTH) continue;
    for (let attempt = 0; attempt < 400; attempt += 1) {
      const candidate = shuffle(pool).slice(0, FILL_BLANK_LENGTH);
      if (hasTargetMix(candidate)) return candidate;
    }
  }

  return shuffle(
    (Object.keys(BLANK_DIFFICULTY_TARGETS) as BlankDifficulty[]).flatMap((difficulty) => (
      shuffle(FILL_BLANK_BANK.filter((question) => question.difficulty === difficulty))
        .slice(0, BLANK_DIFFICULTY_TARGETS[difficulty])
    )),
  );
}

export function shuffleBlankOptions(options: readonly string[]): string[] {
  return shuffle(options);
}

