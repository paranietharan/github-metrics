import { getStats } from "@/lib/cache";
import { GithubError } from "@/lib/github";

export async function GET() {
  try {
    return Response.json(await getStats(), {
      headers: {
        "Cache-Control":
          "public, max-age=0, s-maxage=15, stale-while-revalidate=60",
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
