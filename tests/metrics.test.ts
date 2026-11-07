import { test } from "node:test";
import assert from "node:assert/strict";
import { calculate, dateKey, shift, type Stats } from "../lib/metrics";
import { card, escapeXml, svgHeaders } from "../lib/svg";
import { checkResponse, GithubError, loadGithub } from "../lib/github";
import { avatarData } from "../lib/avatar";
const days = [
  { date: "2026-12-31", contributions: 5 },
  { date: "2027-01-01", contributions: 3 },
  { date: "2027-01-02", contributions: 2 },
];
test("daily, Monday weekly, yearly and active yesterday streak", () =>
  assert.deepEqual(calculate(days, "2027-01-02"), {
    today: 2,
    week: 10,
    year: 5,
    streak: 3,
  }));
test("empty activity and Monday boundary", () => {
  assert.equal(calculate([], "2027-01-04").streak, 0);
  assert.equal(calculate(days, "2027-01-04").week, 0);
});
test("timezone and leap boundaries", () => {
  assert.equal(
    dateKey(new Date("2026-01-01T20:00:00Z"), "Asia/Colombo"),
    "2026-01-02",
  );
  assert.equal(shift("2024-03-01", -1), "2024-02-29");
});
test("XML escapes hostile text", () =>
  assert.equal(escapeXml("<&>\"'"), "&lt;&amp;&gt;&quot;&apos;"));
const stats: Stats = {
  profile: {
    login: "test",
    name: "<script>",
    bio: "",
    avatar: "",
    repositories: 0,
  },
  days: [],
  metrics: { today: 0, week: 0, year: 0, streak: 0 },
  repositories: [],
  updatedAt: "2026-11-07T00:00:00Z",
  timezone: "UTC",
};
test("SVG dimensions, safe text, avatar fallback and headers", () => {
  const s = card(stats);
  assert.ok(s.includes("&lt;script&gt;"));
  assert.ok(s.includes(">T</text>"));
  assert.ok(s.includes('viewBox="0 0 760 160"'));
  assert.ok(!s.includes("<script>"));
  assert.equal(svgHeaders["Content-Type"], "image/svg+xml; charset=utf-8");
  assert.ok(svgHeaders["Cache-Control"].includes("s-maxage=60"));
  assert.ok(card(stats, { compact: true }).includes('height="136"'));
});
test("rate limits and API errors", () => {
  assert.throws(
    () =>
      checkResponse(
        new Response("", { status: 429, headers: { "retry-after": "120" } }),
      ),
    (e: unknown) =>
      e instanceof GithubError && e.status === 429 && e.retryAfter === 120,
  );
  assert.throws(
    () => checkResponse(new Response("", { status: 500 })),
    GithubError,
  );
});
test("untrusted avatar URLs never fetched", async () => {
  assert.equal(await avatarData("http://localhost/private"), undefined);
  assert.equal(
    await avatarData("https://avatars.githubusercontent.com.evil.test/x"),
    undefined,
  );
});
test("malformed GraphQL and GraphQL errors fail closed", async () => {
  const original = global.fetch;
  const token = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = "test";
  try {
    for (const body of [{}, { errors: [{ message: "private secret" }] }]) {
      global.fetch = async () => Response.json(body);
      await assert.rejects(loadGithub(), GithubError);
    }
  } finally {
    global.fetch = original;
    if (token) process.env.GITHUB_TOKEN = token;
    else delete process.env.GITHUB_TOKEN;
  }
});

test("quarter-sized requests normalize contribution calendars and public repository links", async () => {
  const original = global.fetch;
  const token = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = "test";
  try {
    global.fetch = async (_url, init) => {
      const query = JSON.parse(String(init?.body)).query as string;
      const aliases = [
        ...query.matchAll(
          /(p\d+):contributionsCollection\(from:"([^"]+)",to:"([^"]+)"\)/g,
        ),
      ];
      assert.ok(aliases.length >= 5);
      const user: Record<string, unknown> = {
        login: "test",
        name: "Test",
        bio: null,
        avatarUrl: "https://avatars.githubusercontent.com/u/1",
        repositories: {
          totalCount: 1,
          nodes: [
            {
              nameWithOwner: "test/public",
              url: "https://github.com/test/public",
            },
          ],
        },
      };
      for (const [, alias, from, to] of aliases) {
        assert.ok((Date.parse(to) - Date.parse(from)) / 86400000 < 100);
        const date = from.slice(0, 10);
        user[alias] = {
          totalCommitContributions: 2,
          commitContributionsByRepository: [
            {
              contributions: {
                pageInfo: { hasNextPage: false },
                nodes: [{ occurredAt: date + "T12:00:00Z", commitCount: 2 }],
              },
            },
          ],
          contributionCalendar: {
            weeks: [{ contributionDays: [{ date, contributionCount: 2 }] }],
          },
        };
      }
      return Response.json({ data: { user } });
    };
    const stats = await loadGithub();
    assert.equal(stats.profile.login, "test");
    assert.ok(stats.metrics.year >= 2);
    assert.equal(stats.repositories[0].name, "test/public");
  } finally {
    global.fetch = original;
    if (token) process.env.GITHUB_TOKEN = token;
    else delete process.env.GITHUB_TOKEN;
  }
});

test("the default card uses contribution counts and full names", () => {
  const different = {
    ...stats,
    profile: { ...stats.profile, name: "Paranietharan Palasuntharam" },
    metrics: { today: 49, week: 73, year: 454, streak: 3 },
  };
  const svg = card(different);
  assert.ok(svg.includes(">Paranietharan</text>"));
  assert.ok(svg.includes(">Palasuntharam</text>"));
  assert.ok(svg.includes(">454</text>"));
  assert.ok(svg.includes("Qualifying commit contributions visible"));
  assert.ok(!svg.includes("public commits"));
});

test("long names and handles fit the identity area without losing accessible text", () => {
  const name = "W".repeat(80);
  const svg = card({
    ...stats,
    profile: { ...stats.profile, name, login: "a".repeat(39) },
  });
  assert.ok(svg.includes(`<title id="title">${name}`));
  assert.ok(svg.includes('textLength="192" lengthAdjust="spacingAndGlyphs"'));
});

test("SVG endpoint rejects arbitrary usernames and returns safe fallback headers", async () => {
  const { GET } = await import("../app/api/card/route");
  const invalid = await GET(
    new Request("https://example.test/api/card?username=other"),
  );
  assert.equal(invalid.status, 400);
});

test("avatar signature validation rejects mislabeled content", async () => {
  const original = global.fetch;
  try {
    global.fetch = async () =>
      new Response("<svg>unsafe</svg>", {
        headers: { "content-type": "image/png" },
      });
    assert.equal(
      await avatarData("https://avatars.githubusercontent.com/u/1"),
      undefined,
    );
  } finally {
    global.fetch = original;
  }
});
