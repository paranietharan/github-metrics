import "server-only";
import { loadGithub } from "./github";
import { createMemoryCache } from "./memory-cache";

// Warm instances deduplicate refreshes locally; Vercel caches route responses.
export const getStats = createMemoryCache(loadGithub);
