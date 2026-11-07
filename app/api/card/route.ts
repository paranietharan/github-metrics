import { getStats } from "@/lib/cache";
import { avatarData } from "@/lib/avatar";
import { card, svgHeaders } from "@/lib/svg";

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  if (
    [...p.keys()].some(
      (k) => !["theme", "compact", "hide_avatar", "metric"].includes(k),
    ) ||
    (p.has("metric") && p.get("metric") !== "contributions") ||
    (p.has("theme") && !["light", "dark"].includes(p.get("theme")!)) ||
    ["compact", "hide_avatar"].some(
      (k) => p.has(k) && !["true", "false"].includes(p.get(k)!),
    )
  )
    return new Response("Invalid card options", { status: 400 });
  try {
    const stats = await getStats();
    const hidden = p.get("hide_avatar") === "true";
    return new Response(
      card(stats, {
        light: p.get("theme") === "light",
        compact: p.get("compact") === "true",
        hideAvatar: hidden,
        avatar: hidden ? undefined : await avatarData(stats.profile.avatar),
      }),
      { headers: svgHeaders },
    );
  } catch {
    return new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" width="760" height="160" viewBox="0 0 760 160" role="img"><title>Statistics temporarily unavailable</title><rect width="760" height="160" rx="12" fill="#0d1117"/><text x="30" y="85" fill="#c9d1d9" font-family="sans-serif">github-metrics · Statistics temporarily unavailable</text></svg>',
      {
        status: 503,
        headers: {
          ...svgHeaders,
          "Cache-Control": "no-store",
          "Retry-After": "60",
        },
      },
    );
  }
}
