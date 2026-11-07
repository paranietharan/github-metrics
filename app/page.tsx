import { statsRefreshSeconds } from "@/lib/refresh";
import { Suspense } from "react";
import Dashboard from "@/components/dashboard";
export default function Home() {
  const source = process.env.SOURCE_REPOSITORY_URL;
  return (
    <Suspense
      fallback={
        <main aria-busy="true" style={{ padding: 48, color: "#8b949e" }}>
          Loading github-metrics…
        </main>
      }
    >
      <Dashboard
        refreshSeconds={statsRefreshSeconds()}
        username={process.env.GITHUB_USERNAME || "paranietharan"}
        source={source?.startsWith("https://github.com/") ? source : undefined}
      />
    </Suspense>
  );
}
