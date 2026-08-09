"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { HOST_ORDER, HOST_PROFILES, type HostId } from "./quiz-data";
import {
  WHO_SAID_IT_BANK,
  WHO_SAID_IT_LENGTH,
  type WhoSaidItQuote,
} from "./who-said-it-data";


type Stage = "intro" | "playing" | "result";
type AnswerRecord = {
  quote: WhoSaidItQuote;
  choice: HostId;
  correct: boolean;
};

function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

function pickRound(): WhoSaidItQuote[] {
  const guaranteed = HOST_ORDER.flatMap((host) =>
    shuffle(WHO_SAID_IT_BANK.filter((quote) => quote.speaker === host)).slice(0, 2),
  );
  const guaranteedIds = new Set(guaranteed.map((quote) => quote.id));
  const remaining = shuffle(
    WHO_SAID_IT_BANK.filter((quote) => !guaranteedIds.has(quote.id)),
  ).slice(0, WHO_SAID_IT_LENGTH - guaranteed.length);
  return shuffle([...guaranteed, ...remaining]);
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
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

function HostBadge({ host }: { host: HostId }) {
  const profile = HOST_PROFILES[host];
  return (
    <span
      className="wsi-host-badge"
      style={{ "--host-color": profile.color } as React.CSSProperties}
    >
      <b>{profile.name.slice(0, 1)}</b>
      {profile.name}
    </span>
  );
}

export default function WhoSaidItGame({ mappedEpisodes }: { mappedEpisodes: number }) {
  const [stage, setStage] = useState<Stage>("intro");
  const [round, setRound] = useState<WhoSaidItQuote[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedHost, setSelectedHost] = useState<HostId | null>(null);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [choiceOrder, setChoiceOrder] = useState<HostId[]>(HOST_ORDER);

  const current = round[currentIndex];
  const score = answers.filter((answer) => answer.correct).length;
  const verdict = useMemo(() => scoreVerdict(score), [score]);
  const currentStreak = useMemo(() => {
    let streak = 0;
    for (let index = answers.length - 1; index >= 0; index -= 1) {
      if (!answers[index].correct) break;
      streak += 1;
    }
    return streak;
  }, [answers]);

  function scrollToTop() {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function start() {
    setRound(pickRound());
    setCurrentIndex(0);
    setSelectedHost(null);
    setAnswers([]);
    setChoiceOrder(shuffle(HOST_ORDER));
    setStage("playing");
    scrollToTop();
  }

  function choose(host: HostId) {
    if (!current || selectedHost) return;
    setSelectedHost(host);
    setAnswers((existing) => [
      ...existing,
      { quote: current, choice: host, correct: host === current.speaker },
    ]);
  }

  function next() {
    if (!selectedHost) return;
    if (currentIndex === round.length - 1) {
      setStage("result");
    } else {
      setCurrentIndex((index) => index + 1);
      setSelectedHost(null);
      setChoiceOrder(shuffle(HOST_ORDER));
    }
    scrollToTop();
  }

  const topbar = (
    <header className="quiz-topbar">
      <Link className="wordmark" href="/" aria-label="Regulation games home">
        <span className="wordmark-r">R</span>
        <span>Regulation<br /><strong>Games</strong></span>
      </Link>
      <nav className="topbar-tools" aria-label="Game navigation">
        <Link className="bank-link" href="/">Host quiz</Link>
        <Link className="bank-link" href="/who-said-it/bank">Quote bank</Link>
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
          <div className="wsi-intro-copy">
            <p className="kicker">Out of context / under oath</p>
            <h1>Who<br /><span>said it?</span></h1>
            <p className="intro-lede">
              Ten real lines. Four possible hosts. One unsettling realization
              that all of these sentences entered a microphone on purpose.
            </p>
            <button className="primary-button" type="button" onClick={start}>
              Open the transcript file
              <span aria-hidden="true">→</span>
            </button>
            <p className="fine-print">
              Real transcript excerpts, lightly trimmed for readability. Contains podcast language.
            </p>
          </div>

          <aside className="wsi-evidence" aria-label="Who Said It game evidence">
            <p className="wsi-evidence-label">Exhibit A / no useful context</p>
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
              Every run guarantees at least two quotes from each host. Answers
              reveal the episode, timestamp, and just enough context to make it worse.
            </p>
            <div className="wsi-suspects">
              {HOST_ORDER.map((host) => <HostBadge host={host} key={host} />)}
            </div>
          </aside>
        </section>
        <div className="ticker" aria-hidden="true">
          <span>REAL QUOTES</span><span>BAD CONTEXT</span><span>FOUR SUSPECTS</span><span>ONE HAM TOWER</span>
        </div>
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
        <section className="wsi-round" aria-live="polite">
          <div className="question-progress">
            <div className="progress-labels">
              <span>Quote {String(currentIndex + 1).padStart(2, "0")}</span>
              <span>{score} correct / streak {currentStreak}</span>
            </div>
            <div className="progress-track" aria-hidden="true">
              <span style={{ width: `${progress}%` }} />
            </div>
            <p>{current.topic}</p>
          </div>

          <article className="wsi-quote-card">
            <span className="wsi-quote-mark" aria-hidden="true">“</span>
            <blockquote>{current.quote}</blockquote>
            <p>— speaker identity withheld due to the investigation</p>
          </article>

          <div className="wsi-choice-grid" aria-label="Choose the speaker">
            {choiceOrder.map((host) => {
              const profile = HOST_PROFILES[host];
              const isCorrect = selectedHost !== null && host === current.speaker;
              const isWrongChoice = selectedHost === host && host !== current.speaker;
              return (
                <button
                  type="button"
                  key={host}
                  disabled={selectedHost !== null}
                  className={`wsi-choice${isCorrect ? " correct" : ""}${isWrongChoice ? " wrong" : ""}`}
                  style={{ "--host-color": profile.color, "--host-pale": profile.pale } as React.CSSProperties}
                  onClick={() => choose(host)}
                  aria-label={`Choose ${profile.name}`}
                >
                  <span>{profile.name.slice(0, 1)}</span>
                  <strong>{profile.name}</strong>
                  <small>{profile.shortTitle}</small>
                </button>
              );
            })}
          </div>

          {selectedHost && (
            <aside
              className={`wsi-reveal ${selectedWasCorrect ? "correct" : "wrong"}`}
              style={{ "--host-color": correctProfile.color, "--host-pale": correctProfile.pale } as React.CSSProperties}
            >
              <div className="wsi-reveal-verdict">
                <span>{selectedWasCorrect ? "Correct" : "Absolutely not"}</span>
                <strong>It was {correctProfile.name}.</strong>
              </div>
              <div className="wsi-reveal-context">
                <p>{current.context}</p>
                <small>
                  Episode {current.episode} · {current.title} · {current.published} · {formatTime(current.startSec)}
                </small>
              </div>
            </aside>
          )}

          <div className="wsi-round-controls">
            <span>{selectedHost ? "Attribution unredacted" : "Pick one alleged speaker"}</span>
            <button className="primary-button compact" type="button" disabled={!selectedHost} onClick={next}>
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
          <button className="primary-button dark" type="button" onClick={start}>
            Draw ten new quotes
            <span aria-hidden="true">↻</span>
          </button>
        </div>
        <aside className="wsi-score-slip">
          <span>Official damage</span>
          <strong>{score * 10}%</strong>
          <p>{WHO_SAID_IT_LENGTH - score} false accusations</p>
          <div aria-hidden="true"><span style={{ width: `${score * 10}%` }} /></div>
          <small>Legally meaningless. Spiritually permanent.</small>
        </aside>
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
                style={{ "--host-color": correct.color, "--host-pale": correct.pale } as React.CSSProperties}
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
        <p><Link href="/who-said-it/bank">Inspect the full quote bank →</Link></p>
      </footer>
    </main>
  );
}
