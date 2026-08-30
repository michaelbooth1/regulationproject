import { FILL_BLANK_BANK } from "./fill-blank-data";


export const BLANK_REMOVALS_STORAGE_KEY = "regulation-fill-blank-removals-v1";

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
