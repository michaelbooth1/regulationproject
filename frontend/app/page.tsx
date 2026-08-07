import type { Metadata } from "next";
import SpeakerChart from "./SpeakerChart";
import stats from "./data/speaker-stats.json";

export const metadata: Metadata = {
  title: "Who Owns the Mic? | Regulation Stats",
  description:
    "A playful look at estimated speaker time across The Regulation Podcast archive.",
};

export default function Home() {
  const namedTalkHours = stats.speakers
    .filter((speaker) => speaker.name !== "Other voices")
    .reduce((total, speaker) => total + speaker.hours, 0);
  const namedShare = Math.round((namedTalkHours / stats.measuredTalkHours) * 100);

  return (
    <main className="site-shell">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />

      <header className="topbar">
        <a className="brand" href="#top" aria-label="Regulation Stats home">
          <span className="brand-mark">R</span>
          <span>
            Regulation
            <strong>Stats</strong>
          </span>
        </a>
        <div className="snapshot-pill">
          <span className="live-dot" aria-hidden="true" />
          Snapshot · {stats.completedEpisodes} episodes
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">The unofficial mic-time scoreboard</p>
          <h1>
            Who owns
            <span>the mic?</span>
          </h1>
          <p className="lede">
            We measured every diarized segment in the completed archive to see
            who has spent the most time filling your headphones.
          </p>

          <div className="hero-stats" aria-label="Archive summary">
            <div>
              <strong>{stats.episodeHours}</strong>
              <span>episode hours</span>
            </div>
            <div>
              <strong>{stats.measuredTalkHours}</strong>
              <span>hours measured</span>
            </div>
            <div>
              <strong>{namedShare}%</strong>
              <span>named voices</span>
            </div>
          </div>
        </div>

        <aside className="leader-card" aria-label="Current mic-time leader">
          <span className="leader-kicker">Current mic hog</span>
          <div className="leader-orbit" aria-hidden="true">
            <span>1</span>
          </div>
          <strong>{stats.speakers[0].name}</strong>
          <p>{stats.speakers[0].hours} hours and counting</p>
        </aside>
      </section>

      <section className="chart-section" aria-labelledby="chart-title">
        <div className="chart-heading">
          <div>
            <p className="section-number">01 / Speaker time</p>
            <h2 id="chart-title">The talk table</h2>
          </div>
          <p>
            Estimated from transcript segment lengths, matched across episodes
            using voice embeddings.
          </p>
        </div>

        <SpeakerChart speakers={stats.speakers} />
      </section>

      <footer>
        <p>{stats.method}</p>
        <p>Built from {stats.completedEpisodes} completed local transcripts.</p>
      </footer>
    </main>
  );
}
