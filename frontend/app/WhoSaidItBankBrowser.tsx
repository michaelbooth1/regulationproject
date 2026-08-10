"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import { HostBadge } from "./HostBadge";
import { HOST_ORDER, HOST_PROFILES, type HostId } from "./quiz-data";
import {
  formatTranscriptTime,
  WHO_SAID_IT_BANK,
  type QuoteDifficulty,
} from "./who-said-it-data";


type HostFilter = "all" | HostId;
type DifficultyFilter = "all" | QuoteDifficulty;

const HOST_QUOTE_COUNTS = Object.fromEntries(
  HOST_ORDER.map((host) => [host, WHO_SAID_IT_BANK.filter((item) => item.speaker === host).length]),
) as Record<HostId, number>;
const DIFFICULTY_QUOTE_COUNTS = Object.fromEntries(
  (["easy", "medium", "hard"] as QuoteDifficulty[]).map((level) => [
    level,
    WHO_SAID_IT_BANK.filter((item) => item.difficulty === level).length,
  ]),
) as Record<QuoteDifficulty, number>;
const QUOTED_EPISODE_COUNT = new Set(WHO_SAID_IT_BANK.map((item) => item.episode)).size;
const QUOTE_NUMBER_BY_ID = new Map(
  WHO_SAID_IT_BANK.map((item, index) => [item.id, index + 1]),
);
const QUOTE_SEARCH_TEXT_BY_ID = new Map(
  WHO_SAID_IT_BANK.map((item) => [
    item.id,
    [item.quote, item.title, item.topic, item.context, HOST_PROFILES[item.speaker].name]
      .join(" ")
      .toLowerCase(),
  ]),
);

export default function WhoSaidItBankBrowser({ mappedEpisodes }: { mappedEpisodes: number }) {
  const [query, setQuery] = useState("");
  const [host, setHost] = useState<HostFilter>("all");
  const [difficulty, setDifficulty] = useState<DifficultyFilter>("all");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return WHO_SAID_IT_BANK.filter((item) => {
      const matchesHost = host === "all" || item.speaker === host;
      const matchesDifficulty = difficulty === "all" || item.difficulty === difficulty;
      const haystack = QUOTE_SEARCH_TEXT_BY_ID.get(item.id) ?? "";
      return matchesHost && matchesDifficulty && (!needle || haystack.includes(needle));
    });
  }, [difficulty, host, query]);

  function clear() {
    setQuery("");
    setHost("all");
    setDifficulty("all");
  }

  return (
    <main className="quiz-shell bank-shell wsi-bank-shell">
      <header className="quiz-topbar">
        <Link className="wordmark" href="/" aria-label="Regulation Who Said It home">
          <span className="regulation-brand-mark" aria-hidden="true" />
          <span className="regulation-lockup">
            <strong>regulation</strong>
            <small>who said it</small>
          </span>
        </Link>
        <nav className="topbar-tools" aria-label="Game navigation">
          <Link className="bank-link" href="/">Play game</Link>
          <Link className="bank-link active" href="/who-said-it/bank" aria-current="page">Quote bank</Link>
          <div className="corpus-stamp"><span aria-hidden="true" />{mappedEpisodes} episodes digested</div>
        </nav>
      </header>

      <section className="bank-hero wsi-bank-hero">
        <div>
          <p className="kicker">Regulation archive / spoilers ahead</p>
          <h1>Quote<br /><span>bank</span></h1>
        </div>
        <div className="bank-intro">
          <strong>All {WHO_SAID_IT_BANK.length} absurd lines, fully attributed.</strong>
          <p>
            These were manually curated after ranking mapped transcript lines for
            quotable length, archive-specific language, absurd premises, and specificity.
            Every card includes its episode and timestamp.
          </p>
          <Link className="secondary-button bank-home-link" href="/">← Play without spoilers</Link>
        </div>
      </section>

      <section className="bank-controls" aria-label="Quote bank filters">
        <label className="bank-search">
          <span>Search quotes, episodes, or context</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try: ham, toilet, egg, horse..."
          />
        </label>
        <div className="wsi-bank-filter-row">
          <div className="category-filters" aria-label="Filter by host">
            <button type="button" aria-pressed={host === "all"} className={host === "all" ? "active" : ""} onClick={() => setHost("all")}>All hosts</button>
            {HOST_ORDER.map((hostId) => (
              <button type="button" aria-pressed={host === hostId} key={hostId} className={host === hostId ? "active" : ""} onClick={() => setHost(hostId)}>
                {HOST_PROFILES[hostId].name} · {HOST_QUOTE_COUNTS[hostId]}
              </button>
            ))}
          </div>
          <div className="category-filters" aria-label="Filter by difficulty">
            {(["all", "easy", "medium", "hard"] as const).map((level) => (
              <button type="button" aria-pressed={difficulty === level} key={level} className={difficulty === level ? "active" : ""} onClick={() => setDifficulty(level)}>
                {level === "all" ? "Any difficulty" : `${level} · ${DIFFICULTY_QUOTE_COUNTS[level]}`}
              </button>
            ))}
          </div>
        </div>
        <p className="bank-count" aria-live="polite">Showing <strong>{visible.length}</strong> of {WHO_SAID_IT_BANK.length} quotes</p>
      </section>

      <section className="wsi-bank-list" aria-label="Regulation Who Said It quote bank">
        {visible.map((item) => {
          const profile = HOST_PROFILES[item.speaker];
          const bankIndex = QUOTE_NUMBER_BY_ID.get(item.id) ?? 0;
          return (
            <article
              className="wsi-bank-card"
              key={item.id}
              style={{ "--host-color": profile.color, "--host-pale": profile.pale } as CSSProperties}
            >
              <header>
                <span>Q{String(bankIndex).padStart(2, "0")}</span>
                <small>{item.difficulty} / {item.topic}</small>
              </header>
              <blockquote>“{item.quote}”</blockquote>
              <div className="wsi-bank-attribution">
                <HostBadge host={item.speaker} />
                <p>{item.context}</p>
              </div>
              <footer>
                <span>Episode {item.episode}</span>
                <strong>{item.title}</strong>
                <small>{item.published} · {formatTranscriptTime(item.startSec)}</small>
              </footer>
            </article>
          );
        })}
        {visible.length === 0 && (
          <div className="bank-empty">
            <strong>No quote survived that interrogation.</strong>
            <button type="button" onClick={clear}>Clear the investigation</button>
          </div>
        )}
      </section>

      <footer className="quiz-footer bank-footer">
        <p>{WHO_SAID_IT_BANK.length} quotes / {QUOTED_EPISODE_COUNT} episodes / 4 fully mapped hosts.</p>
        <p>
          Unofficial fan game · <a href="https://www.patreon.com/TheRegulationPod" target="_blank" rel="noreferrer">Visit the official podcast ↗</a>
        </p>
      </footer>
    </main>
  );
}
