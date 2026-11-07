"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import useSWR from "swr";
import {
  ArrowUpRight,
  Sun,
  Moon,
  Activity,
  Flame,
  CalendarDays,
  Code2,
  Copy,
  Check,
  RefreshCw,
  CircleHelp,
} from "lucide-react";
import { shift, type Stats } from "@/lib/metrics";
function Github({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 .8a11.2 11.2 0 0 0-3.54 21.83c.56.1.76-.24.76-.54v-2.09c-3.12.68-3.78-1.33-3.78-1.33-.51-1.3-1.24-1.64-1.24-1.64-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.93.1-.73.39-1.22.71-1.5-2.49-.28-5.11-1.25-5.11-5.54 0-1.23.44-2.23 1.16-3.02-.12-.28-.5-1.43.11-2.98 0 0 .94-.3 3.08 1.15A10.7 10.7 0 0 1 12 6.16c.95 0 1.9.13 2.79.38 2.14-1.45 3.08-1.15 3.08-1.15.61 1.55.23 2.7.11 2.98.72.79 1.16 1.79 1.16 3.02 0 4.3-2.63 5.26-5.13 5.54.4.35.76 1.03.76 2.08v3.08c0 .3.2.65.77.54A11.2 11.2 0 0 0 12 .8Z" />
    </svg>
  );
}
const fetcher = async (url: string): Promise<Stats> => {
  const r = await fetch(url);
  if (!r.ok) throw new Error("Unable to refresh statistics.");
  return r.json();
};
export default function Dashboard({
  username,
  source,
}: {
  username: string;
  source?: string;
}) {
  const { data, error, isLoading, mutate } = useSWR<Stats>(
    "/api/stats",
    fetcher,
    {
      refreshInterval: 15000,
      dedupingInterval: 14000,
      revalidateOnFocus: true,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
      keepPreviousData: true,
    },
  );
  const selectedMetrics = data?.metrics;
  const [light, setLight] = useState(false);
  const [range, setRange] = useState(30);
  const [copied, setCopied] = useState(false);
  const today =
    data?.updatedAt.slice(0, 10) || new Date().toISOString().slice(0, 10);
  const days = data?.days.filter((d) => d.date >= shift(today, -364)) || [];
  const chart =
    range === 365
      ? Array.from({ length: 12 }, (_, i) => {
          const d = new Date(today + "T12:00:00Z");
          d.setUTCMonth(d.getUTCMonth() - 11 + i, 1);
          const key = d.toISOString().slice(0, 7);
          return {
            date: key,
            contributions: (data?.days || [])
              .filter((x) => x.date.startsWith(key))
              .reduce((s, x) => s + x.contributions, 0),
          };
        })
      : data?.days.filter((d) => d.date >= shift(today, -range + 1)) || [];
  const max = Math.max(1, ...chart.map((d) => d.contributions));
  const metrics = [
    {
      label: "Contributions today",
      value: selectedMetrics?.today,
      caption: "GitHub contribution day",
      icon: Activity,
    },
    {
      label: "Contributions this week",
      value: selectedMetrics?.week,
      caption: "Monday → today",
      icon: CalendarDays,
    },
    {
      label: "Contributions this year",
      value: selectedMetrics?.year,
      caption: "January 1 → today",
      icon: Code2,
    },
    {
      label: "Contribution streak",
      value: selectedMetrics?.streak,
      caption: "Consecutive active days",
      icon: Flame,
    },
  ];
  return (
    <div className={light ? "app light" : "app"}>
      <header>
        <Link className="wordmark" href="/" aria-label="github-metrics home">
          <Github size={21} />
          <span>
            github<span className="muted">-metrics</span>
          </span>
          <span className="badge">PERSONAL ANALYTICS</span>
        </Link>
        <nav>
          {source && (
            <a href={source} target="_blank" rel="noreferrer">
              Source <ArrowUpRight size={14} />
            </a>
          )}
          <button
            className="icon-button"
            aria-label={light ? "Use dark theme" : "Use light theme"}
            onClick={() => setLight(!light)}
          >
            {light ? <Moon size={17} /> : <Sun size={17} />}
          </button>
        </nav>
      </header>
      <main>
        <div className="eyebrow">
          <span className="status-dot" /> THE DEVELOPER BEHIND THE CONTRIBUTIONS
        </div>
        <section className="profile">
          <div className="identity">
            {data ? (
              <Image
                unoptimized
                className="avatar"
                src={data.profile.avatar}
                alt={`${data.profile.name}'s avatar`}
                width="64"
                height="64"
              />
            ) : (
              <div className="avatar placeholder">
                <Github size={29} />
              </div>
            )}
            <div>
              <div className="name-line">
                <h1>{data?.profile.name || username}</h1>
                <a
                  className="profile-link"
                  href={`https://github.com/${data?.profile.login || username}`}
                  aria-label="Open GitHub profile"
                >
                  <ArrowUpRight size={19} />
                </a>
              </div>
              <a className="handle" href={`https://github.com/${username}`}>
                @{data?.profile.login || username}
              </a>
            </div>
          </div>
          <div className="updated">
            <span className="status-dot" />
            {data
              ? `${data.stale ? "Cached" : "Updated"} ${new Intl.DateTimeFormat("en", { timeZone: data.timezone, hour: "2-digit", minute: "2-digit" }).format(new Date(data.updatedAt))}`
              : "Waiting for GitHub"}
            <small>
              {data?.timezone || "Asia/Colombo"} · refreshes every 15s
            </small>
          </div>
        </section>
        <p className="bio">
          {data?.profile.bio ||
            "A closer look at the work, one contribution at a time."}
        </p>
        {error && (
          <div className="notice" role="status">
            {data
              ? "Refresh delayed. Showing the last successful snapshot."
              : "GitHub statistics are unavailable. Configure the server environment to connect your account."}
            <button onClick={() => mutate()}>
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        )}
        <div className="metric-controls">
          <span>All contribution types · GitHub dates (UTC)</span>
        </div>
        <section className="metrics" aria-label="Contribution statistics">
          {metrics.map(({ label, value, caption, icon: Icon }) => (
            <article className="metric" key={label}>
              <div className="metric-label">
                {label}
                <Icon size={16} />
              </div>
              <div className={`metric-value ${isLoading ? "skeleton" : ""}`}>
                {value?.toLocaleString() ?? "—"}
                {label.includes("streak") && selectedMetrics?.streakBounded
                  ? "+"
                  : ""}
                {label.includes("streak") && value !== undefined && (
                  <small>days</small>
                )}
              </div>
              <p>{caption}</p>
            </article>
          ))}
        </section>
        <div className="section-heading">
          <div>
            <h2>Contribution overview</h2>
            <p>Small steps. Consistent progress.</p>
          </div>
          <span className="pill">Last 12 months</span>
        </div>
        <section className="panel heatmap-panel">
          <div className="panel-top">
            <span>
              <strong>
                {data
                  ? days
                      .reduce((s, d) => s + d.contributions, 0)
                      .toLocaleString()
                  : "—"}
              </strong>{" "}
              contributions in the last year
            </span>
            <span className="muted tiny">All contribution types</span>
          </div>
          <div className="heatmap-scroll">
            <div className="months">
              {Array.from({ length: 12 }, (_, i) => {
                const d = new Date(today + "T12:00:00Z");
                d.setUTCMonth(d.getUTCMonth() - 11 + i, 1);
                return (
                  <span key={i}>
                    {d.toLocaleDateString("en", {
                      month: "short",
                      timeZone: "UTC",
                    })}
                  </span>
                );
              })}
            </div>
            <div className="heatmap" aria-label="Daily contribution calendar">
              {Array.from(
                {
                  length: new Date(
                    (days[0]?.date || today) + "T12:00:00Z",
                  ).getUTCDay(),
                },
                (_, i) => (
                  <span key={`blank${i}`} />
                ),
              )}
              {days.map((d) => (
                <button
                  key={d.date}
                  className={`cell level-${d.contributions === 0 ? 0 : d.contributions < 3 ? 1 : d.contributions < 7 ? 2 : d.contributions < 12 ? 3 : 4}`}
                  title={`${d.date}: ${d.contributions} contributions`}
                  aria-label={`${d.date}: ${d.contributions} contributions`}
                />
              ))}
              {!data &&
                Array.from({ length: 365 }, (_, i) => (
                  <span
                    className={`cell ${isLoading ? "skeleton" : ""}`}
                    key={i}
                  />
                ))}
            </div>
          </div>
          <div className="heatmap-footer">
            <span>
              <CircleHelp size={13} /> Contributions include commits, issues,
              pull requests & reviews.
            </span>
            <div className="legend">
              Less{" "}
              {[0, 1, 2, 3, 4].map((i) => (
                <i key={i} className={`cell level-${i}`} />
              ))}{" "}
              More
            </div>
          </div>
        </section>
        <div className="lower-grid">
          <section className="panel activity">
            <div className="panel-top">
              <div>
                <h2>Contribution activity</h2>
                <p>All contribution types · UTC dates</p>
              </div>
              <div className="segmented" aria-label="Activity period">
                {[7, 30, 365].map((n) => (
                  <button
                    key={n}
                    aria-pressed={range === n}
                    onClick={() => setRange(n)}
                  >
                    {n === 365 ? "12m" : `${n}d`}
                  </button>
                ))}
              </div>
            </div>
            <div
              className="chart"
              role="img"
              aria-label={`Contribution activity for the last ${range} days; ${chart.reduce((s, d) => s + d.contributions, 0)} contributions`}
            >
              <div className="chart-guide">
                <span>{max}</span>
                <span>{Math.round(max / 2)}</span>
                <span>0</span>
              </div>
              <div className="bars">
                {chart.map((d) => (
                  <div key={d.date} className="bar-slot">
                    <div
                      className="bar"
                      style={{
                        height: `${Math.max(1, (d.contributions / max) * 100)}%`,
                      }}
                      title={`${d.date}: ${d.contributions} contributions`}
                    />
                  </div>
                ))}
                {!data && (
                  <span className="chart-empty">
                    {isLoading
                      ? "Loading activity…"
                      : "Connect GitHub to see your activity"}
                  </span>
                )}
              </div>
            </div>
            <div className="chart-labels">
              <span>{chart[0]?.date || "Start of period"}</span>
              <span>{chart.at(-1)?.date || "Today"}</span>
            </div>
          </section>
          <section className="panel repositories">
            <div className="panel-top">
              <div>
                <h2>Where the work happens</h2>
                <p>Recently updated public repositories</p>
              </div>
              <Code2 size={17} />
            </div>
            {data?.repositories.length ? (
              data.repositories.map((r, i) => (
                <a className="repo-row" key={r.name} href={r.url}>
                  <span className="repo-number">0{i + 1}</span>
                  <span>
                    {r.name.split("/").at(-1)}
                    <small>{r.name.split("/")[0]}</small>
                  </span>
                  <ArrowUpRight size={14} />
                </a>
              ))
            ) : (
              <p className="empty">
                {isLoading
                  ? "Loading repositories…"
                  : "No public repositories available."}
              </p>
            )}
            <div className="repo-footer">
              <Github size={14} />
              <span>
                {data?.profile.repositories ?? "—"} public repositories
              </span>
            </div>
          </section>
        </div>
        <section className="embed panel">
          <div className="embed-icon">
            <Code2 size={23} />
          </div>
          <div>
            <h2>Your activity, wherever you build.</h2>
            <p>Add a live statistics card to your GitHub profile README.</p>
          </div>
          <a className="button secondary" href="/api/card" target="_blank">
            Preview card <ArrowUpRight size={14} />
          </a>
          <button
            className="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  `![GitHub Contribution Statistics](${location.origin}/api/card)`,
                );
                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}{" "}
            {copied ? "Copied" : "Copy Markdown"}
          </button>
        </section>
        <details className="definitions">
          <summary>How these numbers are calculated</summary>
          <p>
            Primary statistics sum GitHub’s daily contribution-calendar counts.
            The heatmap uses daily contribution-calendar counts, including
            commits, issues, pull requests, reviews, and any restricted counts
            returned by the API. Totals may differ from your signed-in GitHub
            profile because token visibility differs. Today, Monday–today, and
            January 1–today use UTC contribution dates. A contribution streak
            continues from yesterday when today has no contributions. History
            starts January 1 of the previous year; a + indicates a lower bound.
            The display timezone only controls the updated timestamp. Private
            repository details are never returned. GitHub may take time to
            register activity.
          </p>
        </details>
        <footer>
          <span>
            <Github size={14} /> github-metrics{" "}
            <span className="muted">/ Built on consistency.</span>
          </span>
          <span>GitHub contribution data · GitHub contribution days (UTC)</span>
        </footer>
      </main>
    </div>
  );
}
