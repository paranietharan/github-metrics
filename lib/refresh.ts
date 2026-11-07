/** Invalid settings fall back safely; intervals are expressed in seconds. */
export function refreshSeconds(
  value: string | undefined,
  fallback: number,
  minimum = 15,
): number {
  const seconds = Number(value);
  return Number.isInteger(seconds) && seconds >= minimum && seconds <= 86400
    ? seconds
    : fallback;
}
export function statsRefreshSeconds() {
  return refreshSeconds(process.env.STATS_REFRESH_SECONDS, 60);
}
export function cardRefreshSeconds() {
  return refreshSeconds(process.env.CARD_REFRESH_SECONDS, 60);
}
export function sharedStatsRefreshSeconds() {
  // Both endpoints use the same snapshot; honor the shorter freshness target.
  return Math.min(statsRefreshSeconds(), cardRefreshSeconds());
}
export function responseCacheControl(seconds: number, browserCache = true) {
  return `public, max-age=${browserCache ? seconds : 0}, s-maxage=${seconds}, stale-while-revalidate=300`;
}
