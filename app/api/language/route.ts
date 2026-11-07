import { responseCacheControl } from "@/lib/refresh";
import { getLanguages } from "@/lib/language-github";
import { languageRefreshSeconds } from "@/lib/language";
import { languageCard } from "@/lib/language-svg";
import { svgHeaders } from "@/lib/svg";
import { GithubError } from "@/lib/github";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  if (
    [...params.keys()].some((k) => !["theme", "format"].includes(k)) ||
    (params.has("format") &&
      !["json", "svg"].includes(params.get("format")!)) ||
    (params.has("theme") && !["dark", "light"].includes(params.get("theme")!))
  )
    return new Response("Invalid language card options", { status: 400 });
  const seconds = languageRefreshSeconds();
  try {
    const data = await getLanguages();
    if (params.get("format") === "json")
      return Response.json(data, {
        headers: { "Cache-Control": responseCacheControl(seconds, false) },
      });
    return new Response(languageCard(data, params.get("theme") === "light"), {
      headers: {
        ...svgHeaders,
        "Cache-Control": responseCacheControl(seconds),
      },
    });
  } catch (error) {
    if (params.get("format") === "json")
      return Response.json(
        { error: "Language statistics temporarily unavailable." },
        {
          status: error instanceof GithubError ? error.status : 503,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": String(
              error instanceof GithubError ? error.retryAfter : 60,
            ),
          },
        },
      );
    return new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="140" viewBox="0 0 420 140" role="img"><title>Language statistics unavailable</title><rect width="420" height="140" rx="8" fill="#0d1117"/><text x="28" y="70" fill="#8b949e" font-family="sans-serif" font-size="14">Language statistics temporarily unavailable.</text></svg>',
      {
        status: error instanceof GithubError ? error.status : 503,
        headers: {
          ...svgHeaders,
          "Cache-Control": "no-store",
          "Retry-After": String(
            error instanceof GithubError ? error.retryAfter : 60,
          ),
        },
      },
    );
  }
}
