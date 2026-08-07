"use client";

import { useState, type CSSProperties } from "react";

type Speaker = {
  name: string;
  seconds: number;
  hours: number;
  episodes: number;
  share: number;
  color: string;
};

type ChartStyle = CSSProperties & {
  "--bar-color": string;
  "--bar-width": string;
  "--delay": string;
};

export default function SpeakerChart({ speakers }: { speakers: Speaker[] }) {
  const [view, setView] = useState<"hours" | "share">("hours");
  const maxValue = Math.max(...speakers.map((speaker) => speaker[view]));

  return (
    <div className="chart-card">
      <div className="chart-toolbar">
        <span>Ranked by total measured time</span>
        <div className="segmented-control" aria-label="Chart units">
          <button
            type="button"
            className={view === "hours" ? "active" : ""}
            aria-pressed={view === "hours"}
            onClick={() => setView("hours")}
          >
            Hours
          </button>
          <button
            type="button"
            className={view === "share" ? "active" : ""}
            aria-pressed={view === "share"}
            onClick={() => setView("share")}
          >
            Share
          </button>
        </div>
      </div>

      <ol className="bar-list">
        {speakers.map((speaker, index) => {
          const value = speaker[view];
          const width = `${Math.max(3, (value / maxValue) * 100)}%`;
          const metric = view === "hours" ? `${speaker.hours}h` : `${speaker.share}%`;
          const style: ChartStyle = {
            "--bar-color": speaker.color,
            "--bar-width": width,
            "--delay": `${index * 70}ms`,
          };

          return (
            <li key={speaker.name} style={style}>
              <div className="bar-meta">
                <span className="rank">{String(index + 1).padStart(2, "0")}</span>
                <span className="speaker-swatch" aria-hidden="true" />
                <strong>{speaker.name}</strong>
                <span className="episode-count">{speaker.episodes} eps</span>
                <span className="metric">{metric}</span>
              </div>
              <div
                className="bar-track"
                role="img"
                aria-label={`${speaker.name}: ${speaker.hours} hours, ${speaker.share} percent of measured speaker time`}
              >
                <span className="bar-fill">
                  <span className="bar-shine" aria-hidden="true" />
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
