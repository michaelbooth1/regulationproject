import type { Metadata } from "next";
import Link from "next/link";
import SpeakerTimelineCharts, { type SpeakerTimeline } from "../SpeakerTimelineCharts";
import timeline from "../data/speaker-timeline.json";


export const metadata: Metadata = {
  title: "Who Gets the Mic? | Regulation Who Said It",
  description: "Transcript-derived charts showing how Geoff, Andrew, Gavin, and Eric's speaking time changed across 415 episodes.",
};


export default function SpeakerStatsPage() {
  const data = timeline as SpeakerTimeline;

  return (
    <main className="quiz-shell stats-shell">
      <header className="quiz-topbar">
        <Link className="wordmark" href="/" aria-label="Regulation Who Said It home">
          <span className="regulation-brand-mark" aria-hidden="true" />
          <span className="regulation-lockup">
            <strong>regulation</strong>
            <small>mic report</small>
          </span>
        </Link>
        <nav className="topbar-tools" aria-label="Site navigation">
          <Link className="bank-link" href="/">Play game</Link>
          <Link className="bank-link active" href="/stats" aria-current="page">Speaker stats</Link>
          <div className="corpus-stamp"><span aria-hidden="true" />{data.completedEpisodes} episodes digested</div>
        </nav>
      </header>

      <SpeakerTimelineCharts data={data} />

      <footer className="quiz-footer stats-footer">
        <p>Made by community member Michael Booth. Transcript measurements are approximate.</p>
        <p>
          <Link href="/">Play Regulation Who Said It →</Link>
          {" · "}
          <a href="https://www.patreon.com/TheRegulationPod" target="_blank" rel="noreferrer">Official podcast ↗</a>
        </p>
      </footer>
    </main>
  );
}
