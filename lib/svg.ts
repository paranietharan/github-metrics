import type { Stats } from "./metrics";
export function escapeXml(value: string) {
  return value
    .replace(
      /[<>&"']/g,
      (c) =>
        ({
          "<": "&lt;",
          ">": "&gt;",
          "&": "&amp;",
          '"': "&quot;",
          "'": "&apos;",
        })[c]!,
    )
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
}

/** Wrap the visible identity while keeping full text in the accessible title. */
export function nameLines(name: string): string[] {
  const words = name.trim().split(/\s+/);
  const lines: string[] = [];
  for (const word of words) {
    const last = lines.length - 1;
    if (last >= 0 && Array.from(lines[last] + " " + word).length <= 22)
      lines[last] += " " + word;
    else lines.push(word);
  }
  return lines.length <= 2 ? lines : [lines[0], lines.slice(1).join(" ")];
}
function fitText(text: string, width: number, fontSize: number) {
  return Array.from(text).length * fontSize * 0.65 > width
    ? ` textLength="${width}" lengthAdjust="spacingAndGlyphs"`
    : "";
}

export function card(
  stats: Stats,
  options: {
    light?: boolean;
    compact?: boolean;
    hideAvatar?: boolean;
    avatar?: string;
  } = {},
) {
  const bg = options.light ? "#ffffff" : "#0d1117",
    fg = options.light ? "#1f2328" : "#c9d1d9",
    muted = options.light ? "#59636e" : "#8b949e";
  const accent = options.light ? "#0969da" : "#58a6ff";
  const border = options.light ? "#d0d7de" : "#30363d";
  const height = options.compact ? 136 : 160;
  const avatar = options.hideAvatar
    ? ""
    : options.avatar
      ? `<image href="${escapeXml(options.avatar)}" x="24" y="30" width="44" height="44" clip-path="url(#avatar)"/>`
      : `<circle cx="46" cy="52" r="22" fill="#161b22"/><text x="46" y="58" text-anchor="middle" fill="${fg}">${escapeXml(stats.profile.login[0].toUpperCase())}</text>`;
  const x = options.hideAvatar ? 24 : 82;
  const metrics = stats.metrics;
  const identity = nameLines(stats.profile.name);
  const identityWidth = 192;
  const name = identity
    .map(
      (line, i) =>
        `<text x="${x}" y="${identity.length > 1 ? 39 + i * 19 : 47}" fill="${accent}" font-size="15" font-weight="600"${fitText(line, identityWidth, 15)}>${escapeXml(line)}</text>`,
    )
    .join("");
  const values = [
    ["Today", metrics.today],
    ["This week", metrics.week],
    ["This year", metrics.year],
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="${height}" viewBox="0 0 760 ${height}" role="img" aria-labelledby="title desc"><title id="title">${escapeXml(stats.profile.name)} — GitHub contribution statistics</title><desc id="desc">All contributions visible to the configured token by GitHub contribution date. ${values.map((v) => v.join(": ")).join(", ")}.</desc><defs><clipPath id="avatar"><circle cx="46" cy="52" r="22"/></clipPath></defs><rect x=".5" y=".5" width="759" height="${height - 1}" rx="12" fill="${bg}" stroke="${border}"/><g font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">${avatar}${name}<text x="${x}" y="${identity.length > 1 ? 79 : 69}" fill="${muted}" font-size="12"${fitText("@" + stats.profile.login, identityWidth, 12)}>@${escapeXml(stats.profile.login)}</text>${values.map(([label, value], i) => `<text x="${320 + i * 140}" y="49" fill="${muted}" font-size="11">${label}</text><text x="${320 + i * 140}" y="81" fill="${accent}" font-size="28" font-weight="600">${value}</text>`).join("")}<path d="M24 ${height - 43}H736" stroke="${border}"/><text x="24" y="${height - 20}" fill="${muted}" font-size="10">github-metrics · contributions · GitHub day (UTC)</text><text x="736" y="${height - 20}" text-anchor="end" fill="${muted}" font-size="10">${stats.stale ? "Cached · " : ""}${escapeXml(stats.updatedAt.slice(0, 16).replace("T", " "))} UTC</text></g></svg>`;
}
export const svgHeaders = {
  "Content-Type": "image/svg+xml; charset=utf-8",
  "Cache-Control":
    "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy":
    "default-src 'none'; img-src data:; style-src 'none'; sandbox",
};
