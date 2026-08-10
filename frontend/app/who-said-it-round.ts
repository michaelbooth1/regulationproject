import { HOST_ORDER, type HostId } from "./quiz-data";
import {
  WHO_SAID_IT_BANK,
  WHO_SAID_IT_LENGTH,
  type QuoteDifficulty,
  type WhoSaidItQuote,
} from "./who-said-it-data";


const MIN_QUOTES_PER_HOST = 2;
const MAX_RANDOM_DRAWS = 600;

export const ROUND_DIFFICULTY_TARGETS: Record<QuoteDifficulty, number> = {
  easy: 3,
  medium: 4,
  hard: 3,
};

// These eight slots guarantee two quotes per host while leaving one easy and
// one medium slot to complete the 3/4/3 difficulty distribution.
const GUARANTEED_HOST_DIFFICULTIES: Record<HostId, readonly QuoteDifficulty[]> = {
  geoff: ["easy", "medium"],
  andrew: ["easy", "hard"],
  gavin: ["medium", "hard"],
  eric: ["medium", "hard"],
};

function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

function emptyHostCounts(): Record<HostId, number> {
  return Object.fromEntries(HOST_ORDER.map((host) => [host, 0])) as Record<HostId, number>;
}

function isBalancedRound(round: WhoSaidItQuote[]): boolean {
  const hostCounts = emptyHostCounts();
  const difficultyCounts: Record<QuoteDifficulty, number> = { easy: 0, medium: 0, hard: 0 };

  for (const quote of round) {
    hostCounts[quote.speaker] += 1;
    difficultyCounts[quote.difficulty] += 1;
  }

  return (
    HOST_ORDER.every((host) => hostCounts[host] >= MIN_QUOTES_PER_HOST)
    && (Object.keys(ROUND_DIFFICULTY_TARGETS) as QuoteDifficulty[]).every(
      (difficulty) => difficultyCounts[difficulty] === ROUND_DIFFICULTY_TARGETS[difficulty],
    )
  );
}

function deterministicFallback(avoidIds: ReadonlySet<string>): WhoSaidItQuote[] {
  const selected: WhoSaidItQuote[] = [];
  const selectedIds = new Set<string>();

  function takeQuote(host: HostId | null, difficulty: QuoteDifficulty) {
    const candidates = WHO_SAID_IT_BANK.filter((quote) => (
      !selectedIds.has(quote.id)
      && quote.difficulty === difficulty
      && (host === null || quote.speaker === host)
    ));
    const preferred = candidates.filter((quote) => !avoidIds.has(quote.id));
    const choice = shuffle(preferred.length > 0 ? preferred : candidates)[0];

    if (!choice) throw new Error(`Quote bank cannot satisfy ${host ?? "any host"}/${difficulty}`);
    selected.push(choice);
    selectedIds.add(choice.id);
  }

  HOST_ORDER.forEach((host) => {
    GUARANTEED_HOST_DIFFICULTIES[host].forEach((difficulty) => takeQuote(host, difficulty));
  });
  takeQuote(null, "easy");
  takeQuote(null, "medium");

  return shuffle(selected);
}

/**
 * Draw a ten-quote round, preferring quotes that were not in the previous game.
 * Random draws keep sessions varied; the structured fallback makes the host and
 * difficulty guarantees deterministic even if random selection is unlucky.
 */
export function pickRound(avoidIds: ReadonlySet<string> = new Set()): WhoSaidItQuote[] {
  const fresh = WHO_SAID_IT_BANK.filter((quote) => !avoidIds.has(quote.id));

  for (const pool of [fresh, WHO_SAID_IT_BANK]) {
    if (pool.length < WHO_SAID_IT_LENGTH) continue;
    for (let attempt = 0; attempt < MAX_RANDOM_DRAWS; attempt += 1) {
      const candidate = shuffle(pool).slice(0, WHO_SAID_IT_LENGTH);
      if (isBalancedRound(candidate)) return candidate;
    }
  }

  return deterministicFallback(avoidIds);
}
