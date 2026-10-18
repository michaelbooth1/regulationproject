/**
 * Lenient answer matching for typed fill-in-the-blank guesses. Pure functions
 * only, so the game, the review desk, the bank loader, and unit tests share
 * one implementation.
 */

export type MatchVerdict = "exact" | "accepted" | "near" | "wrong" | "empty";
export type MatchReason = "exact" | "plural" | "alias" | "typo" | "near" | "rejected" | "wrong" | "empty";

export type MatchResult = {
  verdict: MatchVerdict;
  reason: MatchReason;
  /** Weighted edit distance to the closest accepted form, when one was computed. */
  distance: number | null;
  /** The accepted form (answer or alias) the guess matched or came closest to. */
  matchedForm: string | null;
};

export type MatchTarget = {
  answer: string;
  accept?: readonly string[];
  reject?: readonly string[];
};

const LEADING_ARTICLE = /^(?:a|an|the) /;
const VOWELS = new Set("aeiou");
const KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

/** Each key's QWERTY neighbours, including diagonals on the staggered rows. */
const KEY_NEIGHBOURS: Map<string, Set<string>> = (() => {
  const neighbours = new Map<string, Set<string>>();
  KEYBOARD_ROWS.forEach((row, rowIndex) => {
    [...row].forEach((key, column) => {
      const near = new Set<string>();
      const add = (r: number, c: number) => {
        const char = KEYBOARD_ROWS[r]?.[c];
        if (char) near.add(char);
      };
      add(rowIndex, column - 1);
      add(rowIndex, column + 1);
      add(rowIndex - 1, column);
      add(rowIndex - 1, column + 1);
      add(rowIndex + 1, column - 1);
      add(rowIndex + 1, column);
      neighbours.set(key, near);
    });
  });
  return neighbours;
})();

/** Lowercase, strip accents and punctuation, and drop one leading article. */
export function normalizeGuess(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[‘’ʼ`']/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(LEADING_ARTICLE, "");
}

/** The comparison key: normalised with every space removed. */
export function compactGuess(value: string): string {
  return normalizeGuess(value).replace(/ /g, "");
}

function singularForms(compact: string): string[] {
  const forms = [compact];
  if (compact.length > 4 && compact.endsWith("es")) forms.push(compact.slice(0, -2));
  if (compact.length > 3 && compact.endsWith("s")) forms.push(compact.slice(0, -1));
  return forms;
}

function samePlural(a: string, b: string): boolean {
  const forms = new Set(singularForms(a));
  return singularForms(b).some((form) => forms.has(form));
}

function substitutionCost(a: string, b: string): number {
  if (a === b) return 0;
  if (VOWELS.has(a) && VOWELS.has(b)) return 1;
  if (KEY_NEIGHBOURS.get(a)?.has(b)) return 1;
  return 2;
}

/**
 * Optimal-string-alignment Damerau–Levenshtein distance. Insertions,
 * deletions, adjacent transpositions, and plausible-typo substitutions cost 1;
 * substituting an unrelated letter costs 2.
 */
export function weightedDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) => {
    const row = new Array<number>(cols).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j < cols; j += 1) d[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + substitutionCost(a[i - 1], b[j - 1]),
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] && a[i - 1] !== a[i - 2]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/** How many weighted edits a typo may cost, by the length of the target. */
export function typoBudget(compactTarget: string): number {
  const length = compactTarget.length;
  if (length <= 3) return 0;
  if (length <= 5) return 1;
  if (length <= 9) return 2;
  return 3;
}

/** Typos rarely hit the first letter; allow it only as a swap of the first two. */
function sharesStart(guess: string, target: string): boolean {
  if (!guess || !target) return false;
  return guess[0] === target[0] || (guess[0] === target[1] && guess[1] === target[0]);
}

export function judgeGuess(guess: string, target: MatchTarget): MatchResult {
  const compact = compactGuess(guess);
  if (!compact) return { verdict: "empty", reason: "empty", distance: null, matchedForm: null };

  const answer = compactGuess(target.answer);
  if (compact === answer) {
    return { verdict: "exact", reason: "exact", distance: 0, matchedForm: target.answer };
  }

  const rejected = (target.reject ?? []).some((form) => samePlural(compact, compactGuess(form)));
  if (rejected) return { verdict: "wrong", reason: "rejected", distance: null, matchedForm: null };

  const forms = [target.answer, ...(target.accept ?? [])].map((form) => ({ form, compact: compactGuess(form) }));

  for (const { form, compact: formCompact } of forms) {
    if (compact === formCompact) return { verdict: "accepted", reason: "alias", distance: 0, matchedForm: form };
  }
  for (const { form, compact: formCompact } of forms) {
    if (samePlural(compact, formCompact)) {
      return { verdict: "accepted", reason: "plural", distance: 0, matchedForm: form };
    }
  }

  let closest: { form: string; distance: number; budget: number } | null = null;
  for (const { form, compact: formCompact } of forms) {
    if (!sharesStart(compact, formCompact)) continue;
    const distance = weightedDistance(compact, formCompact);
    const budget = typoBudget(formCompact);
    if (!closest || distance - budget < closest.distance - closest.budget) {
      closest = { form, distance, budget };
    }
  }

  if (closest && closest.distance <= closest.budget) {
    return { verdict: "accepted", reason: "typo", distance: closest.distance, matchedForm: closest.form };
  }
  if (closest && closest.distance <= closest.budget + 1) {
    return { verdict: "near", reason: "near", distance: closest.distance, matchedForm: closest.form };
  }
  return { verdict: "wrong", reason: "wrong", distance: closest?.distance ?? null, matchedForm: null };
}

export function isSolved(result: MatchResult): boolean {
  return result.verdict === "exact" || result.verdict === "accepted";
}
