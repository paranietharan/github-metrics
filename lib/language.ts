export type Language = {
  name: string;
  color: string;
  bytes: number;
  percentage: number;
};
export type LanguageStats = {
  languages: Language[];
  repositories: number;
  updatedAt: string;
  stale?: boolean;
};
export function languageRefreshSeconds(
  value = process.env.LANGUAGE_REFRESH_SECONDS,
): number {
  const seconds = Number(value);
  return Number.isInteger(seconds) && seconds >= 60 && seconds <= 86400
    ? seconds
    : 900;
}
export function aggregateLanguages(
  edges: { size: number; node: { name: string; color: string | null } }[],
): Language[] {
  const map = new Map<string, { name: string; color: string; bytes: number }>();
  for (const edge of edges) {
    const entry = map.get(edge.node.name) ?? {
      name: edge.node.name,
      color:
        edge.node.color && /^#[0-9a-f]{6}$/i.test(edge.node.color)
          ? edge.node.color
          : "#8b949e",
      bytes: 0,
    };
    entry.bytes += edge.size;
    map.set(entry.name, entry);
  }
  const total = [...map.values()].reduce((sum, l) => sum + l.bytes, 0);
  return [...map.values()]
    .filter((l) => l.bytes > 0)
    .sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name))
    .map((l) => ({ ...l, percentage: (l.bytes / total) * 100 }));
}
