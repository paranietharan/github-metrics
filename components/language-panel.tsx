"use client";
import useSWR from "swr";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import type { LanguageStats } from "@/lib/language";
import { languagePercentage } from "@/lib/language-svg";

async function fetchLanguages(url: string): Promise<LanguageStats> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Language statistics unavailable");
  return response.json();
}
export default function LanguagePanel({
  refreshSeconds,
}: {
  refreshSeconds: number;
}) {
  const { data, error, isLoading, mutate } = useSWR(
    "/api/language?format=json",
    fetchLanguages,
    {
      refreshInterval: refreshSeconds * 1000,
      dedupingInterval: refreshSeconds * 1000 - 1000,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
      keepPreviousData: true,
    },
  );
  const languages = data?.languages.slice(0, 5) || [];
  const circumference = 2 * Math.PI * 65;
  return (
    <section
      className="panel language-panel"
      aria-labelledby="language-heading"
    >
      <div className="panel-top">
        <div>
          <h2 id="language-heading">Most used languages</h2>
          <p>Across all public repositories</p>
        </div>
        <a
          href="/api/language"
          target="_blank"
          rel="noreferrer"
          aria-label="Preview language card"
        >
          <ArrowUpRight size={16} />
        </a>
      </div>
      <div className="language-donut">
        {languages.length ? (
          <svg
            viewBox="0 0 180 180"
            role="img"
            aria-label={`Top five languages by code bytes. ${languages.map((l) => `${l.name}: ${languagePercentage(l.percentage)}`).join(", ")}`}
          >
            <circle
              cx="90"
              cy="90"
              r="65"
              fill="none"
              stroke="var(--border)"
              strokeWidth="22"
            />
            {languages.map((l, index) => {
              const length = (l.percentage / 100) * circumference;
              const start = languages
                .slice(0, index)
                .reduce(
                  (sum, item) => sum + (item.percentage / 100) * circumference,
                  0,
                );
              return (
                <circle
                  key={l.name}
                  cx="90"
                  cy="90"
                  r="65"
                  fill="none"
                  stroke={l.color}
                  strokeWidth="22"
                  strokeDasharray={`${length} ${circumference}`}
                  strokeDashoffset={-start}
                  transform="rotate(-90 90 90)"
                />
              );
            })}
            <text
              x="90"
              y="89"
              textAnchor="middle"
              fill="var(--accent)"
              fontSize="25"
              fontWeight="600"
            >
              {Math.round(languages[0].percentage)}%
            </text>
            <text
              x="90"
              y="111"
              textAnchor="middle"
              fill="var(--muted)"
              fontSize="11"
              {...(languages[0].name.length > 14
                ? { textLength: 90, lengthAdjust: "spacingAndGlyphs" as const }
                : {})}
            >
              {languages[0].name}
            </text>
          </svg>
        ) : (
          <div
            className={`language-placeholder ${isLoading ? "skeleton" : ""}`}
          >
            {isLoading
              ? "Loading languages…"
              : error
                ? "Languages unavailable"
                : "No language data yet"}
          </div>
        )}
      </div>
      <ul className="language-list">
        {languages.map((l) => (
          <li key={l.name}>
            <span
              className="language-dot"
              style={{ backgroundColor: l.color }}
            />
            <span className="language-name">{l.name}</span>
            <span>{languagePercentage(l.percentage)}</span>
          </li>
        ))}
      </ul>
      {error && (
        <div className="language-error" role="status">
          <span>
            {data
              ? "Refresh delayed. Cached data shown."
              : "Unable to load language data."}
          </span>
          <button
            onClick={() => mutate()}
            aria-label="Retry language statistics"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      )}
      <p className="language-note">
        Top 5 · share of all code bytes
        <br />
        {data
          ? `${data.repositories} public repositories · forks included`
          : "Public repository languages"}
      </p>
    </section>
  );
}
