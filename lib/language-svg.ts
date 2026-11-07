import { escapeXml } from "./svg";
import type { LanguageStats } from "./language";
export function languagePercentage(value: number): string {
  return value > 0 && value < 0.1 ? "<0.1%" : `${value.toFixed(1)}%`;
}
export function languageCard(stats: LanguageStats, light = false): string {
  const bg = light ? "#ffffff" : "#0d1117",
    text = light ? "#1f2328" : "#c9d1d9",
    muted = light ? "#59636e" : "#8b949e",
    accent = light ? "#0969da" : "#58a6ff",
    border = light ? "#d0d7de" : "#30363d";
  const languages = stats.languages.slice(0, 5);
  const height = 240;
  const centerY = 125;
  const columnWidth = 320;
  let offset = 0;
  const circumference = 2 * Math.PI * 55;
  const segments = languages
    .map((l) => {
      const length = (l.percentage / 100) * circumference;
      const circle = `<circle cx="105" cy="${centerY}" r="55" fill="none" stroke="${escapeXml(l.color)}" stroke-width="22" stroke-dasharray="${length} ${circumference}" stroke-dashoffset="${-offset}" transform="rotate(-90 105 ${centerY})"/>`;
      offset += length;
      return circle;
    })
    .join("");
  const rows = languages
    .map((l, i) => {
      const x = 208;
      const y = 76 + i * 22;
      const labelWidth = columnWidth - 65;
      const fit =
        l.name.length * 6 > labelWidth
          ? ` textLength="${labelWidth}" lengthAdjust="spacingAndGlyphs"`
          : "";
      return `<circle cx="${x}" cy="${y - 4}" r="3.5" fill="${escapeXml(l.color)}"/><text x="${x + 11}" y="${y}" fill="${text}" font-size="11"${fit}>${escapeXml(l.name)}</text><text x="${x + columnWidth - 15}" y="${y}" text-anchor="end" fill="${muted}" font-size="10">${escapeXml(languagePercentage(l.percentage))}</text>`;
    })
    .join("");
  const top = languages[0];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="${height}" viewBox="0 0 560 ${height}" role="img" aria-labelledby="title desc"><title id="title">Most Used Languages</title><desc id="desc">Language share by detected code bytes across ${stats.repositories} owned public repositories, including forks and archived repositories. Top five shown; the remaining share is the neutral ring. ${languages.map((l) => `${escapeXml(l.name)}: ${escapeXml(languagePercentage(l.percentage))}`).join(", ")}</desc><rect x=".5" y=".5" width="559" height="${height - 1}" rx="8" fill="${bg}" stroke="${border}"/><g font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif"><text x="24" y="32" fill="${accent}" font-size="16" font-weight="700">Most Used Languages</text>${top ? `<circle cx="105" cy="${centerY}" r="55" fill="none" stroke="${border}" stroke-width="22"/>${segments}<text x="105" y="${centerY + 1}" text-anchor="middle" fill="${accent}" font-size="23" font-weight="700">${Math.round(top.percentage)}%</text><text x="105" y="${centerY + 21}" text-anchor="middle" fill="${muted}" font-size="11"${top.name.length > 14 ? ' textLength="88" lengthAdjust="spacingAndGlyphs"' : ""}>${escapeXml(top.name)}</text>${rows}` : `<text x="24" y="91" fill="${muted}" font-size="11">No language data in public repositories yet.</text>`}<path d="M24 ${height - 44}H536" stroke="${border}"/><text x="24" y="${height - 20}" fill="${muted}" font-size="9">Top 5 · all public repos · code bytes</text><text x="536" y="${height - 20}" text-anchor="end" fill="${muted}" font-size="9">${stats.stale ? "Cached · " : ""}${escapeXml(stats.updatedAt.slice(0, 16).replace("T", " "))} UTC · github-metrics</text></g></svg>`;
}
