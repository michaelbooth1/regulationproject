"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { HostBadge } from "./HostBadge";
import {
  FILL_BLANK_BANK,
  FILL_BLANK_LENGTH,
  type BlankDifficulty,
  type FillBlankQuestion,
} from "./fill-blank-data";
import { pickBlankRound, shuffleBlankOptions } from "./fill-blank-round";
import { HOST_ORDER, HOST_PROFILES } from "./quiz-data";
import { formatTranscriptTime } from "./who-said-it-data";


type Stage = "intro" | "playing" | "result";
type PreparedQuestion = FillBlankQuestion & { shuffledOptions: string[] };
type AnswerRecord = {
  question: PreparedQuestion;
  choice: string;
  correct: boolean;
};
type LifetimeStats = {
  games: number;
  best: number;
  totalCorrect: number;
  totalQuestions: number;
};

const STATS_KEY = "regulation-fill-blank-stats-v1";
const UNKNOWN_SPEAKER_COLOR = "#c8c2b7";
const EMPTY_STATS: LifetimeStats = { games: 0, best: 0, totalCorrect: 0, totalQuestions: 0 };

function scrollToTop() {
  window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
}

function loadLifetimeStats(): LifetimeStats {
  if (typeof window === "undefined") return EMPTY_STATS;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STATS_KEY) ?? "null");
    if (!parsed || typeof parsed !== "object") return EMPTY_STATS;
    const candidate = parsed as Partial<LifetimeStats>;
    if ([candidate.games, candidate.best, candidate.totalCorrect, candidate.totalQuestions]
      .every((value) => Number.isInteger(value) && (value ?? -1) >= 0)) {
      return candidate as LifetimeStats;
    }
  } catch {
    // Device-local history is optional and must never prevent a game.
  }
  return EMPTY_STATS;
}

function verdictFor(score: number) {
  if (score === 10) {
    return {
      title: "Perfect reconstruction",
      copy: "Every missing word returned to its proper crime scene. The archive has nothing left to teach you.",
    };
  }
  if (score >= 8) {
    return {
      title: "Archive restoration expert",
      copy: "You can rebuild a Regulation sentence from the shape of the damage alone.",
    };
  }
  if (score >= 6) {
    return {
      title: "Certified stenographer",
      copy: "Most of the evidence survived. A few beans, dogs, and toilet components remain unaccounted for.",
    };
  }
  if (score >= 3) {
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

export default function FillBlankGame({ mappedEpisodes }: { mappedEpisodes: number }) {
  const [stage, setStage] = useState<Stage>("intro");
  const [round, setRound] = useState<PreparedQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [stats, setStats] = useState<LifetimeStats>(loadLifetimeStats);
  const nextButtonRef = useRef<HTMLButtonElement>(null);

  const current = round[currentIndex];
  const score = answers.filter((answer) => answer.correct).length;
  const verdict = useMemo(() => verdictFor(score), [score]);
  const currentStreak = useMemo(() => {
    let streak = 0;
    for (let index = answers.length - 1; index >= 0; index -= 1) {
      if (!answers[index].correct) break;
      streak += 1;
    }
    return streak;
  }, [answers]);

  const difficultyBreakdown = useMemo(() => (
    (["easy", "medium", "hard"] as BlankDifficulty[]).map((difficulty) => {
      const matching = answers.filter((answer) => answer.question.difficulty === difficulty);
      return {
        difficulty,
        correct: matching.filter((answer) => answer.correct).length,
        total: matching.length,
      };
    })
  ), [answers]);

  useEffect(() => {
    if (selectedChoice) nextButtonRef.current?.focus();
  }, [selectedChoice]);

  const start = useCallback(() => {
    const avoidIds = new Set(round.map((question) => question.id));
    const nextRound = pickBlankRound(avoidIds).map((question) => ({
      ...question,
      shuffledOptions: shuffleBlankOptions(question.options),
    }));
    setRound(nextRound);
    setCurrentIndex(0);
    setSelectedChoice(null);
    setAnswers([]);
    setStage("playing");
    scrollToTop();
  }, [round]);

  const choose = useCallback((choice: string) => {
    if (!current || selectedChoice) return;
    setSelectedChoice(choice);
    setAnswers((existing) => [
      ...existing,
      { question: current, choice, correct: choice === current.answer },
    ]);
  }, [current, selectedChoice]);

  const next = useCallback(() => {
    if (!selectedChoice) return;
    if (currentIndex === round.length - 1) {
      const updated = {
        games: stats.games + 1,
        best: Math.max(stats.best, score),
        totalCorrect: stats.totalCorrect + score,
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
      setSelectedChoice(null);
    }
    scrollToTop();
  }, [currentIndex, round.length, score, selectedChoice, stats]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (stage !== "playing" || selectedChoice || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select")) return;
      const optionIndex = Number(event.key) - 1;
      if (current && optionIndex >= 0 && optionIndex < current.shuffledOptions.length) {
        event.preventDefault();
        choose(current.shuffledOptions[optionIndex]);
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [choose, current, selectedChoice, stage]);

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
              <p className="intro-lede">Reconstruct ten absurd lines from the show&apos;s history.</p>
              <button className="primary-button" type="button" onClick={start}>
                Open the damaged transcript <span aria-hidden="true">→</span>
              </button>
              <p className="fine-print">
                Choose the missing words from four possible repairs. Once the file is locked,
                the transcript restores the three lines before it and identifies who said it.
                Back-to-back games avoid repeats.
              </p>
            </div>

            <aside className="blank-evidence" aria-label="Example fill in the blank question">
              <div className="blank-evidence-head">
                <span>Damaged evidence / sample 001</span>
                <b>One word missing</b>
              </div>
              <blockquote>
                “What if every <mark>________</mark> on Earth was flushed at the exact same time?”
              </blockquote>
              <ol>
                <li><b>A</b> waffle maker</li>
                <li className="is-answer"><b>B</b> toilet</li>
                <li><b>C</b> fire hydrant</li>
                <li><b>D</b> hot tub</li>
              </ol>
              <dl>
                <div><dt>Question bank</dt><dd>{FILL_BLANK_BANK.length}</dd></div>
                <div><dt>Repairs per run</dt><dd>{FILL_BLANK_LENGTH}</dd></div>
                <div><dt>Possible repairs</dt><dd>4</dd></div>
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
    const selectedWasCorrect = selectedChoice === current.answer;

    return (
      <main className="quiz-shell blank-shell blank-playing-shell">
        {topbar}
        <section className="blank-round">
          <div className="question-progress blank-progress">
            <div className="progress-labels">
              <span>Blank {String(currentIndex + 1).padStart(2, "0")}</span>
              <span>{score} repaired / streak {currentStreak}</span>
            </div>
            <div className="progress-track" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
            <div className="blank-progress-meta">
              <p>{current.difficulty} file / {source.topic}</p>
              <ol aria-label={`Round progress: question ${currentIndex + 1} of ${round.length}`}>
                {round.map((question, index) => {
                  const answer = answers[index];
                  const state = answer ? (answer.correct ? "correct" : "wrong") : index === currentIndex ? "current" : "upcoming";
                  return <li className={state} key={question.id} aria-label={`Question ${index + 1}: ${state}`}>{index + 1}</li>;
                })}
              </ol>
            </div>
          </div>

          <article className="blank-quote-card">
            <span aria-hidden="true">“</span>
            <blockquote>
              {current.beforeBlank}
              <mark aria-label="missing words">________</mark>
              {current.afterBlank}
            </blockquote>
            <p>— select the missing evidence</p>
          </article>

          <div className="blank-choice-grid" aria-label="Choose the missing words">
            {current.shuffledOptions.map((option, optionIndex) => {
              const isCorrect = selectedChoice !== null && option === current.answer;
              const isWrongChoice = selectedChoice === option && option !== current.answer;
              return (
                <button
                  type="button"
                  key={option}
                  disabled={selectedChoice !== null}
                  className={`blank-choice${isCorrect ? " correct" : ""}${isWrongChoice ? " wrong" : ""}`}
                  onClick={() => choose(option)}
                  aria-pressed={selectedChoice === option}
                >
                  <span>{String.fromCharCode(65 + optionIndex)}</span>
                  <strong>{option}</strong>
                  <kbd aria-hidden="true">{optionIndex + 1}</kbd>
                </button>
              );
            })}
          </div>

          {selectedChoice && (
            <aside
              className={`blank-reveal wsi-reveal ${selectedWasCorrect ? "correct" : "wrong"}`}
              style={{ "--host-color": correctProfile.color, "--host-pale": correctProfile.pale } as CSSProperties}
              role="status"
              aria-live="polite"
            >
              <div className="blank-restored-line">
                <span>{selectedWasCorrect ? "Repair accepted" : "Repair rejected"}</span>
                <blockquote>
                  “{current.beforeBlank}<mark>{current.answer}</mark>{current.afterBlank}”
                </blockquote>
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

          <div className="wsi-round-controls blank-round-controls">
            <span>{selectedChoice ? "Transcript restored. Continue when ready." : "Pick one replacement."}</span>
            <button
              className="primary-button compact"
              type="button"
              disabled={!selectedChoice}
              onClick={next}
              ref={nextButtonRef}
            >
              {currentIndex === round.length - 1 ? "Close the file" : "Next damaged line"}
              <span aria-hidden="true">→</span>
            </button>
          </div>
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
          <p className="blank-score"><strong>{score}</strong><span>/ {FILL_BLANK_LENGTH}</span></p>
          <h1>{verdict.title}</h1>
          <p>{verdict.copy}</p>
          <div className="wsi-result-actions">
            <button className="primary-button" type="button" onClick={start}>Damage ten more lines <span aria-hidden="true">↻</span></button>
            <Link className="secondary-button" href="/">Play Who Said It</Link>
          </div>
        </div>
        <aside className="blank-score-slip">
          <span>Transcript integrity</span>
          <strong>{Math.round((score / FILL_BLANK_LENGTH) * 100)}%</strong>
          <p>{FILL_BLANK_LENGTH - score} incorrect repairs</p>
          <div className="blank-score-bar" aria-hidden="true"><span style={{ width: `${score * 10}%` }} /></div>
          <dl>
            <div><dt>Games repaired</dt><dd>{stats.games}</dd></div>
            <div><dt>Personal best</dt><dd>{stats.best}/10</dd></div>
            <div><dt>Lifetime accuracy</dt><dd>{stats.totalQuestions ? Math.round((stats.totalCorrect / stats.totalQuestions) * 100) : 0}%</dd></div>
          </dl>
        </aside>
      </section>

      <section className="blank-breakdown">
        <header><p className="blank-section-label">Damage report</p><h2>How the repairs held</h2></header>
        <div>
          {difficultyBreakdown.map((item) => (
            <article key={item.difficulty}>
              <span>{item.difficulty} files</span>
              <strong>{item.correct}<small>/{item.total}</small></strong>
              <p>{item.total - item.correct} rejected</p>
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
              <li className={answer.correct ? "correct" : "wrong"} key={answer.question.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <p>
                    {answer.question.beforeBlank}<mark>{answer.question.answer}</mark>{answer.question.afterBlank}
                  </p>
                  {!answer.correct && <small>You chose “{answer.choice}”</small>}
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

