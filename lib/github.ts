import "server-only";
import { z } from "zod";
import { calculate, dateKey, shift, type Stats, type Day } from "./metrics";
const count = z.number().int().nonnegative();
const collection = z.object({
  totalCommitContributions: count,
  commitContributionsByRepository: z.array(
    z.object({
      contributions: z.object({
        pageInfo: z.object({ hasNextPage: z.boolean() }),
        nodes: z.array(
          z.object({ occurredAt: z.string().datetime(), commitCount: count }),
        ),
      }),
    }),
  ),
  contributionCalendar: z.object({
    weeks: z.array(
      z.object({
        contributionDays: z.array(
          z.object({
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            contributionCount: count,
          }),
        ),
      }),
    ),
  }),
});
const responseSchema = z.object({
  data: z.object({
    user: z
      .object({
        login: z.string(),
        name: z.string().nullable(),
        bio: z.string().nullable(),
        avatarUrl: z.string().url(),
        repositories: z.object({
          totalCount: count,
          nodes: z.array(
            z.object({ nameWithOwner: z.string(), url: z.string().url() }),
          ),
        }),
      })
      .catchall(z.unknown()),
  }),
});
export class GithubError extends Error {
  constructor(
    public status = 503,
    public retryAfter = 60,
  ) {
    super("GitHub data is temporarily unavailable.");
  }
}
export function checkResponse(response: Response) {
  if (response.ok) return;
  const limited =
    response.status === 429 ||
    (response.status === 403 &&
      (response.headers.get("x-ratelimit-remaining") === "0" ||
        response.headers.has("retry-after")));
  const reset = Number(response.headers.get("x-ratelimit-reset")) * 1000;
  throw new GithubError(
    limited ? 429 : 503,
    Math.min(
      3600,
      Math.max(
        60,
        Number(response.headers.get("retry-after")) ||
          Math.ceil((reset - Date.now()) / 1000) ||
          60,
      ),
    ),
  );
}
const fields = `totalCommitContributions commitContributionsByRepository(maxRepositories:100) { contributions(first:100) { pageInfo { hasNextPage } nodes { occurredAt commitCount } } } contributionCalendar { weeks { contributionDays { date contributionCount } } }`;
export async function loadGithub(): Promise<Stats> {
  const username = process.env.GITHUB_USERNAME || "paranietharan";
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(username) || !process.env.GITHUB_TOKEN)
    throw new GithubError();
  const now = new Date();
  const year = now.getUTCFullYear();
  const today = dateKey(now);
  // Disjoint periods avoid GitHub's one-year range limit.
  const periods: {
    alias: string;
    from: string;
    to: string;
  }[] = [];
  for (let y = year - 1; y <= year; y++)
    for (let month = 0; month < 12; month += 3) {
      const from = new Date(Date.UTC(y, month, 1));
      if (from > now) continue;
      const end = new Date(
        Math.min(now.getTime(), Date.UTC(y, month + 3, 1) - 1000),
      );
      periods.push({
        alias: `p${periods.length}`,
        from: from.toISOString(),
        to: end.toISOString(),
      });
    }
  const r = await fetch("https://api.github.com/graphql", {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(18000),
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `query($login:String!) { user(login:$login) { login name bio avatarUrl repositories(privacy:PUBLIC,first:4,orderBy:{field:UPDATED_AT,direction:DESC}) { totalCount nodes { nameWithOwner url } } ${periods.map((p) => `${p.alias}:contributionsCollection(from:"${p.from}",to:"${p.to}") { ${fields} }`).join(" ")} } }`,
      variables: { login: username },
    }),
  });
  checkResponse(r);
  const raw: unknown = await r.json();
  if (raw && typeof raw === "object" && "errors" in raw) {
    const errors = z
      .array(z.object({ type: z.string().optional() }))
      .safeParse(raw.errors);
    throw new GithubError(
      errors.success && errors.data.some((e) => e.type === "RATE_LIMITED")
        ? 429
        : 503,
    );
  }
  const parsed = responseSchema.safeParse(raw);
  if (!parsed.success) throw new GithubError();
  const u = parsed.data.data.user;
  const map = new Map<string, Day>();
  const commits = new Map<string, number>();
  for (const period of periods) {
    const result = collection.safeParse(u[period.alias]);
    if (!result.success) throw new GithubError();
    const c = result.data;
    let sum = 0;
    for (const repo of c.commitContributionsByRepository) {
      if (repo.contributions.pageInfo.hasNextPage) throw new GithubError();
      for (const node of repo.contributions.nodes) {
        const key = node.occurredAt.slice(0, 10);
        sum += node.commitCount;
        commits.set(key, (commits.get(key) || 0) + node.commitCount);
      }
    }
    // Never silently publish partial counts when repository caps truncate history.
    if (sum !== c.totalCommitContributions) throw new GithubError();
    for (const w of c.contributionCalendar.weeks)
      for (const d of w.contributionDays)
        if (
          d.date >= period.from.slice(0, 10) &&
          d.date <= period.to.slice(0, 10)
        )
          map.set(d.date, {
            date: d.date,
            contributions: d.contributionCount,
          });
  }
  const all = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  const commitDays = all.map((d) => ({
    date: d.date,
    contributions: commits.get(d.date) || 0,
  }));
  const metrics = calculate(commitDays, today);
  const earliest = `${year - 1}-01-01`;
  return {
    profile: {
      login: u.login,
      name: u.name || u.login,
      bio: u.bio || "",
      avatar: u.avatarUrl,
      repositories: u.repositories.totalCount,
    },
    commitDays: commitDays.filter(
      (d) => d.date >= shift(today, -370) && d.date <= today,
    ),
    days: all.filter((d) => d.date >= shift(today, -370) && d.date <= today),
    metrics: {
      ...metrics,
      streakBounded:
        shift(
          today,
          -(metrics.today > 0 ? metrics.streak - 1 : metrics.streak),
        ) === earliest,
    },
    repositories: u.repositories.nodes.map((r) => ({
      name: r.nameWithOwner,
      url: r.url,
    })),
    updatedAt: now.toISOString(),
    timezone: process.env.DISPLAY_TIMEZONE || "Asia/Colombo",
  };
}
