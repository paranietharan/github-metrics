# github-metrics

A quiet place to see consistent work. A responsive GitHub analytics dashboard and an embeddable SVG card, built around qualifying GitHub commit contributions.

## Features

- Compact contribution metrics, accessible contribution calendar, and 7-day, 30-day, or monthly activity bars
- Dark and light interfaces, mobile layouts, keyboard focus states, reduced motion support
- Public repository activity, live GitHub avatar, and copyable README embed
- Shared server-side normalization, validated GraphQL responses, in-memory caching and concurrent refresh deduplication
- Embedded, validated PNG/JPEG avatars; escaped SVG text; no external SVG resources

## Stack

Next.js App Router, strict TypeScript, Tailwind CSS, React, SWR, Lucide, and Zod. Charts use lightweight CSS bars instead of an additional chart dependency. Caching uses server memory and Vercel CDN response headers. No external cache service or cache credentials are required.

## Local setup

Use Node.js 22 or newer. Install dependencies with `npm ci`, copy `.env.example` to `.env.local`, and set your credentials. Run `npm run dev` and open http://localhost:3000.

| Variable                | Purpose                                                                   |
| ----------------------- | ------------------------------------------------------------------------- |
| `GITHUB_USERNAME`       | Account to display; defaults to `paranietharan`                           |
| `GITHUB_TOKEN`          | Server-only GitHub token, required for GraphQL                            |
| `DISPLAY_TIMEZONE`      | Timestamp display zone, defaults to `Asia/Colombo`; use a valid IANA zone |
| `SOURCE_REPOSITORY_URL` | Optional GitHub source link                                               |

Never prefix credentials with `NEXT_PUBLIC_`. No credentials are returned by either public endpoint. The application supports one configured account; URL-supplied usernames are rejected.

### GitHub token

Create a fine-grained personal access token in GitHub Settings → Developer settings, with public repository read access and no additional repository permissions. Alternatively, a classic token with no scopes can read public data. Do not grant `repo` or private repository access for this application. Organization policies may impose additional restrictions. Rotate credentials in Vercel and locally when needed.

GraphQL supplies profile and contribution data in one request with quarter-sized calendar periods. No REST calls are needed for the current feature set. Stars and latest-event statistics are omitted rather than approximated.

## Metric definitions and limits

Primary statistics sum `commitContributionsByRepository.contributions.nodes.commitCount`. These are qualifying GitHub commit contributions, not all commits pushed. Each quarter requests up to 100 repositories and 100 daily nodes per repository; pagination flags and `totalCommitContributions` are checked and incomplete results fail closed rather than publishing partial totals. The heatmap independently uses `contributionCalendar.contributionDays.contributionCount` for all contribution types.

- **Today:** qualifying commit contributions for the current UTC GitHub contribution date.
- **Week:** qualifying commit contributions from Monday through today.
- **Year:** qualifying commit contributions from January 1 through today.
- **Streak:** consecutive dates with at least one qualifying commit contribution, starting today when active or yesterday otherwise. History starts January 1 of the previous year; `+` indicates a lower bound.
- **Heatmap:** all daily contributions returned by GitHub, for the last 365 days.
- **Activity chart:** daily qualifying commit contributions for 7 or 30 days, or monthly totals for 12 calendar months including the partial current month.
- **Repositories:** four most recently updated public repositories, not a ranking of contribution activity.

**Visibility:** totals reflect what the configured token can see, including any anonymous restricted counts returned by GitHub. They may differ from your signed-in GitHub profile. Private repository names and details are never exposed. Missing activity is never estimated.

**Timezone:** daily calendar buckets use GitHub contribution dates (UTC). `DISPLAY_TIMEZONE` controls the updated timestamp only. Exact local-midnight activity cannot be reconstructed from day buckets. GitHub may take time to register activity.

Current and previous years are fetched in disjoint quarter-sized periods, avoiding GraphQL's one-year collection range limit. Contribution statistics do not require enumerating repositories or commit histories.

## Cache and rate limits

The website polls `/api/stats` every 15 seconds while visible and online. SWR deduplicates requests and retains the last successful snapshot after errors. Initial loading uses stable placeholders; an unconfigured installation shows an actionable error, never fake analytics.

Both routes use an in-memory snapshot with a 60-second freshness target. Concurrent requests within one running server instance share the same refresh promise. Failed refreshes preserve successful snapshots for up to seven days while that instance stays alive, and a local cooldown honors rate-limit retry delays.

Vercel CDN response headers provide another cache layer: statistics use a 15-second shared-cache lifetime with 60-second stale-while-revalidate; SVG cards use 60 seconds with 300-second stale-while-revalidate. Error responses are not cached.

**Instance limits:** server memory is not shared across Vercel instances and resets on cold starts, restarts, and deployments. The dashboard and card can run in different instances, each calling GitHub independently. There is no durable stale fallback or cross-instance refresh lock. The application works on Vercel with only the GitHub configuration; no additional cache service is required.

**GitHub's image proxy caches independently. A visible README image is not guaranteed to update every minute.** The 60-second interval is an origin freshness target, not an end-to-end guarantee. Stale card snapshots display their original timestamp.

## README card

Replace `YOUR-VERCEL-DOMAIN` with your deployment domain:

```md
![GitHub Commit Statistics](https://YOUR-VERCEL-DOMAIN/api/card)
```

Options: `/api/card?theme=light&hide_avatar=true&compact=true`. The default `/api/card` always displays qualifying commit contributions. `metric=contributions` remains accepted for existing embeds; the legacy option does not change the metric. Defaults are dark, avatar visible, and 760 × 160 dimensions. Compact mode is 760 × 136. Invalid options return HTTP 400; unavailable cold data returns a safe SVG with HTTP 503. Avatars are fetched only from `avatars.githubusercontent.com` over HTTPS without redirects, limited to 150 KB, checked for PNG/JPEG signatures and embedded as data URLs. Failed avatars use an initial fallback.

Preview the live card at `/api/card`. Dashboard screenshot: capture your configured local or deployed dashboard for your project README; no fabricated statistics screenshot is included.

## Commands and verification

```sh
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

## Deploy to Vercel

Import the repository into Vercel, choose Next.js, and configure the variables above for Production and Preview as appropriate. Deploy with the standard `npm run build` command. No production domain is hardcoded. Verify `/api/stats`, `/api/card`, and the dashboard after setting credentials. Update `GITHUB_USERNAME` and redeploy to switch the configured account.

For a personal portfolio, each warm instance targets one refresh per active minute, plus retries after cooldowns. Multiple instances and cold starts can increase GitHub requests. Each active browser polls four times per minute. CDN caching reduces origin work but does not eliminate bandwidth or request charges. Function invocations, SVG avatar payloads, cache usage, and execution duration count toward provider limits. Check your Vercel plan and billing dashboard before public promotion. No cron is required; refreshes are demand driven.

API responses use predictable normalized JSON or SVG, safe error messages, HTTP 429/503 where appropriate, and retry headers. The public dashboard intentionally exposes the configured user's public profile, aggregate contribution statistics and calendar.

### Reference documentation

Metric semantics: [GitHub GraphQL contribution types](https://docs.github.com/en/graphql/reference/objects#contributionscollection). Deployment cache behavior: [Vercel Cache-Control headers](https://vercel.com/docs/caching/cache-control-headers). The production build uses Next.js's Webpack compiler and the standard Tailwind PostCSS integration; local development retains Turbopack.

### Infrastructure budget

One active browser makes about 240 stats requests per hour. CDN hits can reduce function work, while each warm instance reuses its own snapshot for 60 seconds. Multiple instances and cold starts can independently refresh GitHub. SVG avatar fetches use Next’s daily data cache. Monitor Vercel transfer, function invocations, CPU and memory duration, cache usage, and GitHub query cost. Check current [Vercel limits](https://vercel.com/docs/limits) and [function pricing](https://vercel.com/docs/functions/usage-and-pricing) before deployment; plan quotas change. Set usage alerts for a public portfolio.

### Precision and visibility

GitHub daily commit contribution nodes do not supply raw commit timestamps sufficient to reconstruct arbitrary local-midnight boundaries. Metrics therefore deliberately use GitHub contribution dates (UTC); Asia/Colombo controls only timestamp display. Private/restricted activity cannot be reliably attributed to daily commit nodes and is excluded unless the API returns countable nodes whose sum matches the collection total. Use a public-only token. The application rejects incomplete responses rather than inventing precision. See [GitHub contribution collection reference](https://docs.github.com/en/graphql/reference/objects#contributionscollection).
