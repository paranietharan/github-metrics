# github-metrics

A minimal GitHub analytics dashboard with an embeddable SVG statistics card for your profile README.

| Config                  | Description                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| `GITHUB_USERNAME`       | GitHub account to display. Defaults to `paranietharan`.                                                |
| `GITHUB_TOKEN`          | Required server-only GitHub token with public repository read access.                                  |
| `DISPLAY_TIMEZONE`      | Timezone for the updated timestamp. Defaults to `Asia/Colombo`. Statistics use UTC contribution dates. |
| `SOURCE_REPOSITORY_URL` | Optional GitHub repository URL for the header’s Source link.                                           |
