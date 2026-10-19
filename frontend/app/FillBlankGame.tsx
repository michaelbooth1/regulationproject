"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { HostBadge } from "./HostBadge";
import {
  BLANK_MAX_SCORE,
  BLANK_POINTS_PER_QUESTION,
  FILL_BLANK_BANK,
  FILL_BLANK_LENGTH,
  canRevealMore,
  revealedLetterCount,
  type BlankDifficulty,
  type FillBlankQuestion,
  type PatternCell,
} from "./fill-blank-data";
import { compactGuess, isSolved, judgeGuess, type MatchReason } from "./fill-blank-match";
import { logBlankGuess, readBlankRemovalIds } from "./fill-blank-preferences";
import { pickBlankRound } from "./fill-blank-round";
import { HOST_ORDER, HOST_PROFILES } from "./quiz-data";
import { formatTranscriptTime } from "./who-said-it-data";


type Stage = "intro" | "playing" | "result";
type Feedback = { tone: "near" | "wrong" | "info"; text: string };
type AnswerRecord = {
  question: FillBlankQuestion;
  misses: string[];
  hintsUsed: number;
  points: number;
  solved: boolean;
  /** What the player typed when a plural, alias, or typo was accepted. */
  acceptedAs: { typed: string; reason: MatchReason } | null;
};
type QuestionState = {
  input: string;
  points: number;
  hintLevel: number;
  misses: string[];
  nearMissUsed: boolean;
  feedback: Feedback | null;
  shake: number;
};
type LifetimeStats = {
  games: number;
  best: number;
  totalPoints: number;
  totalSolved: number;
  totalClean: number;
  totalQuestions: number;
};

const STATS_KEY = "regulation-fill-blank-stats-v2";
const UNKNOWN_SPEAKER_COLOR = "#c8c2b7";
const LETTER = /[\p{L}\p{N}]/u;
const EMPTY_STATS: LifetimeStats = {
  games: 0, best: 0, totalPoints: 0, totalSolved: 0, totalClean: 0, totalQuestions: 0,
};
const FRESH_QUESTION: QuestionState = {
  input: "",
  points: BLANK_POINTS_PER_QUESTION,
  hintLevel: 0,
  misses: [],
  nearMissUsed: false,
  feedback: null,
  shake: 0,
};
const EXAMPLE_QUESTION = FILL_BLANK_BANK.find((question) => question.answer === "Alexa") ?? FILL_BLANK_BANK[0];

function scrollToTop() {
  window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
}

function loadLifetimeStats(): LifetimeStats {
  if (typeof window === "undefined") return EMPTY_STATS;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STATS_KEY) ?? "null");
    if (!parsed || typeof parsed !== "object") return EMPTY_STATS;
    const candidate = parsed as Partial<LifetimeStats>;
    const values = (Object.keys(EMPTY_STATS) as (keyof LifetimeStats)[]).map((key) => candidate[key]);
    if (values.every((value) => Number.isInteger(value) && (value ?? -1) >= 0)) {
      return candidate as LifetimeStats;
    }
  } catch {
    // Device-local history is optional and must never prevent a game.
  }
  return EMPTY_STATS;
}

function verdictFor(score: number) {
  if (score === BLANK_MAX_SCORE) {
    return {
      title: "Perfect reconstruction",
      copy: "Every missing word returned to its proper crime scene. The archive has nothing left to teach you.",
    };
  }
  if (score >= 24) {
    return {
      title: "Archive restoration expert",
      copy: "You can rebuild a Regulation sentence from the shape of the damage alone.",
    };
  }
  if (score >= 18) {
    return {
      title: "Certified stenographer",
      copy: "Most of the evidence survived. A few beans, dogs, and toilet components remain unaccounted for.",
    };
  }
  if (score >= 9) {
    return {
      title: "Contextually adjacent",
      copy: "You understood the sentence. The sentence did not necessarily understand you.",
    };
  }
  return {
    title: "Transcript corrupted",
    copy: "The recovered document now describes a completely different and possibly better podcast.",
  };
}

function transcriptSpeakerColor(speaker: string) {
  const host = HOST_ORDER.find((hostId) => HOST_PROFILES[hostId].name === speaker);
  return host ? HOST_PROFILES[host].color : UNKNOWN_SPEAKER_COLOR;
}

function patternLabel(question: FillBlankQuestion, hintLevel: number) {
  const lengths = question.wordLengths;
  const shape = `${lengths.length} ${lengths.length === 1 ? "word" : "words"}: `
    + lengths.map((length) => `${length} ${length === 1 ? "letter" : "letters"}`).join(", ");
  if (!hintLevel) return shape;
  const starts = question.answer.split(" ").map((word, index) => (
    [...word].filter((char) => LETTER.test(char))
      .slice(0, revealedLetterCount(lengths[index], hintLevel)).join("").toUpperCase() || "none"
  ));
  return `${shape}; revealed letters ${starts.join(", ")}`;
}

type TileState = { patternIndex: number; char: string; state: "locked" | "typed" | "empty"; typedIndex: number | null };

function isLocked(question: FillBlankQuestion, cell: Extract<PatternCell, { kind: "letter" }>, hintLevel: number) {
  return cell.position < revealedLetterCount(question.wordLengths[cell.word], hintLevel);
}

/**
 * Place typed letters into the blank. Revealed letters are locked: typed
 * letters skip over them, so the player only types the remaining letters.
 */
function layoutTiles(question: FillBlankQuestion, typed: string, hintLevel: number) {
  const typedLetters = [...typed].filter((char) => LETTER.test(char));
  const tiles: TileState[] = [];
  let next = 0;
  question.pattern.forEach((cell, patternIndex) => {
    if (cell.kind !== "letter") return;
    if (isLocked(question, cell, hintLevel)) {
      tiles.push({ patternIndex, char: cell.char, state: "locked", typedIndex: null });
    } else if (next < typedLetters.length) {
      tiles.push({ patternIndex, char: typedLetters[next], state: "typed", typedIndex: next });
      next += 1;
    } else {
      tiles.push({ patternIndex, char: "", state: "empty", typedIndex: null });
    }
  });
  return { tiles, typedLetters, overflow: typedLetters.slice(next).join("") };
}

/** The guess to judge: raw input before any hint, otherwise the blank with its locked letters. */
function composeGuess(question: FillBlankQuestion, typed: string, hintLevel: number): string {
  if (hintLevel === 0) return typed.trim();
  const { tiles, overflow } = layoutTiles(question, typed, hintLevel);
  const byPattern = new Map(tiles.map((tile) => [tile.patternIndex, tile.char]));
  const composed = question.pattern.map((cell, index) => (
    cell.kind === "space" ? " " : cell.kind === "fixed" ? cell.char : byPattern.get(index) ?? ""
  )).join("");
  return (composed + overflow).trim();
}

/** Typed letters that stay after a hint locks more cells; letters under new locks are dropped. */
function inputAfterHint(question: FillBlankQuestion, typed: string, hintLevel: number): string {
  const { tiles, typedLetters, overflow } = layoutTiles(question, typed, hintLevel);
  const kept = tiles.filter((tile) => {
    if (tile.state !== "typed") return false;
    const cell = question.pattern[tile.patternIndex];
    return cell.kind === "letter" && !isLocked(question, cell, hintLevel + 1);
  }).map((tile) => typedLetters[tile.typedIndex ?? 0]);
  return kept.join("") + overflow;
}

/** The blank as letter tiles. Revealed letters are locked; typed letters fill the rest in order. */
function BlankTiles({
  question,
  typed = "",
  hintLevel = 0,
  solvedView = false,
}: {
  question: FillBlankQuestion;
  typed?: string;
  hintLevel?: number;
  solvedView?: boolean;
}) {
  const { tiles, overflow } = layoutTiles(question, typed, hintLevel);
  const tileByPattern = new Map(tiles.map((tile) => [tile.patternIndex, tile]));
  const words: ReactNode[][] = [[]];

  question.pattern.forEach((cell, index) => {
    if (cell.kind === "space") {
      words.push([]);
      return;
    }
    const word = words[words.length - 1];
    if (cell.kind === "fixed") {
      word.push(<span className="blank-tile fixed" key={index}>{cell.char}</span>);
      return;
    }
    const tile = tileByPattern.get(index);
    if (solvedView) {
      word.push(<span className="blank-tile solved" key={index}>{cell.char}</span>);
    } else if (tile?.state === "locked") {
      word.push(<span className="blank-tile hinted" key={index}>{cell.char}</span>);
    } else if (tile?.state === "typed") {
      word.push(<span className="blank-tile typed" key={index}>{tile.char}</span>);
    } else {
      word.push(<span className="blank-tile" key={index} />);
    }
  });

  return (
    <span className="blank-tiles" aria-hidden="true">
      {words.map((word, index) => (
        <span className="blank-tile-word" key={index}>{word}</span>
      ))}
      {overflow && !solvedView && <span className="blank-tile-overflow">{overflow}</span>}
    </span>
  );
}

function PointsMeter({ points, label }: { points: number; label?: string }) {
  return (
    <span className="blank-points-meter" aria-label={label ?? `${points} of ${BLANK_POINTS_PER_QUESTION} points`}>
      {Array.from({ length: BLANK_POINTS_PER_QUESTION }, (_, index) => (
        <i className={index < points ? "on" : undefined} key={index} aria-hidden="true" />
      ))}
    </span>
  );
}

function acceptedNote(acceptedAs: AnswerRecord["acceptedAs"]) {
  if (!acceptedAs) return null;
  const why = acceptedAs.reason === "typo" ? "spelling forgiven" : acceptedAs.reason === "plural" ? "plural forgiven" : "also accepted";
  return `You typed “${acceptedAs.typed}” · ${why}`;
}

export default function FillBlankGame({ mappedEpisodes }: { mappedEpisodes: number }) {
  const [stage, setStage] = useState<Stage>("intro");
  const [round, setRound] = useState<FillBlankQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [questionState, setQuestionState] = useState<QuestionState>(FRESH_QUESTION);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [stats, setStats] = useState<LifetimeStats>(loadLifetimeStats);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const current = round[currentIndex];
  const currentRecord = current && answers[currentIndex]?.question.id === current.id ? answers[currentIndex] : null;
  const score = answers.reduce((total, answer) => total + answer.points, 0);
  const solvedCount = answers.filter((answer) => answer.solved).length;
  const cleanCount = answers.filter((answer) => answer.points === BLANK_POINTS_PER_QUESTION).length;
  const verdict = useMemo(() => verdictFor(score), [score]);
  const currentStreak = useMemo(() => {
    let streak = 0;
    for (let index = answers.length - 1; index >= 0; index -= 1) {
      if (!answers[index].solved) break;
      streak += 1;
    }
    return streak;
  }, [answers]);

  const difficultyBreakdown = useMemo(() => (
    (["easy", "medium", "hard"] as BlankDifficulty[]).map((difficulty) => {
      const matching = answers.filter((answer) => answer.question.difficulty === difficulty);
      return {
        difficulty,
        points: matching.reduce((total, answer) => total + answer.points, 0),
        possible: matching.length * BLANK_POINTS_PER_QUESTION,
        solved: matching.filter((answer) => answer.solved).length,
        total: matching.length,
      };
    })
  ), [answers]);

  useEffect(() => {
    if (currentRecord) nextButtonRef.current?.focus();
  }, [currentRecord]);

  useEffect(() => {
    if (stage === "playing" && !currentRecord) inputRef.current?.focus({ preventScroll: true });
  }, [stage, currentIndex, currentRecord]);

  const start = useCallback(() => {
    const avoidIds = new Set(round.map((question) => question.id));
    const removalIds = readBlankRemovalIds();
    setRound(pickBlankRound(avoidIds, removalIds));
    setCurrentIndex(0);
    setQuestionState(FRESH_QUESTION);
    setAnswers([]);
    setStage("playing");
    scrollToTop();
  }, [round]);

  const finishQuestion = useCallback((record: Omit<AnswerRecord, "question">) => {
    if (!current) return;
    setAnswers((existing) => [...existing, { question: current, ...record }]);
  }, [current]);

  const submit = useCallback((event: FormEvent) => {
    event.preventDefault();
    if (!current || currentRecord) return;
    const state = questionState;
    const guess = composeGuess(current, state.input, state.hintLevel);
    const result = judgeGuess(guess, current);
    if (result.verdict === "empty") return;

    if (isSolved(result)) {
      setQuestionState({ ...state, feedback: null });
      finishQuestion({
        misses: state.misses,
        hintsUsed: state.hintLevel,
        points: state.points,
        solved: true,
        acceptedAs: result.verdict === "accepted" ? { typed: guess, reason: result.reason } : null,
      });
      return;
    }

    const key = compactGuess(guess);
    if (state.misses.some((miss) => compactGuess(miss) === key)) {
      setQuestionState({ ...state, feedback: { tone: "info", text: `Already tried “${guess}”. No charge.` } });
      return;
    }

    logBlankGuess(current.id, guess);
    if (result.verdict === "near" && !state.nearMissUsed) {
      setQuestionState({
        ...state,
        nearMissUsed: true,
        shake: state.shake + 1,
        feedback: { tone: "near", text: "So close — check your spelling. That one was free." },
      });
      return;
    }

    const points = state.points - 1;
    const misses = [...state.misses, guess];
    if (points === 0) {
      setQuestionState({ ...state, input: "", points, misses, shake: state.shake + 1, feedback: null });
      finishQuestion({ misses, hintsUsed: state.hintLevel, points: 0, solved: false, acceptedAs: null });
      return;
    }
    setQuestionState({
      ...state,
      input: "",
      points,
      misses,
      shake: state.shake + 1,
      feedback: { tone: "wrong", text: `“${guess}” isn’t it. −1 point.` },
    });
  }, [current, currentRecord, finishQuestion, questionState]);

  const takeHint = useCallback(() => {
    if (!current || currentRecord) return;
    setQuestionState((state) => {
      if (state.points < 2 || !canRevealMore(current, state.hintLevel)) return state;
      return {
        ...state,
        input: inputAfterHint(current, state.input, state.hintLevel),
        points: state.points - 1,
        hintLevel: state.hintLevel + 1,
        feedback: { tone: "info", text: "Hint used. −1 point." },
      };
    });
    inputRef.current?.focus({ preventScroll: true });
  }, [current, currentRecord]);

  const giveUp = useCallback(() => {
    if (!current || currentRecord) return;
    setQuestionState((state) => ({ ...state, points: 0, feedback: null }));
    finishQuestion({
      misses: questionState.misses,
      hintsUsed: questionState.hintLevel,
      points: 0,
      solved: false,
      acceptedAs: null,
    });
  }, [current, currentRecord, finishQuestion, questionState]);

  const next = useCallback(() => {
    if (!currentRecord) return;
    if (currentIndex === round.length - 1) {
      const updated: LifetimeStats = {
        games: stats.games + 1,
        best: Math.max(stats.best, score),
        totalPoints: stats.totalPoints + score,
        totalSolved: stats.totalSolved + solvedCount,
        totalClean: stats.totalClean + cleanCount,
        totalQuestions: stats.totalQuestions + FILL_BLANK_LENGTH,
      };
      setStats(updated);
      try {
        window.localStorage.setItem(STATS_KEY, JSON.stringify(updated));
      } catch {
        // Keep the completed result even if storage is unavailable.
      }
      setStage("result");
    } else {
      setCurrentIndex((index) => index + 1);
      setQuestionState(FRESH_QUESTION);
    }
    scrollToTop();
  }, [cleanCount, currentIndex, currentRecord, round.length, score, solvedCount, stats]);

  function keepInputVisible() {
    if (!window.matchMedia("(max-width: 720px)").matches) return;
    window.setTimeout(() => inputRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 250);
  }

  const topbar = (
    <header className="quiz-topbar blank-topbar">
      <Link className="wordmark" href="/blank" aria-label="Regulation Fill in the Blank home">
        <span className="regulation-brand-mark" aria-hidden="true" />
        <span className="regulation-lockup">
          <strong>regulation</strong>
          <small>fill in the blank</small>
        </span>
      </Link>
      <nav className="topbar-tools" aria-label="Site navigation">
        <Link className="bank-link blank-review-bank-link" href="/blank/bank">Review bank</Link>
        <Link className="bank-link" href="/">Who said it</Link>
        <Link className="bank-link stats-link" href="/stats">Speaker stats</Link>
        <div className="corpus-stamp"><span aria-hidden="true" />{mappedEpisodes} episodes digested</div>
      </nav>
    </header>
  );

  if (stage === "intro") {
    return (
      <main className="quiz-shell blank-shell blank-intro-shell">
        {topbar}
        <section className="blank-intro">
          <div className="blank-intro-content">
            <div className="blank-intro-copy">
              <p className="blank-kicker">Transcript damage detected</p>
              <h1><span>regulation</span>fill in the blank</h1>
              <p className="intro-lede">Type the missing words back into ten absurd lines from the show&apos;s history.</p>
              <button className="primary-button" type="button" onClick={start}>
                Open the damaged transcript <span aria-hidden="true">→</span>
              </button>
              <p className="fine-print">
                Each blank is worth three points. A wrong guess or a letter hint costs one. Capitals,
                punctuation, and small spelling slips are forgiven. Every answer restores the original
                quote, the three lines before it, and who said it.
              </p>
            </div>

            <aside className="blank-evidence" aria-label="Example fill in the blank question">
              <div className="blank-evidence-head">
                <span>Damaged evidence / sample 001</span>
                <b>{patternLabel(EXAMPLE_QUESTION, 0)}</b>
              </div>
              <blockquote>
                “{EXAMPLE_QUESTION.beforeBlank}<mark><BlankTiles question={EXAMPLE_QUESTION} solvedView /></mark>{EXAMPLE_QUESTION.afterBlank}”
              </blockquote>
              <div className="blank-evidence-guess">
                <span className="blank-evidence-input">{EXAMPLE_QUESTION.answer.toLowerCase()}<i aria-hidden="true" /></span>
                <strong>Repair accepted · +3</strong>
              </div>
              <dl>
                <div><dt>Question bank</dt><dd>{FILL_BLANK_BANK.length}</dd></div>
                <div><dt>Repairs per run</dt><dd>{FILL_BLANK_LENGTH}</dd></div>
                <div><dt>Max score</dt><dd>{BLANK_MAX_SCORE}</dd></div>
              </dl>
            </aside>
          </div>
        </section>
      </main>
    );
  }

  if (stage === "playing" && current) {
    const progress = ((currentIndex + 1) / round.length) * 100;
    const source = current.source;
    const correctProfile = HOST_PROFILES[source.speaker];
    const { input, points, hintLevel, misses, feedback, shake } = questionState;
    const hintAvailable = !currentRecord && points >= 2 && canRevealMore(current, hintLevel);
    const hintReason = points < 2
      ? "Your last point is saved for a guess."
      : !canRevealMore(current, hintLevel) ? "No more letters to reveal." : undefined;

    return (
      <main className="quiz-shell blank-shell blank-playing-shell">
        {topbar}
        <section className="blank-round">
          <div className="question-progress blank-progress">
            <div className="progress-labels">
              <span>Blank {String(currentIndex + 1).padStart(2, "0")}</span>
              <span>{score} pts / streak {currentStreak}</span>
            </div>
            <div className="progress-track" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
            <div className="blank-progress-meta">
              <p>{current.difficulty} file / archive punchline reconstruction</p>
              <ol aria-label={`Round progress: question ${currentIndex + 1} of ${round.length}`}>
                {round.map((question, index) => {
                  const answer = answers[index];
                  const state = answer ? (answer.solved ? "correct" : "wrong") : index === currentIndex ? "current" : "upcoming";
                  return <li className={state} key={question.id} aria-label={`Question ${index + 1}: ${state}`}>{index + 1}</li>;
                })}
              </ol>
            </div>
          </div>

          <article className="blank-quote-card">
            <span aria-hidden="true">“</span>
            <blockquote>
              {current.beforeBlank}
              <mark
                className={shake ? "blank-shake" : undefined}
                key={shake}
                aria-label={`missing words, ${patternLabel(current, hintLevel)}`}
              >
                <BlankTiles question={current} typed={input} hintLevel={hintLevel} solvedView={currentRecord !== null} />
              </mark>
              {current.afterBlank}
            </blockquote>
            <p>— {patternLabel(current, 0)}</p>
          </article>

          {!currentRecord && (
            <form className="blank-answer-panel" onSubmit={submit}>
              <div className="blank-answer-status">
                <PointsMeter points={points} />
                <span>worth {points}</span>
                {misses.length > 0 && (
                  <ul aria-label="Wrong guesses">
                    {misses.map((miss) => <li key={miss}><s>{miss}</s></li>)}
                  </ul>
                )}
              </div>
              <label className="blank-answer-label" htmlFor="blank-answer-input">Type the missing words</label>
              <div className="blank-answer-row">
                <input
                  id="blank-answer-input"
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(event) => setQuestionState((state) => ({ ...state, input: event.target.value }))}
                  onFocus={keepInputVisible}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  enterKeyHint="go"
                  maxLength={48}
                  placeholder={hintLevel ? "type the remaining letters…" : "type your repair…"}
                />
                <button className="primary-button compact" type="submit" disabled={!input.trim()}>
                  Submit <span aria-hidden="true">↵</span>
                </button>
              </div>
              <div className="blank-answer-tools">
                <button
                  type="button"
                  className="blank-tool-button"
                  onClick={takeHint}
                  aria-disabled={!hintAvailable}
                  title={hintReason}
                  disabled={!hintAvailable}
                >
                  Reveal a letter <b>−1</b>
                </button>
                <button type="button" className="blank-tool-button ghost" onClick={giveUp}>Give up</button>
                <p className={`blank-answer-feedback${feedback ? ` ${feedback.tone}` : ""}`} role="status" aria-live="polite">
                  {feedback?.text ?? (hintReason && hintLevel > 0 ? hintReason : "")}
                </p>
              </div>
            </form>
          )}

          {currentRecord && (
            <aside
              className={`blank-reveal wsi-reveal ${currentRecord.solved ? "correct" : "wrong"}`}
              style={{ "--host-color": correctProfile.color, "--host-pale": correctProfile.pale } as CSSProperties}
              role="status"
              aria-live="polite"
            >
              <div className="blank-restored-line">
                <span>
                  {currentRecord.solved ? "Repair accepted" : "Repair rejected"} · +{currentRecord.points}
                  {" "}<PointsMeter points={currentRecord.points} />
                </span>
                <blockquote>
                  “{current.beforeBlank}<mark>{current.answer}</mark>{current.afterBlank}”
                </blockquote>
                {currentRecord.acceptedAs && <small className="blank-accepted-note">{acceptedNote(currentRecord.acceptedAs)}</small>}
                {currentRecord.misses.length > 0 && (
                  <small className="blank-accepted-note">Missed: {currentRecord.misses.map((miss) => `“${miss}”`).join(", ")}</small>
                )}
              </div>
              <div className="wsi-transcript-lead">
                <div className="wsi-transcript-heading">
                  <span>Transcript excerpt / names restored</span>
                  <small>{formatTranscriptTime(source.leadIn[0].startSec)} → {formatTranscriptTime(source.startSec)}</small>
                </div>
                <ol aria-label="Three preceding transcript lines followed by the restored quote">
                  {source.leadIn.map((line, index) => (
                    <li
                      key={`${line.startSec}-${line.speaker}-${index}`}
                      style={{ "--speaker-color": transcriptSpeakerColor(line.speaker) } as CSSProperties}
                    >
                      <strong>{line.speaker}</strong>
                      <p>{line.text}</p>
                    </li>
                  ))}
                  <li className="wsi-transcript-quote" style={{ "--speaker-color": correctProfile.color } as CSSProperties}>
                    <strong>{correctProfile.name}</strong>
                    <p>{source.quote}</p>
                  </li>
                </ol>
              </div>
              <div className="wsi-reveal-answer blank-reveal-answer">
                <div className="wsi-reveal-verdict">
                  <span>Missing words</span>
                  <strong>{current.answer}</strong>
                </div>
                <div className="wsi-reveal-context">
                  <span>Case note</span>
                  <p>{source.context}</p>
                  <small>
                    Said by {correctProfile.name} · Episode {source.episode} · {source.title} · {source.published} · {formatTranscriptTime(source.startSec)}
                  </small>
                </div>
              </div>
            </aside>
          )}

          {currentRecord && (
            <div className="wsi-round-controls blank-round-controls">
              <span>Transcript restored. Press Enter to continue.</span>
              <button className="primary-button compact" type="button" onClick={next} ref={nextButtonRef}>
                {currentIndex === round.length - 1 ? "Close the file" : "Next damaged line"}
                <span aria-hidden="true">→</span>
              </button>
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="quiz-shell blank-shell blank-result-shell">
      {topbar}
      <section className="blank-result-hero">
        <div>
          <p className="blank-kicker">Archive repair complete</p>
          <p className="blank-score"><strong>{score}</strong><span>/ {BLANK_MAX_SCORE}</span></p>
          <h1>{verdict.title}</h1>
          <p>{verdict.copy}</p>
          <div className="wsi-result-actions">
            <button className="primary-button" type="button" onClick={start}>Damage ten more lines <span aria-hidden="true">↻</span></button>
            <Link className="secondary-button" href="/">Play Who Said It</Link>
          </div>
        </div>
        <aside className="blank-score-slip">
          <span>Transcript integrity</span>
          <strong>{Math.round((score / BLANK_MAX_SCORE) * 100)}%</strong>
          <p>{solvedCount}/{FILL_BLANK_LENGTH} repaired · {cleanCount} clean</p>
          <div className="blank-score-bar" aria-hidden="true"><span style={{ width: `${(score / BLANK_MAX_SCORE) * 100}%` }} /></div>
          <dl>
            <div><dt>Games repaired</dt><dd>{stats.games}</dd></div>
            <div><dt>Personal best</dt><dd>{stats.best}/{BLANK_MAX_SCORE}</dd></div>
            <div><dt>Lifetime solve rate</dt><dd>{stats.totalQuestions ? Math.round((stats.totalSolved / stats.totalQuestions) * 100) : 0}%</dd></div>
          </dl>
        </aside>
      </section>

      <section className="blank-breakdown">
        <header><p className="blank-section-label">Damage report</p><h2>How the repairs held</h2></header>
        <div>
          {difficultyBreakdown.map((item) => (
            <article key={item.difficulty}>
              <span>{item.difficulty} files</span>
              <strong>{item.points}<small>/{item.possible}</small></strong>
              <p>{item.solved}/{item.total} repaired</p>
            </article>
          ))}
        </div>
      </section>

      <section className="blank-review">
        <header><p className="blank-section-label">Full restoration record</p><h2>What belonged in every blank</h2></header>
        <ol>
          {answers.map((answer, index) => {
            const profile = HOST_PROFILES[answer.question.source.speaker];
            return (
              <li className={answer.solved ? "correct" : "wrong"} key={answer.question.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <p>
                    {answer.question.beforeBlank}<mark>{answer.question.answer}</mark>{answer.question.afterBlank}
                  </p>
                  <small>
                    <PointsMeter points={answer.points} /> +{answer.points}
                    {answer.hintsUsed > 0 && ` · ${answer.hintsUsed} ${answer.hintsUsed === 1 ? "hint" : "hints"}`}
                    {answer.misses.length > 0 && ` · you tried ${answer.misses.map((miss) => `“${miss}”`).join(", ")}`}
                  </small>
                </div>
                <HostBadge host={answer.question.source.speaker} />
                <b>{profile.name}</b>
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}
