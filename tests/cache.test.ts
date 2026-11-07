import { test } from "node:test";
import assert from "node:assert/strict";
import { createMemoryCache } from "../lib/memory-cache";
import type { Stats } from "../lib/metrics";

const snapshot: Stats = {
  profile: {
    login: "test",
    name: "Test",
    bio: "",
    avatar: "",
    repositories: 0,
  },
  days: [],
  metrics: { today: 0, week: 0, year: 0 },
  repositories: [],
  updatedAt: "2026-11-07T00:00:00Z",
  timezone: "Asia/Colombo",
};

test("deduplicates concurrent refreshes and reuses snapshots for 60 seconds", async () => {
  let time = 0;
  let requests = 0;
  const read = createMemoryCache(
    async () => {
      requests++;
      return snapshot;
    },
    () => time,
  );
  const first = read();
  assert.equal(read(), first);
  await first;
  time = 59_999;
  assert.equal(await read(), snapshot);
  assert.equal(requests, 1);
  time = 60_000;
  await read();
  assert.equal(requests, 2);
});

test("serves stale data during failures and honors retry cooldown", async () => {
  let time = 0;
  let requests = 0;
  const failure = Object.assign(new Error("Unavailable"), { retryAfter: 120 });
  const read = createMemoryCache(
    async () => {
      if (++requests > 1) throw failure;
      return snapshot;
    },
    () => time,
  );
  await read();
  time = 60_000;
  assert.equal((await read()).stale, true);
  time = 179_999;
  assert.equal((await read()).stale, true);
  assert.equal(requests, 2);
  time = 180_000;
  await read();
  assert.equal(requests, 3);
  time = 7 * 24 * 60 * 60 * 1000;
  await assert.rejects(read(), failure);
});

test("cold failures are deduplicated through the cooldown and isolated between instances", async () => {
  let requests = 0;
  const failure = new Error("Unavailable");
  const load = async (): Promise<Stats> => {
    requests++;
    throw failure;
  };
  const read = createMemoryCache(load, () => 0);
  await assert.rejects(read(), failure);
  await assert.rejects(read(), failure);
  assert.equal(requests, 1);
  await assert.rejects(createMemoryCache(load, () => 0)(), failure);
  assert.equal(requests, 2);
});
