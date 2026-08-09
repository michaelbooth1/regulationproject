"use client";

import { useMemo, useState } from "react";
import {
  HOST_ORDER,
  HOST_PROFILES,
  QUESTION_BANK,
  type HostId,
  type QuizOption,
  type QuizQuestion,
} from "./quiz-data";


const QUIZ_LENGTH = 10;

type Stage = "intro" | "quiz" | "result";
type Answers = Record<string, string>;

function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

function pickQuiz(): QuizQuestion[] {
  const byCategory = new Map<string, QuizQuestion[]>();
  for (const question of QUESTION_BANK) {
    const categoryQuestions = byCategory.get(question.category) ?? [];
    categoryQuestions.push(question);
    byCategory.set(question.category, categoryQuestions);
  }

  return shuffle([...byCategory.keys()])
    .slice(0, QUIZ_LENGTH)
    .map((category) => {
      const question = shuffle(byCategory.get(category) ?? [])[0];
      return { ...question, options: shuffle(question.options) };
    });
}

function scrollToTop() {
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function optionFor(question: QuizQuestion, optionId: string | undefined) {
  return question.options.find((option) => option.id === optionId);
}

function calculateResult(questions: QuizQuestion[], answers: Answers) {
  const scores = Object.fromEntries(HOST_ORDER.map((host) => [host, 0])) as Record<HostId, number>;
  const directAnswers = Object.fromEntries(HOST_ORDER.map((host) => [host, 0])) as Record<HostId, number>;
  const selected: Array<{ question: QuizQuestion; option: QuizOption }> = [];

  for (const question of questions) {
    const option = optionFor(question, answers[question.id]);
    if (!option) continue;
    selected.push({ question, option });
    const highest = Math.max(...Object.values(option.scores));
    for (const host of HOST_ORDER) {
      const value = option.scores[host] ?? 0;
      scores[host] += value;
      if (value === highest) directAnswers[host] += 1;
    }
  }

  const ranking = [...HOST_ORDER].sort((left, right) => {
    return (
      scores[right] - scores[left] ||
      directAnswers[right] - directAnswers[left] ||
      HOST_ORDER.indexOf(left) - HOST_ORDER.indexOf(right)
    );
  });
  const winner = ranking[0];
  const reasons = selected
    .filter(({ option }) => (option.scores[winner] ?? 0) > 0)
    .sort((left, right) => (right.option.scores[winner] ?? 0) - (left.option.scores[winner] ?? 0))
    .filter(
      ({ option }, index, all) =>
        all.findIndex((item) => item.option.trait === option.trait) === index,
    )
    .slice(0, 3);

  return { winner, ranking, scores, directAnswers, reasons };
}

function HostStamp({ host }: { host: HostId }) {
  const profile = HOST_PROFILES[host];
  return (
    <div className="host-stamp" style={{ "--host-color": profile.color } as React.CSSProperties}>
      <span>{profile.name.slice(0, 1)}</span>
      <div>
        <strong>{profile.name}</strong>
        <small>{profile.shortTitle}</small>
      </div>
    </div>
  );
}

export default function QuizApp({ mappedEpisodes }: { mappedEpisodes: number }) {
  const [stage, setStage] = useState<Stage>("intro");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Answers>({});
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentQuestion = questions[currentIndex];
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;
  const result = useMemo(
    () => calculateResult(questions, answers),
    [questions, answers],
  );

  function start() {
    setQuestions(pickQuiz());
    setAnswers({});
    setCurrentIndex(0);
    setStage("quiz");
    scrollToTop();
  }

  function choose(optionId: string) {
    if (!currentQuestion) return;
    setAnswers((existing) => ({ ...existing, [currentQuestion.id]: optionId }));
  }

  function next() {
    if (!currentAnswer) return;
    if (currentIndex === questions.length - 1) {
      setStage("result");
    } else {
      setCurrentIndex((index) => index + 1);
    }
    scrollToTop();
  }

  function back() {
    if (currentIndex > 0) {
      setCurrentIndex((index) => index - 1);
      scrollToTop();
    }
  }

  const topbar = (
    <header className="quiz-topbar">
      <button className="wordmark" type="button" onClick={() => setStage("intro")}>
        <span className="wordmark-r">R</span>
        <span>Regulation<br /><strong>Quiz</strong></span>
      </button>
      <div className="corpus-stamp">
        <span aria-hidden="true" />
        {mappedEpisodes} episodes digested
      </div>
    </header>
  );

  if (stage === "intro") {
    return (
      <main className="quiz-shell intro-shell">
        {topbar}
        <section className="intro-grid">
          <div className="intro-copy">
            <p className="kicker">Scientifically unnecessary</p>
            <h1>
              Which mic
              <span>are you?</span>
            </h1>
            <p className="intro-lede">
              Ten bad decisions will determine which Regulation host your
              particular style of conversational chaos resembles today.
            </p>
            <button className="primary-button" type="button" onClick={start}>
              Begin the investigation
              <span aria-hidden="true">→</span>
            </button>
            <p className="fine-print">
              Not a true personality test. Not medical advice. Barely advice.
            </p>
          </div>

          <aside className="case-file" aria-label="Quiz case file">
            <div className="case-file-heading">
              <span>Case file 01</span>
              <strong>Subject: you, unfortunately</strong>
            </div>
            <div className="host-stamps">
              {HOST_ORDER.map((host) => <HostStamp key={host} host={host} />)}
            </div>
            <dl className="case-facts">
              <div><dt>Question bank</dt><dd>{QUESTION_BANK.length}</dd></div>
              <div><dt>Questions served</dt><dd>{QUIZ_LENGTH}</dd></div>
              <div><dt>Possible problems</dt><dd>4</dd></div>
            </dl>
            <p className="case-note">
              Built from measured speaking patterns, recurring premises, and
              hundreds of hours of people taking a bit much too far.
            </p>
          </aside>
        </section>
        <div className="ticker" aria-hidden="true">
          <span>STORY INSTINCT</span><span>SCENARIO LOGIC</span><span>CURIOUS DAMAGE</span><span>REALITY CONTROL</span>
        </div>
      </main>
    );
  }

  if (stage === "quiz" && currentQuestion) {
    const progress = ((currentIndex + 1) / questions.length) * 100;
    return (
      <main className="quiz-shell question-shell">
        {topbar}
        <section className="question-layout" aria-live="polite">
          <div className="question-progress">
            <div className="progress-labels">
              <span>Question {String(currentIndex + 1).padStart(2, "0")}</span>
              <span>{questions.length} total</span>
            </div>
            <div className="progress-track" aria-hidden="true">
              <span style={{ width: `${progress}%` }} />
            </div>
            <p>{currentQuestion.category}</p>
          </div>

          <div className="question-card">
            <p className="question-number" aria-hidden="true">
              {String(currentIndex + 1).padStart(2, "0")}
            </p>
            <h1>{currentQuestion.prompt}</h1>
            <div className="answer-grid" role="radiogroup" aria-label="Answer choices">
              {currentQuestion.options.map((option, optionIndex) => {
                const selected = currentAnswer === option.id;
                return (
                  <button
                    className={`answer-card${selected ? " selected" : ""}`}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    key={option.id}
                    onClick={() => choose(option.id)}
                  >
                    <span className="answer-letter">{String.fromCharCode(65 + optionIndex)}</span>
                    <span className="answer-copy">{option.label}</span>
                    <span className="answer-check" aria-hidden="true">✓</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="question-controls">
            <button type="button" className="secondary-button" onClick={back} disabled={currentIndex === 0}>
              ← Back
            </button>
            <span>{Object.keys(answers).length} answered</span>
            <button type="button" className="primary-button compact" onClick={next} disabled={!currentAnswer}>
              {currentIndex === questions.length - 1 ? "File my result" : "Next question"}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </section>
      </main>
    );
  }

  const profile = HOST_PROFILES[result.winner];
  const leaderScore = Math.max(...Object.values(result.scores), 1);
  return (
    <main
      className="quiz-shell result-shell"
      style={
        {
          "--result-color": profile.color,
          "--result-pale": profile.pale,
        } as React.CSSProperties
      }
    >
      {topbar}
      <section className="result-hero">
        <div className="result-main">
          <p className="kicker">Analysis complete / dignity pending</p>
          <div className="result-lockup">
            <span className="result-initial" aria-hidden="true">{profile.name.slice(0, 1)}</span>
            <div>
              <p>You answered like</p>
              <h1>{profile.name}</h1>
            </div>
          </div>
          <h2>{profile.title}</h2>
          <p className="result-description">{profile.description}</p>
          <div className="result-actions">
            <button className="primary-button dark" type="button" onClick={start}>
              Generate ten new problems
              <span aria-hidden="true">↻</span>
            </button>
            <span>{result.directAnswers[result.winner]} direct {profile.name} answers</span>
          </div>
        </div>
        <aside className="result-receipt">
          <p>Transcript signal</p>
          <strong>{profile.shortTitle}</strong>
          <span>{profile.dataSignal}</span>
          <small>Descriptive corpus pattern, not psychological science.</small>
        </aside>
      </section>

      <section className="why-section" aria-labelledby="why-title">
        <div className="section-heading">
          <p>Evidence from your answers</p>
          <h2 id="why-title">Why you got {profile.name}</h2>
        </div>
        <div className="reason-grid">
          {result.reasons.map(({ question, option }, index) => (
            <article key={question.id}>
              <span>{String(index + 1).padStart(2, "0")} / {option.trait}</span>
              <strong>{option.insight}</strong>
              <p>{question.prompt}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="score-section" aria-labelledby="score-title">
        <div className="section-heading compact-heading">
          <p>Complete damage report</p>
          <h2 id="score-title">The other voices in your head</h2>
        </div>
        <div className="score-list">
          {result.ranking.map((host, index) => {
            const item = HOST_PROFILES[host];
            return (
              <div className="score-row" key={host} style={{ "--score-color": item.color } as React.CSSProperties}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{item.name}</strong>
                <div aria-label={`${item.name}: ${result.scores[host]} points`}>
                  <span style={{ width: `${(result.scores[host] / leaderScore) * 100}%` }} />
                </div>
                <b>{result.scores[host]} pts</b>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="quiz-footer">
        <p>Ten questions sampled from {QUESTION_BANK.length}. Retakes encouraged.</p>
        <p>Built from {mappedEpisodes} mapped episodes and several unnecessary definitions.</p>
      </footer>
    </main>
  );
}
