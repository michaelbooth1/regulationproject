import { FILL_BLANK_BANK } from "./fill-blank-data";


// A new curation generation gets a new key so old dislikes cannot hide a rebuilt bank.
export const BLANK_REMOVALS_STORAGE_KEY = "regulation-fill-blank-removals-v5";
export const BLANK_GUESSES_STORAGE_KEY = "regulation-fill-blank-guesses-v1";
const MAX_LOGGED_GUESSES = 20;

const KNOWN_BLANK_IDS = new Set(FILL_BLANK_BANK.map((question) => question.id));

/** Keep browser storage resilient to stale IDs, duplicate values, and manual edits. */
export function normalizeBlankRemovalIds(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set();

  return new Set(
    value.filter((id): id is string => typeof id === "string" && KNOWN_BLANK_IDS.has(id)),
  );
}

export function readBlankRemovalIds(): Set<string> {
  if (typeof window === "undefined") return new Set();

  try {
    return normalizeBlankRemovalIds(
      JSON.parse(window.localStorage.getItem(BLANK_REMOVALS_STORAGE_KEY) ?? "null"),
    );
  } catch {
    // Curation preferences are optional and must never prevent a game from loading.
    return new Set();
  }
}

export function writeBlankRemovalIds(ids: ReadonlySet<string>): void {
  if (typeof window === "undefined") return;

  try {
    const normalized = normalizeBlankRemovalIds([...ids]);
    window.localStorage.setItem(BLANK_REMOVALS_STORAGE_KEY, JSON.stringify([...normalized]));
  } catch {
    // Private browsing and locked-down browsers can deny storage writes.
  }
}

/** Wrong and near-miss guesses typed on this device, per question, for alias curation. */
export function readBlankGuessLog(): Record<string, string[]> {
  if (typeof window === "undefined") return {};

  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(BLANK_GUESSES_STORAGE_KEY) ?? "null");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const log: Record<string, string[]> = {};
    for (const [id, guesses] of Object.entries(parsed)) {
      if (!KNOWN_BLANK_IDS.has(id) || !Array.isArray(guesses)) continue;
      log[id] = guesses
        .filter((guess): guess is string => typeof guess === "string")
        .slice(-MAX_LOGGED_GUESSES);
    }
    return log;
  } catch {
    return {};
  }
}

export function logBlankGuess(questionId: string, guess: string): void {
  if (typeof window === "undefined" || !KNOWN_BLANK_IDS.has(questionId)) return;

  try {
    const log = readBlankGuessLog();
    const trimmed = guess.trim();
    const key = trimmed.toLocaleLowerCase();
    const existing = (log[questionId] ?? []).filter((entry) => entry.toLocaleLowerCase() !== key);
    log[questionId] = [...existing, trimmed].slice(-MAX_LOGGED_GUESSES);
    window.localStorage.setItem(BLANK_GUESSES_STORAGE_KEY, JSON.stringify(log));
  } catch {
    // The guess log is a curation aid and must never interrupt a game.
  }
}

export function clearBlankGuessLog(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(BLANK_GUESSES_STORAGE_KEY);
  } catch {
    // Storage may be unavailable.
  }
}
