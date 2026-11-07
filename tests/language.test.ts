import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateLanguages, languageRefreshSeconds } from "../lib/language";
import { languageCard, languagePercentage } from "../lib/language-svg";
import { loadLanguages } from "../lib/language-github";
import { createMemoryCache } from "../lib/memory-cache";
import { GithubError } from "../lib/github";
import { GET } from "../app/api/language/route";
const edge = (
  name: string,
  size: number,
  color: string | null = "#00add8",
) => ({ size, node: { name, color } });
test("languages aggregate bytes across repositories, sort, and retain every language", () => {
  const languages = aggregateLanguages([
    edge("Go", 30),
    edge("Go", 20),
    edge("TypeScript", 50),
    edge("Empty", 0),
    edge("Other", 100, "invalid"),
  ]);
  assert.deepEqual(
    languages.map((l) => [l.name, l.percentage]),
    [
      ["Other", 50],
      ["Go", 25],
      ["TypeScript", 25],
    ],
  );
  assert.equal(languages[0].color, "#8b949e");
  assert.deepEqual(aggregateLanguages([]), []);
});
test("refresh defaults to 15 minutes and validates configurable bounds", () => {
  assert.equal(languageRefreshSeconds(""), 900);
  assert.equal(languageRefreshSeconds("1800"), 1800);
  for (const value of ["oops", "-1", "0", "59", "900.5", "86401"])
    assert.equal(languageRefreshSeconds(value), 900);
});
test("memory cache honors the language refresh interval", async () => {
  let now = 0,
    calls = 0;
  const read = createMemoryCache(
    async () => {
      calls++;
      return { languages: [], stale: false };
    },
    () => now,
    900000,
  );
  await read();
  now = 899999;
  await read();
  assert.equal(calls, 1);
  now = 900000;
  await read();
  assert.equal(calls, 2);
});
test("SVG shows only the top five languages, escapes labels, and supports empty states", () => {
  const languages = aggregateLanguages(
    Array.from({ length: 20 }, (_, i) =>
      edge(i === 0 ? "<script>" : `Language ${i}`, 20 - i),
    ),
  );
  const svg = languageCard({
    languages,
    repositories: 12,
    updatedAt: "2026-11-07T00:00:00Z",
  });
  assert.ok(svg.includes("&lt;script&gt;"));
  assert.ok(!svg.includes("<script>"));
  assert.ok(svg.includes("Language 3"));
  assert.ok(svg.includes("Language 4"));
  assert.ok(!svg.includes("Language 5"));
  assert.ok(!svg.includes("Language 19"));
  assert.ok(svg.includes('height="240"'));
  assert.ok(svg.includes("#0d1117"));
  assert.ok(
    languageCard(
      { languages: [], repositories: 0, updatedAt: "2026-11-07T00:00:00Z" },
      true,
    ).includes("No language data"),
  );
});
test("repository and nested language pagination produce complete totals", async () => {
  const original = global.fetch,
    token = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = "test";
  let calls = 0;
  try {
    global.fetch = async (_url, init) => {
      calls++;
      const { query, variables } = JSON.parse(String(init?.body));
      if (query.includes("node(id:")) {
        assert.equal(variables.after, "language-next");
        return Response.json({
          data: {
            node: {
              languages: {
                edges: [edge("JavaScript", 40)],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        });
      }
      assert.ok(query.includes("privacy:PUBLIC"));
      assert.ok(query.includes("ownerAffiliations:OWNER"));
      return Response.json({
        data: {
          user: {
            repositories: {
              pageInfo: {
                hasNextPage: !variables.after,
                endCursor: variables.after ? null : "repo-next",
              },
              nodes: [
                {
                  id: variables.after ? "repo2" : "repo1",
                  languages: {
                    edges: [edge("Go", variables.after ? 60 : 100)],
                    pageInfo: {
                      hasNextPage: !variables.after,
                      endCursor: variables.after ? null : "language-next",
                    },
                  },
                },
              ],
            },
          },
        },
      });
    };
    const result = await loadLanguages();
    assert.equal(calls, 3);
    assert.equal(result.repositories, 2);
    assert.equal(result.languages[0].bytes, 160);
    assert.equal(result.languages[0].percentage, 80);
  } finally {
    global.fetch = original;
    if (token) process.env.GITHUB_TOKEN = token;
    else delete process.env.GITHUB_TOKEN;
  }
});
test("malformed, limited, or failed GitHub responses do not publish partial languages", async () => {
  const original = global.fetch,
    token = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = "test";
  try {
    for (const body of [
      {},
      { data: { user: null } },
      { errors: [{ type: "RATE_LIMITED" }] },
    ]) {
      global.fetch = async () => Response.json(body);
      await assert.rejects(loadLanguages(), GithubError);
    }
    global.fetch = async () =>
      new Response("", { status: 429, headers: { "retry-after": "120" } });
    await assert.rejects(
      loadLanguages(),
      (error: unknown) =>
        error instanceof GithubError && error.retryAfter === 120,
    );
  } finally {
    global.fetch = original;
    if (token) process.env.GITHUB_TOKEN = token;
    else delete process.env.GITHUB_TOKEN;
  }
});
test("language endpoint rejects arbitrary accounts and sets configurable SVG headers", async () => {
  assert.equal(
    (await GET(new Request("http://localhost/api/language?username=other")))
      .status,
    400,
  );
  const original = global.fetch,
    token = process.env.GITHUB_TOKEN,
    refresh = process.env.LANGUAGE_REFRESH_SECONDS;
  process.env.GITHUB_TOKEN = "test";
  process.env.LANGUAGE_REFRESH_SECONDS = "1200";
  try {
    global.fetch = async () =>
      Response.json({
        data: {
          user: {
            repositories: {
              nodes: [],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        },
      });
    const response = await GET(new Request("http://localhost/api/language"));
    const json = await GET(
      new Request("http://localhost/api/language?format=json"),
    );
    assert.equal(json.status, 200);
    assert.ok(json.headers.get("Content-Type")?.includes("application/json"));
    assert.deepEqual((await json.json()).languages, []);
    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get("Content-Type"),
      "image/svg+xml; charset=utf-8",
    );
    assert.ok(response.headers.get("Cache-Control")?.includes("s-maxage=1200"));
  } finally {
    global.fetch = original;
    if (token) process.env.GITHUB_TOKEN = token;
    else delete process.env.GITHUB_TOKEN;
    if (refresh) process.env.LANGUAGE_REFRESH_SECONDS = refresh;
    else delete process.env.LANGUAGE_REFRESH_SECONDS;
  }
});

test("tiny nonzero language shares are not presented as zero", () => {
  assert.equal(languagePercentage(0.0001), "<0.1%");
  assert.equal(languagePercentage(12.34), "12.3%");
});
