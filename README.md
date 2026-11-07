# github-metrics

A minimal GitHub analytics dashboard with embeddable SVG statistics and repository-language cards for your profile README.

| Config                     | Description                                                                                                                                                                 |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GITHUB_USERNAME`          | GitHub account to display. Defaults to `paranietharan`.                                                                                                                     |
| `GITHUB_TOKEN`             | Required server-only GitHub token with public repository read access.                                                                                                       |
| `DISPLAY_TIMEZONE`         | Timezone for the updated timestamp. Defaults to `Asia/Colombo`. Statistics use UTC contribution dates.                                                                      |
| `SOURCE_REPOSITORY_URL`    | Optional GitHub repository URL for the header’s Source link.                                                                                                                |
| `LANGUAGE_REFRESH_SECONDS` | `/api/language` data refresh interval in seconds. Defaults to `900` (15 minutes); accepts `60`–`86400`. Refreshes on request; GitHub’s image proxy can cache independently. |
