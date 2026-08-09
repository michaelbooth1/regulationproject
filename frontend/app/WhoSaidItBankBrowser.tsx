"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { HOST_ORDER, HOST_PROFILES, type HostId } from "./quiz-data";
import { WHO_SAID_IT_BANK, type QuoteDifficulty } from "./who-said-it-data";


type HostFilter = "all" | HostId;
type DifficultyFilter = "all" | QuoteDifficulty;

function HostBadge({ host }: { host: HostId }) {
  const profile = HOST_PROFILES[host];
  return (
    <span className="wsi-host-badge" style={{ "--host-color": profile.color } as React.CSSProperties}>
      <b>{profile.name.slice(0, 1)}</b>{profile.name}
    </span>
  );
}

export default function WhoSaidItBankBrowser({ mappedEpisodes }: { mappedEpisodes: number }) {
  const [query, setQuery] = useState("");
  const [host, setHost] = useState<HostFilter>("all");
  const [difficulty, setDifficulty] = useState<DifficultyFilter>("all");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return WHO_SAID_IT_BANK.filter((item) => {
      const matchesHost = host === "all" || item.speaker === host;
      const matchesDifficulty = difficulty === "all" || item.difficulty === difficulty;
      const haystack = [item.quote, item.title, item.topic, item.context, HOST_PROFILES[item.speaker].name]
        .join(" ")
        .toLowerCase();
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
        <Link className="wordmark" href="/" aria-label="Regulation games home">
          <span className="wordmark-r">R</span>
          <span>Regulation<br /><strong>Games</strong></span>
        </Link>
        <nav className="topbar-tools" aria-label="Game navigation">
          <Link className="bank-link" href="/">Host quiz</Link>
          <Link className="bank-link" href="/who-said-it">Play game</Link>
          <Link className="bank-link active" href="/who-said-it/bank" aria-current="page">Quote bank</Link>
          <div className="corpus-stamp"><span aria-hidden="true" />{mappedEpisodes} episodes digested</div>
        </nav>
      </header>

      <section className="bank-hero wsi-bank-hero">
        <div>
          <p className="kicker">Spoilers / primary evidence</p>
          <h1>Quote<br /><span>Bank</span></h1>
        </div>
        <div className="bank-intro">
          <strong>All {WHO_SAID_IT_BANK.length} absurd lines, fully attributed.</strong>
          <p>
            These were manually curated after ranking mapped transcript lines for
            quotable length, archive-specific language, absurd premises, and specificity.
            Every card includes its episode and timestamp.
          </p>
          <Link className="secondary-button bank-home-link" href="/who-said-it">← Play without spoilers</Link>
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
            <button type="button" className={host === "all" ? "active" : ""} onClick={() => setHost("all")}>All hosts</button>
            {HOST_ORDER.map((hostId) => (
              <button type="button" key={hostId} className={host === hostId ? "active" : ""} onClick={() => setHost(hostId)}>
                {HOST_PROFILES[hostId].name}
              </button>
            ))}
          </div>
          <div className="category-filters" aria-label="Filter by difficulty">
            {(["all", "easy", "medium", "hard"] as const).map((level) => (
              <button type="button" key={level} className={difficulty === level ? "active" : ""} onClick={() => setDifficulty(level)}>
                {level === "all" ? "Any difficulty" : level}
              </button>
            ))}
          </div>
        </div>
        <p className="bank-count" aria-live="polite">Showing <strong>{visible.length}</strong> of {WHO_SAID_IT_BANK.length} quotes</p>
      </section>

      <section className="wsi-bank-list" aria-label="Who Said It quote bank">
        {visible.map((item) => {
          const profile = HOST_PROFILES[item.speaker];
          const bankIndex = WHO_SAID_IT_BANK.findIndex((quote) => quote.id === item.id) + 1;
          return (
            <article
              className="wsi-bank-card"
              key={item.id}
              style={{ "--host-color": profile.color, "--host-pale": profile.pale } as React.CSSProperties}
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
                <small>{item.published} · {Math.floor(item.startSec / 60)}:{String(Math.floor(item.startSec % 60)).padStart(2, "0")}</small>
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
        <p>{WHO_SAID_IT_BANK.length} quotes / 30 episodes / 4 fully mapped hosts.</p>
        <p>Transcript excerpts are lightly trimmed for readability.</p>
      </footer>
    </main>
  );
}
