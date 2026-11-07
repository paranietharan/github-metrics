import { statsRefreshSeconds, responseCacheControl } from "@/lib/refresh";
import { getStats } from "@/lib/cache";
import { GithubError } from "@/lib/github";

export async function GET() {
  try {
    return Response.json(await getStats(), {
      headers: {
        "Cache-Control": responseCacheControl(statsRefreshSeconds(), false),
      },
    });
  } catch (e) {
    return Response.json(
      {
        error:
          "Statistics unavailable. Check server configuration or try again shortly.",
      },
      {
        status: e instanceof GithubError ? e.status : 503,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(e instanceof GithubError ? e.retryAfter : 60),
        },
      },
    );
  }
}
