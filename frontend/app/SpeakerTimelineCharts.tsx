"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";


export type HostName = "Geoff" | "Andrew" | "Gavin" | "Eric";

type HostMetric = {
  minutesPerEpisode: number;
  share: number;
};

type TimelineWindow = {
  startIndex: number;
  endIndex: number;
  startDate: string;
  endDate: string;
  episodeCount: number;
  hosts: Record<HostName, HostMetric>;
};

export type SpeakerTimeline = {
  completedEpisodes: number;
  windowSize: number;
  method: string;
  first100: Record<HostName, HostMetric>;
  latest100: Record<HostName, HostMetric>;
  windows: TimelineWindow[];
};

const HOSTS: Array<{ name: HostName; color: string }> = [
  { name: "Geoff", color: "var(--orange)" },
  { name: "Andrew", color: "var(--yellow)" },
  { name: "Gavin", color: "var(--blue)" },
  { name: "Eric", color: "var(--purple)" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];


function shortDate(value: string) {
  const [year, month] = value.split("-").map(Number);
  return `${MONTHS[month - 1]} ${year}`;
}


function useMeasuredWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setWidth(Math.max(300, Math.round(element.getBoundingClientRect().width)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}


function linePath(values: number[], x: (index: number) => number, y: (value: number) => number) {
  return values.map((value, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
}


function areaPath(
  lower: number[],
  upper: number[],
  x: (index: number) => number,
  y: (value: number) => number,
) {
  const top = upper.map((value, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(value).toFixed(1)}`);
  const bottom = lower
    .map((value, index) => ({ value, index }))
    .reverse()
    .map(({ value, index }) => `L${x(index).toFixed(1)},${y(value).toFixed(1)}`);
  return [...top, ...bottom, "Z"].join(" ");
}


function yearTicks(windows: TimelineWindow[], compact: boolean) {
  const firstForYear = new Map<number, number>();
  windows.forEach((window, index) => {
    const year = Number(window.startDate.slice(0, 4));
    if (!firstForYear.has(year)) firstForYear.set(year, index);
  });
  return [...firstForYear.entries()].filter(([year]) => !compact || year % 2 === 0);
}


function ShareAreaChart({
  windows,
  selectedIndex,
  onSelect,
}: {
  windows: TimelineWindow[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const { ref, width } = useMeasuredWidth();
  const compact = width < 560;
  const height = compact ? 360 : 430;
  const margin = { top: 22, right: 20, bottom: 48, left: compact ? 48 : 60 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const x = (index: number) => margin.left + (index / (windows.length - 1)) * plotWidth;
  const y = (value: number) => margin.top + (1 - value / 100) * plotHeight;
  const layers: Array<{ host: HostName; lower: number[]; upper: number[]; color: string }> = [];
  let lower = windows.map(() => 0);

  HOSTS.forEach(({ name, color }) => {
    const upper = windows.map((window, index) => lower[index] + window.hosts[name].share);
    layers.push({ host: name, lower, upper, color });
    lower = upper;
  });

  function chooseFromPointer(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const localX = ((event.clientX - bounds.left) / bounds.width) * width;
    const ratio = Math.max(0, Math.min(1, (localX - margin.left) / plotWidth));
    onSelect(Math.round(ratio * (windows.length - 1)));
  }

  return (
    <div className="stats-chart-canvas" ref={ref}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Stacked area chart showing each host's share of main-host speaking time across the archive"
        onPointerMove={chooseFromPointer}
        onPointerDown={chooseFromPointer}
      >
        <rect className="stats-plot-frame" x={margin.left} y={margin.top} width={plotWidth} height={plotHeight} />
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <line className="stats-grid-line" x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} />
            <text className="stats-axis-label" x={margin.left - 9} y={y(tick) + 4} textAnchor="end">{tick}%</text>
          </g>
        ))}
        {layers.map((layer) => (
          <path
            className="stats-area"
            key={layer.host}
            d={areaPath(layer.lower, layer.upper, x, y)}
            fill={layer.color}
          />
        ))}
        {yearTicks(windows, compact).map(([year, index]) => (
          <g key={year}>
            <line className="stats-year-tick" x1={x(index)} x2={x(index)} y1={height - margin.bottom} y2={height - margin.bottom + 6} />
            <text className="stats-axis-label" x={x(index)} y={height - 18} textAnchor="middle">{year}</text>
          </g>
        ))}
        <line className="stats-crosshair" x1={x(selectedIndex)} x2={x(selectedIndex)} y1={margin.top} y2={height - margin.bottom} />
        {layers.map((layer) => {
          const midpoint = (layer.lower[selectedIndex] + layer.upper[selectedIndex]) / 2;
          return <circle key={layer.host} className="stats-area-marker" cx={x(selectedIndex)} cy={y(midpoint)} r={4.5} fill={layer.color} />;
        })}
        <text className="stats-axis-title" x={(margin.left + width - margin.right) / 2} y={height - 2} textAnchor="middle">Archive publication year</text>
      </svg>
    </div>
  );
}


function MinutesLineChart({
  windows,
  selectedIndex,
  onSelect,
}: {
  windows: TimelineWindow[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const { ref, width } = useMeasuredWidth();
  const compact = width < 560;
  const height = compact ? 360 : 430;
  const margin = { top: 22, right: 20, bottom: 48, left: compact ? 48 : 60 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxValue = Math.ceil(Math.max(...windows.flatMap((window) => HOSTS.map(({ name }) => window.hosts[name].minutesPerEpisode))) / 5) * 5;
  const x = (index: number) => margin.left + (index / (windows.length - 1)) * plotWidth;
  const y = (value: number) => margin.top + (1 - value / maxValue) * plotHeight;
  const ticks = Array.from({ length: maxValue / 5 + 1 }, (_, index) => index * 5);

  function chooseFromPointer(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const localX = ((event.clientX - bounds.left) / bounds.width) * width;
    const ratio = Math.max(0, Math.min(1, (localX - margin.left) / plotWidth));
    onSelect(Math.round(ratio * (windows.length - 1)));
  }

  return (
    <div className="stats-chart-canvas" ref={ref}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Line chart showing average minutes spoken by each host per episode across the archive"
        onPointerMove={chooseFromPointer}
        onPointerDown={chooseFromPointer}
      >
        <rect className="stats-plot-frame" x={margin.left} y={margin.top} width={plotWidth} height={plotHeight} />
        {ticks.map((tick) => (
          <g key={tick}>
            <line className="stats-grid-line" x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} />
            <text className="stats-axis-label" x={margin.left - 9} y={y(tick) + 4} textAnchor="end">{tick}</text>
          </g>
        ))}
        {HOSTS.map(({ name, color }) => {
          const values = windows.map((window) => window.hosts[name].minutesPerEpisode);
          return (
            <g key={name}>
              <path className="stats-line" d={linePath(values, x, y)} stroke={color} />
              <circle className="stats-line-marker" cx={x(selectedIndex)} cy={y(values[selectedIndex])} r={6} fill={color} />
            </g>
          );
        })}
        {yearTicks(windows, compact).map(([year, index]) => (
          <g key={year}>
            <line className="stats-year-tick" x1={x(index)} x2={x(index)} y1={height - margin.bottom} y2={height - margin.bottom + 6} />
            <text className="stats-axis-label" x={x(index)} y={height - 18} textAnchor="middle">{year}</text>
          </g>
        ))}
        <line className="stats-crosshair" x1={x(selectedIndex)} x2={x(selectedIndex)} y1={margin.top} y2={height - margin.bottom} />
        <text className="stats-axis-title" x={(margin.left + width - margin.right) / 2} y={height - 2} textAnchor="middle">Archive publication year</text>
      </svg>
    </div>
  );
}


export default function SpeakerTimelineCharts({ data }: { data: SpeakerTimeline }) {
  const [selectedIndex, setSelectedIndex] = useState(data.windows.length - 1);
  const selected = data.windows[selectedIndex];
  const ericGrowth = data.latest100.Eric.share / data.first100.Eric.share;
  const readout = useMemo(() => HOSTS.map(({ name, color }) => ({ name, color, ...selected.hosts[name] })), [selected]);

  return (
    <>
      <section className="stats-hero">
        <div className="stats-hero-copy">
          <p className="kicker">Transcript lab / exhibit 002</p>
          <h1>who gets<br />the mic?</h1>
          <p>
            A speaking-time autopsy of {data.completedEpisodes} completed episodes—measured in
            twenty-episode chunks so the long-term cast shift is impossible to miss.
          </p>
        </div>
        <aside className="stats-eric-file" aria-label="Eric speaking-time finding">
          <span>Primary finding / Eric Baudour</span>
          <strong><b>{data.first100.Eric.share.toFixed(1)}%</b><i>→</i>{data.latest100.Eric.share.toFixed(1)}%</strong>
          <p>of main-host speech, first 100 episodes versus latest 100.</p>
          <div><b>{ericGrowth.toFixed(1)}×</b><span>larger share<br />of the room</span></div>
        </aside>
      </section>

      <section className="stats-report" aria-labelledby="stats-report-heading">
        <header className="stats-report-heading">
          <div>
            <p className="kicker">415 files / four recurring suspects</p>
            <h2 id="stats-report-heading">The room changed.</h2>
          </div>
          <p>
            Eric’s rise is visible both as a share of the group and in raw minutes, so it is not
            simply the result of episodes getting longer.
          </p>
        </header>

        <div className="stats-legend" aria-label="Host colors">
          {HOSTS.map(({ name, color }) => (
            <span key={name} style={{ "--host-color": color } as CSSProperties}>
              <b>{name.slice(0, 1)}</b>{name}
            </span>
          ))}
        </div>

        <div className="stats-scrubber-block">
          <div className="stats-window-label">
            <span>Archive window</span>
            <strong>Episodes {selected.startIndex}–{selected.endIndex}</strong>
            <small>{shortDate(selected.startDate)}–{shortDate(selected.endDate)}</small>
          </div>
          <input
            className="stats-scrubber"
            type="range"
            min="0"
            max={data.windows.length - 1}
            value={selectedIndex}
            onChange={(event) => setSelectedIndex(Number(event.target.value))}
            aria-label="Choose an archive window"
          />
          <div className="stats-window-values" aria-live="polite">
            {readout.map(({ name, color, share, minutesPerEpisode }) => (
              <div key={name} style={{ "--host-color": color } as CSSProperties}>
                <span>{name}</span>
                <strong>{share.toFixed(1)}%</strong>
                <small>{minutesPerEpisode.toFixed(1)} min/episode</small>
              </div>
            ))}
          </div>
        </div>

        <article className="stats-chart-sheet">
          <header>
            <div><span>Chart 01</span><strong>Share of the conversation</strong></div>
            <p>Main four hosts total 100% in every window.</p>
          </header>
          <ShareAreaChart windows={data.windows} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />
        </article>

        <article className="stats-chart-sheet">
          <header>
            <div><span>Chart 02</span><strong>Minutes on mic</strong></div>
            <p>Average measured speech per episode.</p>
          </header>
          <MinutesLineChart windows={data.windows} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />
        </article>

        <section className="stats-era-shift" aria-labelledby="era-shift-heading">
          <header>
            <p className="kicker">First 100 vs latest 100</p>
            <h2 id="era-shift-heading">Then / now</h2>
          </header>
          <div>
            {HOSTS.map(({ name, color }) => {
              const early = data.first100[name].share;
              const latest = data.latest100[name].share;
              const delta = latest - early;
              return (
                <article key={name} style={{ "--host-color": color } as CSSProperties}>
                  <span><b>{name.slice(0, 1)}</b>{name}</span>
                  <div
                    className="stats-dumbbell"
                    style={{
                      "--range-start": `${(Math.min(early, latest) / 45) * 100}%`,
                      "--range-end": `${(Math.max(early, latest) / 45) * 100}%`,
                    } as CSSProperties}
                    aria-label={`${name}: ${early.toFixed(1)} percent early, ${latest.toFixed(1)} percent recently`}
                  >
                    <i style={{ left: `${(early / 45) * 100}%` }}><em>{early.toFixed(1)}</em></i>
                    <u style={{ left: `${(latest / 45) * 100}%` }}><em>{latest.toFixed(1)}</em></u>
                  </div>
                  <strong className={delta > 0 ? "positive" : "negative"}>{delta > 0 ? "+" : ""}{delta.toFixed(1)} pts</strong>
                </article>
              );
            })}
          </div>
        </section>

        <p className="stats-method">{data.method} Twenty-episode windows smooth individual-show noise.</p>
      </section>
    </>
  );
}
