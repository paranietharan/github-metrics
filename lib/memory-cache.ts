/** One cache per running server instance; no cross-instance persistence. */
export function createMemoryCache<T extends { stale?: boolean }>(
  load: () => Promise<T>,
  now: () => number = Date.now,
  freshnessMs = 60_000,
) {
  let snapshot: T | undefined;
  let refreshedAt = 0;
  let pending: Promise<T> | undefined;
  let retryAt = 0;
  let lastError: unknown;
  const stale = () =>
    snapshot && now() - refreshedAt < 7 * 24 * 60 * 60 * 1000
      ? { ...snapshot, stale: true }
      : undefined;

  return function read(): Promise<T> {
    if (snapshot && now() - refreshedAt < freshnessMs)
      return Promise.resolve(snapshot);
    if (pending) return pending;
    if (now() < retryAt) {
      const cached = stale();
      return cached ? Promise.resolve(cached) : Promise.reject(lastError);
    }
    pending = Promise.resolve()
      .then(load)
      .then((value) => {
        snapshot = value;
        refreshedAt = now();
        retryAt = 0;
        return value;
      })
      .catch((error: unknown) => {
        lastError = error;
        const seconds =
          error && typeof error === "object" && "retryAfter" in error
            ? Number(error.retryAfter)
            : 60;
        retryAt =
          now() +
          (Number.isFinite(seconds) ? Math.max(60, seconds) : 60) * 1000;
        const cached = stale();
        if (cached) return cached;
        throw error;
      })
      .finally(() => {
        pending = undefined;
      });
    return pending;
  };
}
