import "server-only";
import { z } from "zod";
import { GithubError, checkResponse } from "./github";
import { createMemoryCache } from "./memory-cache";
import {
  aggregateLanguages,
  languageRefreshSeconds,
  type LanguageStats,
} from "./language";
const pageInfo = z.object({
  hasNextPage: z.boolean(),
  endCursor: z.string().nullable(),
});
const languages = z.object({
  pageInfo,
  edges: z.array(
    z.object({
      size: z.number().int().nonnegative(),
      node: z.object({ name: z.string().min(1), color: z.string().nullable() }),
    }),
  ),
});
const repositories = z.object({
  pageInfo,
  nodes: z.array(z.object({ id: z.string(), languages })),
});
const fields = `edges { size node { name color } } pageInfo { hasNextPage endCursor }`;
export async function loadLanguages(): Promise<LanguageStats> {
  const username = process.env.GITHUB_USERNAME || "paranietharan";
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(username) || !process.env.GITHUB_TOKEN)
    throw new GithubError();
  const deadline = AbortSignal.timeout(25000);
  async function query(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<unknown> {
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      cache: "no-store",
      signal: deadline,
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });
    checkResponse(response);
    const body = z
      .object({
        data: z.unknown().optional(),
        errors: z.array(z.object({ type: z.string().optional() })).optional(),
      })
      .safeParse(await response.json());
    if (!body.success) throw new GithubError();
    if (body.data.errors?.length)
      throw new GithubError(
        body.data.errors.some((e) => e.type === "RATE_LIMITED") ? 429 : 503,
      );
    return body.data.data;
  }
  const all: z.infer<typeof languages>["edges"] = [];
  let cursor: string | null = null;
  let repositoryCount = 0;
  const seen = new Set<string>();
  do {
    const raw = await query(
      `query($login:String!,$after:String) { user(login:$login) { repositories(first:50,after:$after,privacy:PUBLIC,ownerAffiliations:OWNER,orderBy:{field:NAME,direction:ASC}) { pageInfo { hasNextPage endCursor } nodes { id languages(first:100) { ${fields} } } } } }`,
      { login: username, after: cursor },
    );
    const parsed = z
      .object({ user: z.object({ repositories }) })
      .safeParse(raw);
    if (!parsed.success) throw new GithubError();
    const page = parsed.data.user.repositories;
    for (const repo of page.nodes) {
      repositoryCount++;
      all.push(...repo.languages.edges);
      let info = repo.languages.pageInfo;
      const languageCursors = new Set<string>();
      while (info.hasNextPage) {
        if (!info.endCursor || languageCursors.has(info.endCursor))
          throw new GithubError();
        languageCursors.add(info.endCursor);
        const next = z
          .object({ node: z.object({ languages }) })
          .safeParse(
            await query(
              `query($id:ID!,$after:String!) { node(id:$id) { ... on Repository { languages(first:100,after:$after) { ${fields} } } } }`,
              { id: repo.id, after: info.endCursor },
            ),
          );
        if (!next.success) throw new GithubError();
        all.push(...next.data.node.languages.edges);
        info = next.data.node.languages.pageInfo;
      }
    }
    if (!page.pageInfo.hasNextPage) break;
    cursor = page.pageInfo.endCursor;
    if (!cursor || seen.has(cursor)) throw new GithubError();
    seen.add(cursor);
  } while (true);
  return {
    languages: aggregateLanguages(all),
    repositories: repositoryCount,
    updatedAt: new Date().toISOString(),
  };
}
export const getLanguages = createMemoryCache(
  loadLanguages,
  Date.now,
  languageRefreshSeconds() * 1000,
);
