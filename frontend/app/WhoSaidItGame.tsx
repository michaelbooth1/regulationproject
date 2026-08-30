"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { HostBadge } from "./HostBadge";
import { HOST_ORDER, HOST_PROFILES, type HostId } from "./quiz-data";
import {
  formatTranscriptTime,
  WHO_SAID_IT_BANK,
  WHO_SAID_IT_LENGTH,
  type WhoSaidItQuote,
} from "./who-said-it-data";
import { pickRound } from "./who-said-it-round";


type Stage = "intro" | "playing" | "result";
type AnswerRecord = {
  quote: WhoSaidItQuote;
  choice: HostId;
  correct: boolean;
};
type LifetimeStats = {
  games: number;
  best: number;
  totalCorrect: number;
  totalQuestions: number;
};

const STATS_KEY = "regulation-who-said-it-stats-v1";
const LIFETIME_STAT_FIELDS = ["games", "best", "totalCorrect", "totalQuestions"] as const;
const UNKNOWN_SPEAKER_COLOR = "#c8c2b7";
const EMPTY_STATS: LifetimeStats = {
  games: 0,
  best: 0,
  totalCorrect: 0,
  totalQuestions: 0,
};
function scrollToTop() {
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function isLifetimeStats(value: unknown): value is LifetimeStats {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<LifetimeStats>;
  return LIFETIME_STAT_FIELDS.every((field) => (
    Number.isInteger(candidate[field]) && (candidate[field] ?? -1) >= 0
  ));
}

function loadLifetimeStats(): LifetimeStats {
  if (typeof window === "undefined") return EMPTY_STATS;
  try {
    const saved = window.localStorage.getItem(STATS_KEY);
    if (!saved) return EMPTY_STATS;
    const parsed: unknown = JSON.parse(saved);
    if (isLifetimeStats(parsed)) return parsed;
  } catch {
    // Browser storage is untrusted and optional; a bad value should never block play.
  }
  return EMPTY_STATS;
}

function scoreVerdict(score: number) {
  if (score === 10) {
    return {
      title: "The fifth microphone",
      copy: "Perfect. Either you know the archive or these four have started speaking through you.",
    };
  }
  if (score >= 8) {
    return {
      title: "Dangerously regulation",
      copy: "You can identify a voice from one badly supervised premise. This is both impressive and permanent.",
    };
  }
  if (score >= 6) {
    return {
      title: "Certified comment leaver",
      copy: "You know the rhythms, but the occasional ham tower still throws you off the scent.",
    };
  }
  if (score >= 3) {
    return {
      title: "Confidently in the room",
      copy: "You understood every sentence individually. Assigning them to human beings was the difficult part.",
    };
  }
  return {
    title: "Regulation stranger",
    copy: "The evidence suggests four people said some things. Beyond that, the file remains beautifully unsolved.",
  };
}

function transcriptSpeakerColor(speaker: string) {
  const host = HOST_ORDER.find((hostId) => HOST_PROFILES[hostId].name === speaker);
  return host ? HOST_PROFILES[host].color : UNKNOWN_SPEAKER_COLOR;
}

export default function WhoSaidItGame({ mappedEpisodes }: { mappedEpisodes: number }) {
  const [stage, setStage] = useState<Stage>("intro");
  const [round, setRound] = useState<WhoSaidItQuote[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedHost, setSelectedHost] = useState<HostId | null>(null);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [stats, setStats] = useState<LifetimeStats>(loadLifetimeStats);
  const nextButtonRef = useRef<HTMLButtonElement>(null);

  const current = round[currentIndex];
  const score = answers.filter((answer) => answer.correct).length;
  const scorePercentage = Math.round((score / WHO_SAID_IT_LENGTH) * 100);
  const verdict = useMemo(() => scoreVerdict(score), [score]);
  const currentStreak = useMemo(() => {
    let streak = 0;
    for (let index = answers.length - 1; index >= 0; index -= 1) {
      if (!answers[index].correct) break;
      streak += 1;
    }
    return streak;
  }, [answers]);

  const hostBreakdown = useMemo(
    () => HOST_ORDER.map((host) => {
      const hostAnswers = answers.filter((answer) => answer.quote.speaker === host);
      return {
        host,
        correct: hostAnswers.filter((answer) => answer.correct).length,
        total: hostAnswers.length,
      };
    }),
    [answers],
  );

  useEffect(() => {
    if (selectedHost) nextButtonRef.current?.focus();
  }, [selectedHost]);

  const start = useCallback(() => {
    setRound(pickRound(new Set(round.map((quote) => quote.id))));
    setCurrentIndex(0);
    setSelectedHost(null);
    setAnswers([]);
    setStage("playing");
    scrollToTop();
  }, [round]);

  const choose = useCallback((host: HostId) => {
    if (!current || selectedHost) return;
    setSelectedHost(host);
    setAnswers((existing) => [
      ...existing,
      { quote: current, choice: host, correct: host === current.speaker },
    ]);
  }, [current, selectedHost]);

  const next = useCallback(() => {
    if (!selectedHost) return;
    if (currentIndex === round.length - 1) {
      const updated = {
        games: stats.games + 1,
        best: Math.max(stats.best, score),
        totalCorrect: stats.totalCorrect + score,
        totalQuestions: stats.totalQuestions + WHO_SAID_IT_LENGTH,
      };
      setStats(updated);
      try {
        window.localStorage.setItem(STATS_KEY, JSON.stringify(updated));
      } catch {
        // The completed game still counts for this screen when storage is unavailable.
      }
      setStage("result");
    } else {
      setCurrentIndex((index) => index + 1);
      setSelectedHost(null);
    }
    scrollToTop();
  }, [currentIndex, round.length, score, selectedHost, stats]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (stage !== "playing" || selectedHost || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select")) return;
      const choiceIndex = Number(event.key) - 1;
      if (choiceIndex >= 0 && choiceIndex < HOST_ORDER.length) {
        event.preventDefault();
        choose(HOST_ORDER[choiceIndex]);
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [choose, selectedHost, stage]);

  const topbar = (
    <header className="quiz-topbar">
      <Link className="wordmark" href="/" aria-label="Regulation Who Said It home">
        <span className="regulation-brand-mark" aria-hidden="true" />
        <span className="regulation-lockup">
          <strong>regulation</strong>
          <small>who said it</small>
        </span>
      </Link>
      <nav className="topbar-tools" aria-label="Site navigation">
        <Link className="bank-link" href="/blank">Fill the blank</Link>
        <Link className="bank-link stats-link" href="/stats">Speaker stats</Link>
        <div className="corpus-stamp">
          <span aria-hidden="true" />
          {mappedEpisodes} episodes digested
        </div>
      </nav>
    </header>
  );

  if (stage === "intro") {
    return (
      <main className="quiz-shell wsi-shell wsi-intro-shell">
        {topbar}
        <section className="wsi-intro-grid">
          <div className="wsi-intro-content">
          <div className="wsi-intro-copy">
            <h1><span>regulation</span>who said it?</h1>
            <p className="intro-lede">
              Made by community member Michael Booth
            </p>
            <button className="primary-button" type="button" onClick={start}>
              Start the regulation quiz
              <span aria-hidden="true">→</span>
            </button>
            <p className="fine-print">
              Every run guarantees at least two quotes from each host and a deliberate mix of
              easy, medium, and hard files. Back-to-back games avoid repeats. Nick isn&apos;t
              included because he does not talk enough in the mapped transcripts to support a
              fair question pool.
            </p>
          </div>

          <aside className="wsi-evidence" aria-label="Regulation Who Said It game evidence">
            <p className="wsi-evidence-label">Regulation evidence / exhibit 001</p>
            <blockquote>“I have a 50-foot ham tower.”</blockquote>
            <div className="wsi-redaction" aria-hidden="true">
              <span /><span /><span />
            </div>
            <dl className="case-facts">
              <div><dt>Quote bank</dt><dd>{WHO_SAID_IT_BANK.length}</dd></div>
              <div><dt>Rounds served</dt><dd>{WHO_SAID_IT_LENGTH}</dd></div>
              <div><dt>Suspects</dt><dd>4</dd></div>
            </dl>
            <p>
              The current suspect pool is Geoff, Andrew, Gavin, and Eric. Nick remains an
              essential Regulation presence; the archive simply does not contain enough mapped
              Nick dialogue for a balanced set yet.
            </p>
            <div className="wsi-suspects">
              {HOST_ORDER.map((host) => <HostBadge host={host} key={host} />)}
            </div>
          </aside>
          </div>
        </section>
      </main>
    );
  }

  if (stage === "playing" && current) {
    const progress = ((currentIndex + 1) / round.length) * 100;
    const correctProfile = HOST_PROFILES[current.speaker];
    const selectedWasCorrect = selectedHost === current.speaker;
    return (
      <main className="quiz-shell wsi-shell wsi-playing-shell">
        {topbar}
        <section className="wsi-round">
          <div className="question-progress">
            <div className="progress-labels">
              <span>Quote {String(currentIndex + 1).padStart(2, "0")}</span>
              <span>{score} correct / streak {currentStreak}</span>
            </div>
            <div className="progress-track" aria-hidden="true">
              <span style={{ width: `${progress}%` }} />
            </div>
            <p>{current.difficulty} file / {current.topic}</p>
            <ol className="wsi-progress-dots" aria-label={`Round progress: quote ${currentIndex + 1} of ${round.length}`}>
              {round.map((quote, index) => {
                const answer = answers[index];
                const state = answer ? (answer.correct ? "correct" : "wrong") : index === currentIndex ? "current" : "upcoming";
                return (
                  <li className={state} key={quote.id} aria-label={`Quote ${index + 1}: ${state}`}>
                    {index + 1}
                  </li>
                );
              })}
            </ol>
          </div>

          <article className="wsi-quote-card">
            <span className="wsi-quote-mark" aria-hidden="true">“</span>
            <blockquote>{current.quote}</blockquote>
            <p>— speaker identity withheld due to the investigation</p>
          </article>

          <div className="wsi-choice-grid" aria-label="Choose the speaker">
            {HOST_ORDER.map((host, hostIndex) => {
              const profile = HOST_PROFILES[host];
              const isCorrect = selectedHost !== null && host === current.speaker;
              const isWrongChoice = selectedHost === host && host !== current.speaker;
              return (
                <button
                  type="button"
                  key={host}
                  disabled={selectedHost !== null}
                  className={`wsi-choice${isCorrect ? " correct" : ""}${isWrongChoice ? " wrong" : ""}`}
                  style={{ "--host-color": profile.color, "--host-pale": profile.pale } as CSSProperties}
                  onClick={() => choose(host)}
                  aria-label={`Choose ${profile.name}`}
                  aria-pressed={selectedHost === host}
                >
                  <span>{profile.name.slice(0, 1)}</span>
                  <strong>{profile.name}</strong>
                  <small>{profile.shortTitle}</small>
                  <kbd aria-hidden="true">{hostIndex + 1}</kbd>
                </button>
              );
            })}
          </div>

          {selectedHost && (
            <aside
              className={`wsi-reveal ${selectedWasCorrect ? "correct" : "wrong"}`}
              style={{ "--host-color": correctProfile.color, "--host-pale": correctProfile.pale } as CSSProperties}
              role="status"
              aria-live="polite"
            >
              <div className="wsi-transcript-lead">
                <div className="wsi-transcript-heading">
                  <span>Transcript excerpt / names restored</span>
                  <small>
                    {formatTranscriptTime(current.leadIn[0].startSec)} → {formatTranscriptTime(current.startSec)}
                  </small>
                </div>
                <ol aria-label="Three preceding transcript lines followed by the attributed mystery quote">
                  {current.leadIn.map((line) => (
                    <li
                      key={`${line.startSec}-${line.speaker}`}
                      style={{ "--speaker-color": transcriptSpeakerColor(line.speaker) } as CSSProperties}
                    >
                      <strong>{line.speaker}</strong>
                      <p>{line.text}</p>
                    </li>
                  ))}
                  <li
                    className="wsi-transcript-quote"
                    style={{ "--speaker-color": correctProfile.color } as CSSProperties}
                  >
                    <strong>{correctProfile.name}</strong>
                    <p>{current.quote}</p>
                  </li>
                </ol>
              </div>
              <div className="wsi-reveal-answer">
                <div className="wsi-reveal-verdict">
                  <span>{selectedWasCorrect ? "Correct" : "Absolutely not"}</span>
                  <strong>It was {correctProfile.name}.</strong>
                </div>
                <div className="wsi-reveal-context">
                  <span>Case note</span>
                  <p>{current.context}</p>
                  <small>
                    Episode {current.episode} · {current.title} · {current.published} · {formatTranscriptTime(current.startSec)}
                  </small>
                </div>
              </div>
            </aside>
          )}

          <div className="wsi-round-controls">
            <span>{selectedHost ? "Attribution unredacted" : "Pick one alleged speaker"}</span>
            <button ref={nextButtonRef} className="primary-button compact" type="button" disabled={!selectedHost} onClick={next}>
              {currentIndex === round.length - 1 ? "Close the case" : "Next suspicious line"}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="quiz-shell wsi-shell wsi-result-shell">
      {topbar}
      <section className="wsi-result-hero">
        <div>
          <p className="kicker">Case closed / transcript still open</p>
          <p className="wsi-score"><strong>{score}</strong><span>/ {WHO_SAID_IT_LENGTH}</span></p>
          <h1>{verdict.title}</h1>
          <p>{verdict.copy}</p>
          <div className="wsi-result-actions">
            <button className="primary-button dark" type="button" onClick={start}>
              Draw ten new quotes
              <span aria-hidden="true">↻</span>
            </button>
          </div>
        </div>
        <aside className="wsi-score-slip">
          <span>Regulation damage</span>
          <strong>{scorePercentage}%</strong>
          <p>{WHO_SAID_IT_LENGTH - score} false accusations</p>
          <div aria-hidden="true"><span style={{ width: `${scorePercentage}%` }} /></div>
          <small>Legally meaningless. Spiritually permanent.</small>
          {stats.games > 0 && (
            <dl className="wsi-lifetime-stats">
              <div><dt>Games</dt><dd>{stats.games}</dd></div>
              <div><dt>Personal best</dt><dd>{stats.best}/{WHO_SAID_IT_LENGTH}</dd></div>
              <div>
                <dt>Lifetime accuracy</dt>
                <dd>{Math.round((stats.totalCorrect / Math.max(stats.totalQuestions, 1)) * 100)}%</dd>
              </div>
            </dl>
          )}
        </aside>
      </section>

      <section className="wsi-breakdown" aria-labelledby="wsi-breakdown-title">
        <div className="section-heading compact-heading">
          <p>Voice-by-voice</p>
          <h2 id="wsi-breakdown-title">Where the accusations landed</h2>
        </div>
        <div className="wsi-breakdown-grid">
          {hostBreakdown.map(({ host, correct, total }) => {
            const profile = HOST_PROFILES[host];
            return (
              <article key={host} style={{ "--host-color": profile.color, "--host-pale": profile.pale } as CSSProperties}>
                <HostBadge host={host} />
                <strong>{correct}<span>/{total}</span></strong>
                <p>{correct === total ? "No false charges" : `${total - correct} misidentified`}</p>
                <div aria-hidden="true"><span style={{ width: `${total ? (correct / total) * 100 : 0}%` }} /></div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="wsi-review" aria-labelledby="wsi-review-title">
        <div className="section-heading">
          <p>Full attribution record</p>
          <h2 id="wsi-review-title">What you accused everyone of saying</h2>
        </div>
        <div className="wsi-review-list">
          {answers.map((answer, index) => {
            const correct = HOST_PROFILES[answer.quote.speaker];
            const choice = HOST_PROFILES[answer.choice];
            return (
              <article
                key={answer.quote.id}
                className={answer.correct ? "correct" : "wrong"}
                style={{ "--host-color": correct.color, "--host-pale": correct.pale } as CSSProperties}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <blockquote>“{answer.quote.quote}”</blockquote>
                <div>
                  <HostBadge host={answer.quote.speaker} />
                  {!answer.correct && <small>You picked {choice.name}</small>}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <footer className="quiz-footer">
        <p>Ten quotes sampled from {WHO_SAID_IT_BANK.length}. Every run includes all four hosts.</p>
        <p>
          <Link href="/who-said-it/bank">Inspect the full quote bank →</Link>
          {" · "}
          <a href="https://www.patreon.com/TheRegulationPod" target="_blank" rel="noreferrer">Official podcast ↗</a>
        </p>
      </footer>
    </main>
  );
}
