import { test } from "node:test";
import assert from "node:assert/strict";
import {
  refreshSeconds,
  statsRefreshSeconds,
  cardRefreshSeconds,
  sharedStatsRefreshSeconds,
  responseCacheControl,
} from "../lib/refresh";
import { GET as statsGET } from "../app/api/stats/route";
import { GET as cardGET } from "../app/api/card/route";

test("refresh settings validate integers and safely default", () => {
  for (const value of [undefined, "", "bad", "0", "-1", "14", "60.5", "86401"])
    assert.equal(refreshSeconds(value, 60), 60);
  assert.equal(refreshSeconds("15", 60), 15);
  assert.equal(refreshSeconds("86400", 60), 86400);
  assert.equal(refreshSeconds("30", 900, 60), 900);
});

test("stats and card honor separate intervals while sharing the shorter data freshness", async () => {
  const previous = {
    stats: process.env.STATS_REFRESH_SECONDS,
    card: process.env.CARD_REFRESH_SECONDS,
    token: process.env.GITHUB_TOKEN,
  };
  const original = global.fetch;
  process.env.STATS_REFRESH_SECONDS = "120";
  process.env.CARD_REFRESH_SECONDS = "300";
  process.env.GITHUB_TOKEN = "test";
  try {
    assert.equal(statsRefreshSeconds(), 120);
    assert.equal(cardRefreshSeconds(), 300);
    assert.equal(sharedStatsRefreshSeconds(), 120);
    let calls = 0;
    global.fetch = async (_url, init) => {
      calls++;
      const query = JSON.parse(String(init?.body)).query as string;
      const user: Record<string, unknown> = {
        login: "test",
        name: "Test",
        bio: null,
        avatarUrl: "https://avatars.githubusercontent.com/u/1",
        repositories: { totalCount: 0, nodes: [] },
      };
      for (const [, alias, from] of query.matchAll(
        /(p\d+):contributionsCollection\(from:"([^"]+)"/g,
      ))
        user[alias] = {
          contributionCalendar: {
            weeks: [
              {
                contributionDays: [
                  { date: from.slice(0, 10), contributionCount: 1 },
                ],
              },
            ],
          },
        };
      return Response.json({ data: { user } });
    };
    const stats = await statsGET();
    assert.equal(stats.status, 200);
    assert.equal(
      stats.headers.get("Cache-Control"),
      responseCacheControl(120, false),
    );
    const card = await cardGET(
      new Request("http://localhost/api/card?hide_avatar=true"),
    );
    assert.equal(card.status, 200);
    assert.equal(card.headers.get("Cache-Control"), responseCacheControl(300));
    assert.equal(calls, 1);
  } finally {
    global.fetch = original;
    for (const [key, value] of [
      ["STATS_REFRESH_SECONDS", previous.stats],
      ["CARD_REFRESH_SECONDS", previous.card],
      ["GITHUB_TOKEN", previous.token],
    ]) {
      if (value === undefined) delete process.env[key!];
      else process.env[key!] = value;
    }
  }
});
