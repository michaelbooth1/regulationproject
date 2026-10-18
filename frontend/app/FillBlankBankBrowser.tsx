"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { HostBadge } from "./HostBadge";
import {
  FILL_BLANK_BANK,
  type BlankDifficulty,
  type FillBlankQuestion,
} from "./fill-blank-data";
import { BLANK_DIFFICULTY_TARGETS } from "./fill-blank-round";
import { judgeGuess, type MatchResult } from "./fill-blank-match";
import {
  BLANK_GUESSES_STORAGE_KEY,
  BLANK_REMOVALS_STORAGE_KEY,
  clearBlankGuessLog,
  readBlankGuessLog,
  readBlankRemovalIds,
  writeBlankRemovalIds,
} from "./fill-blank-preferences";
import { HOST_ORDER, HOST_PROFILES, type HostId } from "./quiz-data";
import { formatTranscriptTime } from "./who-said-it-data";


type HostFilter = "all" | HostId;
type DifficultyFilter = "all" | BlankDifficulty;
type RemovalFilter = "all" | "kept" | "marked";

const DIFFICULTIES: BlankDifficulty[] = ["easy", "medium", "hard"];
const QUESTION_NUMBER_BY_ID = new Map(
  FILL_BLANK_BANK.map((question, index) => [question.id, index + 1]),
);
const HOST_COUNTS = Object.fromEntries(
  HOST_ORDER.map((host) => [
    host,
    FILL_BLANK_BANK.filter((question) => question.source.speaker === host).length,
  ]),
) as Record<HostId, number>;
const DIFFICULTY_COUNTS = Object.fromEntries(
  DIFFICULTIES.map((difficulty) => [
    difficulty,
    FILL_BLANK_BANK.filter((question) => question.difficulty === difficulty).length,
  ]),
) as Record<BlankDifficulty, number>;
const SEARCH_TEXT_BY_ID = new Map(
  FILL_BLANK_BANK.map((question) => [
    question.id,
    [
      question.id,
      question.source.id,
      question.displayQuote,
      question.source.quote,
      question.source.title,
      question.source.topic,
      question.source.context,
      question.source.episode,
      HOST_PROFILES[question.source.speaker].name,
      question.answer,
      ...question.accept,
      ...question.reject,
      ...question.source.leadIn.flatMap((line) => [line.speaker, line.text]),
    ].join(" ").toLocaleLowerCase(),
  ]),
);
const VERDICT_LABELS: Record<MatchResult["reason"], string> = {
  exact: "Exact match",
  plural: "Accepted · plural",
  alias: "Accepted · alias",
  typo: "Accepted · typo",
  near: "Near miss · free retry",
  rejected: "Wrong · on reject list",
  wrong: "Wrong",
  empty: "",
};

function GuessTester({ question }: { question: FillBlankQuestion }) {
  const [guess, setGuess] = useState("");
  const result = guess.trim() ? judgeGuess(guess, question) : null;
  return (
    <label className="blank-bank-tester">
      <span>Try a guess</span>
      <input
        type="text"
        value={guess}
        onChange={(event) => setGuess(event.target.value)}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="type to test the matcher"
      />
      <output className={result ? `verdict-${result.verdict}` : undefined} aria-live="polite">
        {result && (
          <>
            {VERDICT_LABELS[result.reason]}
            {result.distance !== null && result.distance > 0 && ` · distance ${result.distance}`}
          </>
        )}
      </output>
    </label>
  );
}

function suggestedAccept(question: FillBlankQuestion, guess: string): string {
  return `"${question.id}": "accept": ${JSON.stringify([...question.accept, guess])}`;
}

function removalList(questions: FillBlankQuestion[]): string {
  return questions.map((question) => (
    `${question.id} | ${question.source.id} | ${HOST_PROFILES[question.source.speaker].name}`
    + ` | Episode ${question.source.episode} | answer: ${question.answer}`
  )).join("\n");
}

export default function FillBlankBankBrowser({ mappedEpisodes }: { mappedEpisodes: number }) {
  const [query, setQuery] = useState("");
  const [host, setHost] = useState<HostFilter>("all");
  const [difficulty, setDifficulty] = useState<DifficultyFilter>("all");
  const [removalFilter, setRemovalFilter] = useState<RemovalFilter>("all");
  const [markedIds, setMarkedIds] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState("");
  const [copyFallback, setCopyFallback] = useState(false);
  const [guessLog, setGuessLog] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const initialSync = window.setTimeout(() => {
      setMarkedIds(readBlankRemovalIds());
      setGuessLog(readBlankGuessLog());
    }, 0);

    function syncAcrossTabs(event: StorageEvent) {
      if (event.key === BLANK_REMOVALS_STORAGE_KEY) setMarkedIds(readBlankRemovalIds());
      if (event.key === BLANK_GUESSES_STORAGE_KEY) setGuessLog(readBlankGuessLog());
    }

    window.addEventListener("storage", syncAcrossTabs);
    return () => {
      window.clearTimeout(initialSync);
      window.removeEventListener("storage", syncAcrossTabs);
    };
  }, []);

  const markedQuestions = useMemo(
    () => FILL_BLANK_BANK.filter((question) => markedIds.has(question.id)),
    [markedIds],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return FILL_BLANK_BANK.filter((question) => {
      const matchesHost = host === "all" || question.source.speaker === host;
      const matchesDifficulty = difficulty === "all" || question.difficulty === difficulty;
      const isMarked = markedIds.has(question.id);
      const matchesRemoval = removalFilter === "all"
        || (removalFilter === "marked" ? isMarked : !isMarked);
      const haystack = (SEARCH_TEXT_BY_ID.get(question.id) ?? "")
        + " " + (guessLog[question.id] ?? []).join(" ").toLocaleLowerCase();
      return matchesHost && matchesDifficulty && matchesRemoval && (!needle || haystack.includes(needle));
    });
  }, [difficulty, guessLog, host, markedIds, query, removalFilter]);
  const loggedGuessCount = Object.values(guessLog).reduce((total, guesses) => total + guesses.length, 0);

  const emergencyFillers = useMemo(() => DIFFICULTIES.reduce((total, level) => {
    const unmarked = FILL_BLANK_BANK.filter(
      (question) => question.difficulty === level && !markedIds.has(question.id),
    ).length;
    return total + Math.max(0, BLANK_DIFFICULTY_TARGETS[level] - unmarked);
  }, 0), [markedIds]);

  const copiedText = useMemo(() => removalList(markedQuestions), [markedQuestions]);

  function clearFilters() {
    setQuery("");
    setHost("all");
    setDifficulty("all");
    setRemovalFilter("all");
  }

  function toggleMarked(question: FillBlankQuestion) {
    const next = new Set(markedIds);
    const wasMarked = next.delete(question.id);
    if (!wasMarked) next.add(question.id);
    setMarkedIds(next);
    writeBlankRemovalIds(next);
    setCopyFallback(false);
    setNotice(
      wasMarked
        ? `Kept ${question.id} in your local game bank.`
        : `Marked ${question.id} for removal from your local game bank.`,
    );
  }

  function clearMarks() {
    setMarkedIds(new Set());
    writeBlankRemovalIds(new Set());
    setCopyFallback(false);
    setNotice("Cleared every local removal mark.");
  }

  function clearGuesses() {
    clearBlankGuessLog();
    setGuessLog({});
    setNotice("Cleared every logged guess on this device.");
  }

  async function copySuggestion(question: FillBlankQuestion, guess: string) {
    const text = suggestedAccept(question, guess);
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`Copied an accept entry for “${guess}”.`);
    } catch {
      setNotice(`Copy unavailable. Add to ${question.id}: ${text}`);
    }
  }

  async function copyMarkedQuestions() {
    if (!copiedText) return;
    try {
      await navigator.clipboard.writeText(copiedText);
      setCopyFallback(false);
      setNotice(`Copied ${markedQuestions.length} removal ${markedQuestions.length === 1 ? "candidate" : "candidates"}.`);
    } catch {
      setCopyFallback(true);
      setNotice("Automatic copy was unavailable. The removal list is ready below for manual copying.");
    }
  }

  return (
    <main className="quiz-shell blank-shell blank-bank-shell">
      <header className="quiz-topbar blank-topbar">
        <Link className="wordmark" href="/blank" aria-label="Regulation Fill in the Blank home">
          <span className="regulation-brand-mark" aria-hidden="true" />
          <span className="regulation-lockup">
            <strong>regulation</strong>
            <small>fill in the blank</small>
          </span>
        </Link>
        <nav className="topbar-tools" aria-label="Fill in the blank navigation">
          <Link className="bank-link" href="/blank">Play game</Link>
          <Link className="bank-link active" href="/blank/bank" aria-current="page">Review bank</Link>
          <Link className="bank-link blank-bank-wsi-link" href="/">Who said it</Link>
          <div className="corpus-stamp"><span aria-hidden="true" />{mappedEpisodes} episodes digested</div>
        </nav>
      </header>

      <section className="blank-bank-header">
        <div>
          <p className="blank-kicker">Curator desk / spoilers everywhere</p>
          <h1>Review all <strong>{FILL_BLANK_BANK.length}</strong> damaged files.</h1>
          <p>
            Inspect every blank, accepted spelling, logged guess, and source. Test the matcher on any file. Mark anything that should leave the game,
            then copy the resulting list when you want the source bank cleaned permanently.
          </p>
        </div>
        <dl aria-label="Fill in the blank bank status">
          <div><dt>Total files</dt><dd>{FILL_BLANK_BANK.length}</dd></div>
          <div><dt>Marked</dt><dd>{markedIds.size}</dd></div>
          <div><dt>Active here</dt><dd>{FILL_BLANK_BANK.length - markedIds.size}</dd></div>
        </dl>
      </section>

      <section className="blank-bank-controls" aria-label="Fill in the blank bank filters">
        <label className="blank-bank-search">
          <span>Search blanks, answers, aliases, logged guesses, episodes, or IDs</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try: fridge, Alexa, Episode 158..."
          />
        </label>

        <div className="blank-bank-filter-row">
          <div className="category-filters" aria-label="Filter by host">
            <button type="button" aria-pressed={host === "all"} className={host === "all" ? "active" : ""} onClick={() => setHost("all")}>All hosts</button>
            {HOST_ORDER.map((hostId) => (
              <button type="button" aria-pressed={host === hostId} key={hostId} className={host === hostId ? "active" : ""} onClick={() => setHost(hostId)}>
                {HOST_PROFILES[hostId].name} · {HOST_COUNTS[hostId]}
              </button>
            ))}
          </div>
          <div className="category-filters" aria-label="Filter by difficulty">
            {(["all", ...DIFFICULTIES] as const).map((level) => (
              <button type="button" aria-pressed={difficulty === level} key={level} className={difficulty === level ? "active" : ""} onClick={() => setDifficulty(level)}>
                {level === "all" ? "Any difficulty" : `${level} · ${DIFFICULTY_COUNTS[level]}`}
              </button>
            ))}
          </div>
          <div className="category-filters" aria-label="Filter by removal status">
            {(["all", "kept", "marked"] as RemovalFilter[]).map((status) => (
              <button type="button" aria-pressed={removalFilter === status} key={status} className={removalFilter === status ? "active" : ""} onClick={() => setRemovalFilter(status)}>
                {status === "all" ? "Any status" : status}
              </button>
            ))}
          </div>
        </div>

        <div className="blank-bank-control-footer">
          <p className="blank-bank-count" aria-live="polite">
            Showing <strong>{visible.length}</strong> of {FILL_BLANK_BANK.length} · {markedIds.size} marked · {FILL_BLANK_BANK.length - markedIds.size} active
          </p>
          <div className="blank-bank-actions">
            <button type="button" onClick={copyMarkedQuestions} disabled={markedIds.size === 0}>Copy removal list</button>
            <button type="button" onClick={clearMarks} disabled={markedIds.size === 0}>Clear marks</button>
            <button type="button" onClick={clearGuesses} disabled={loggedGuessCount === 0}>Clear {loggedGuessCount} logged guesses</button>
          </div>
        </div>

        <p className={`blank-bank-capacity${emergencyFillers ? " warning" : ""}`}>
          {emergencyFillers
            ? `${emergencyFillers} marked ${emergencyFillers === 1 ? "file is" : "files are"} currently needed as minimum difficulty fillers in a ten-question game.`
            : "New games skip every marked file and keep the usual three easy, four medium, and three hard mix."}
        </p>
        <p className="blank-bank-notice" role="status" aria-live="polite">{notice}</p>
        {copyFallback && (
          <label className="blank-bank-copy-fallback">
            <span>Select and copy this removal list</span>
            <textarea readOnly value={copiedText} onFocus={(event) => event.currentTarget.select()} />
          </label>
        )}
      </section>

      <section className="blank-bank-list" aria-label="All Regulation fill in the blank questions">
        {visible.map((question) => {
          const profile = HOST_PROFILES[question.source.speaker];
          const bankNumber = QUESTION_NUMBER_BY_ID.get(question.id) ?? 0;
          const isMarked = markedIds.has(question.id);
          const loggedGuesses = guessLog[question.id] ?? [];

          return (
            <article
              className={`blank-bank-card${isMarked ? " is-marked" : ""}`}
              key={question.id}
              style={{ "--host-color": profile.color, "--host-pale": profile.pale } as CSSProperties}
            >
              <header>
                <div className="blank-bank-file-id">
                  <span>File {String(bankNumber).padStart(2, "0")}</span>
                  <small>{question.difficulty}</small>
                </div>
                <HostBadge host={question.source.speaker} />
                <button
                  className="blank-bank-removal-button"
                  type="button"
                  aria-pressed={isMarked}
                  onClick={() => toggleMarked(question)}
                >
                  {isMarked ? "Keep question" : "Mark for removal"}
                </button>
              </header>

              <div className="blank-bank-question">
                <blockquote>
                  “{question.beforeBlank}<mark aria-label={`missing answer: ${question.answer}`}>________</mark>{question.afterBlank}”
                </blockquote>
                <code>{question.id}</code>
              </div>

              <div className="blank-bank-options">
                <div>
                  <span>Accepted forms</span>
                  <ul aria-label={`Accepted forms for file ${bankNumber}`}>
                    <li className="is-correct">{question.answer}<strong>Answer</strong></li>
                    {question.accept.map((form) => <li key={form}>{form}</li>)}
                  </ul>
                </div>
                {question.reject.length > 0 && (
                  <div>
                    <span>Rejected forms</span>
                    <ul aria-label={`Rejected forms for file ${bankNumber}`}>
                      {question.reject.map((form) => <li className="is-rejected" key={form}>{form}</li>)}
                    </ul>
                  </div>
                )}
                <GuessTester question={question} />
                {loggedGuesses.length > 0 && (
                  <div className="blank-bank-logged">
                    <span>Guesses typed on this device</span>
                    <ul>
                      {loggedGuesses.map((guess) => (
                        <li key={guess}>
                          {guess}
                          <button type="button" onClick={() => copySuggestion(question, guess)}>Copy as accept</button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <details className="blank-bank-context">
                <summary>Open transcript context</summary>
                <ol>
                  {question.source.leadIn.map((line, index) => (
                    <li key={`${line.startSec}-${line.speaker}-${index}`}>
                      <strong>{line.speaker}</strong>
                      <p>{line.text}</p>
                    </li>
                  ))}
                  <li className="quoted-line">
                    <strong>{profile.name}</strong>
                    <p>{question.source.quote}</p>
                  </li>
                </ol>
              </details>

              <footer>
                <div>
                  <span>Episode {question.source.episode}</span>
                  <strong>{question.source.title}</strong>
                  <small>{question.source.published} · {formatTranscriptTime(question.source.startSec)}</small>
                </div>
                <p>{question.source.context}</p>
                <code>{question.source.id}</code>
              </footer>
            </article>
          );
        })}

        {visible.length === 0 && (
          <div className="bank-empty blank-bank-empty">
            <strong>{removalFilter === "marked" && markedIds.size === 0 ? "Nothing is marked for removal yet." : "No damaged transcript matches those filters."}</strong>
            <button type="button" onClick={clearFilters}>Clear filters</button>
          </div>
        )}
      </section>

      <footer className="quiz-footer blank-bank-footer">
        <p>Marks live in this browser. Copy the list to make changes permanent in the published bank.</p>
        <Link href="/blank">← Return to the game</Link>
      </footer>
    </main>
  );
}
