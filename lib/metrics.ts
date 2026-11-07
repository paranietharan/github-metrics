export type Day = { date: string; contributions: number };
export type Stats = {
  profile: {
    login: string;
    name: string;
    bio: string;
    avatar: string;
    repositories: number;
  };
  days: Day[];
  commitDays?: Day[];
  metrics: {
    today: number;
    week: number;
    year: number;
    streak: number;
    streakBounded?: boolean;
  };
  repositories: { name: string; url: string }[];
  updatedAt: string;
  timezone: string;
  stale?: boolean;
};
export function dateKey(now: Date, timezone = "UTC") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function shift(date: string, days: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function calculate(days: Day[], today: string) {
  const map = new Map(days.map((d) => [d.date, d.contributions]));
  const weekday = new Date(today + "T12:00:00Z").getUTCDay();
  const monday = shift(today, -((weekday + 6) % 7));
  const sum = (from: string) =>
    days
      .filter((d) => d.date >= from && d.date <= today)
      .reduce((s, d) => s + d.contributions, 0);
  let cursor = (map.get(today) ?? 0) > 0 ? today : shift(today, -1);
  let streak = 0;
  while ((map.get(cursor) ?? 0) > 0) {
    streak++;
    cursor = shift(cursor, -1);
  }
  return {
    today: map.get(today) ?? 0,
    week: sum(monday),
    year: sum(today.slice(0, 4) + "-01-01"),
    streak,
  };
}
