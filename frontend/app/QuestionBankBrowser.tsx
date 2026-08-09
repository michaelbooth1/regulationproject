"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  HOST_ORDER,
  HOST_PROFILES,
  QUESTION_BANK,
  type HostId,
  type QuizOption,
} from "./quiz-data";


const CATEGORIES = [
  "All",
  ...Array.from(new Set(QUESTION_BANK.map((question) => question.category))),
];

function primaryAnswer(options: QuizOption[], host: HostId) {
  return options.find((option) => {
    const highest = Math.max(...Object.values(option.scores));
    return option.scores[host] === highest;
  });
}

function secondaryHosts(option: QuizOption, primaryHost: HostId) {
  return HOST_ORDER.filter(
    (host) => host !== primaryHost && (option.scores[host] ?? 0) > 0,
  );
}

export default function QuestionBankBrowser({ mappedEpisodes }: { mappedEpisodes: number }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const visibleQuestions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return QUESTION_BANK.filter((question) => {
      const matchesCategory = category === "All" || question.category === category;
      const haystack = [
        question.prompt,
        question.category,
        ...question.options.flatMap((option) => [option.label, option.trait, option.insight]),
      ]
        .join(" ")
        .toLowerCase();
      return matchesCategory && (!needle || haystack.includes(needle));
    });
  }, [category, query]);

  return (
    <main className="quiz-shell bank-shell">
      <header className="quiz-topbar">
        <Link className="wordmark" href="/" aria-label="Back to Regulation Quiz">
          <span className="wordmark-r">R</span>
          <span>Regulation<br /><strong>Quiz</strong></span>
        </Link>
        <div className="topbar-tools">
          <Link className="bank-link" href="/who-said-it">Who said it?</Link>
          <Link className="bank-link active" href="/questions" aria-current="page">Question bank</Link>
          <div className="corpus-stamp">
            <span aria-hidden="true" />
            {mappedEpisodes} episodes digested
          </div>
        </div>
      </header>

      <section className="bank-hero">
        <div>
          <p className="kicker">For official overthinking</p>
          <h1>Question<br /><span>Bank</span></h1>
        </div>
        <div className="bank-intro">
          <strong>All {QUESTION_BANK.length} bad decisions, fully disclosed.</strong>
          <p>
            Every question has one primary answer for Geoff, Andrew, Gavin, and
            Eric. Secondary signals are shown where an answer contains a little
            extra flavor of somebody else&apos;s chaos.
          </p>
          <Link className="secondary-button bank-home-link" href="/">← Take the quiz</Link>
        </div>
      </section>

      <section className="bank-controls" aria-label="Question bank filters">
        <label className="bank-search">
          <span>Search prompts, answers, or traits</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try: bean hole, premise, bathtub..."
          />
        </label>
        <div className="category-filters" aria-label="Filter by category">
          {CATEGORIES.map((item) => (
            <button
              type="button"
              key={item}
              className={category === item ? "active" : ""}
              aria-pressed={category === item}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <p className="bank-count" aria-live="polite">
          Showing <strong>{visibleQuestions.length}</strong> of {QUESTION_BANK.length} questions
        </p>
      </section>

      <section className="bank-list" aria-label="Question bank">
        {visibleQuestions.map((question) => {
          const bankNumber = QUESTION_BANK.findIndex((item) => item.id === question.id) + 1;
          return (
            <article className="bank-question" key={question.id}>
              <header>
                <div>
                  <span>Q{String(bankNumber).padStart(2, "0")}</span>
                  <small>{question.category}</small>
                </div>
                <h2>{question.prompt}</h2>
              </header>
              <div className="host-answer-grid">
                {HOST_ORDER.map((host) => {
                  const profile = HOST_PROFILES[host];
                  const option = primaryAnswer(question.options, host);
                  if (!option) return null;
                  const secondary = secondaryHosts(option, host);
                  return (
                    <section
                      className="host-answer"
                      key={host}
                      style={{ "--host-color": profile.color, "--host-pale": profile.pale } as React.CSSProperties}
                      aria-label={`${profile.name} answer`}
                    >
                      <div className="host-answer-heading">
                        <span>{profile.name.slice(0, 1)}</span>
                        <div>
                          <strong>{profile.name}</strong>
                          <small>+{option.scores[host]} / {option.trait}</small>
                        </div>
                      </div>
                      <p className="host-answer-copy">{option.label}</p>
                      <p className="host-answer-insight">{option.insight}</p>
                      {secondary.length > 0 && (
                        <p className="secondary-signal">
                          Also +{secondary.map((item) => option.scores[item]).join(" / +")} {secondary.map((item) => HOST_PROFILES[item].name).join(" / ")}
                        </p>
                      )}
                    </section>
                  );
                })}
              </div>
            </article>
          );
        })}

        {visibleQuestions.length === 0 && (
          <div className="bank-empty">
            <strong>No regulation question matches that evidence.</strong>
            <button type="button" onClick={() => { setQuery(""); setCategory("All"); }}>
              Clear the investigation
            </button>
          </div>
        )}
      </section>

      <footer className="quiz-footer bank-footer">
        <p>{QUESTION_BANK.length} questions / {CATEGORIES.length - 1} balanced categories / 4 answers each.</p>
        <p>Scoring reference for comedy purposes only.</p>
      </footer>
    </main>
  );
}
