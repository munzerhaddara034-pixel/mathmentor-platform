/**
 * Compact repository map for the system prompt (saves Hamza a dozen exploration calls): app routes, API routes,
 * component areas, lib modules, tests. Pure over a file list; cached per base SHA.
 */
import type { RepoSnapshot } from "./snapshot";

const MAX_CHARS = 5000;
const cache = new Map<string, string>();

function routeOf(path: string, prefix: string, file: RegExp): string {
  const route = path.slice(prefix.length).replace(file, "").replace(/\/$/, "");
  return `/${route}`.replace(/\/\([^)]+\)/g, "") || "/";
}

function groupCount(paths: string[], prefix: string, depth: number): string[] {
  const counts = new Map<string, number>();
  for (const path of paths) {
    if (!path.startsWith(prefix)) continue;
    const key = path.slice(prefix.length).split("/").slice(0, depth).join("/");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, n]) => `${key} (${n})`);
}

export function buildRepoMap(files: string[]): string {
  const pages = files.filter((f) => /^src\/app\/.*page\.tsx$/.test(f)).map((f) => routeOf(f, "src/app/", /\/?page\.tsx$/));
  const apis = files.filter((f) => /^src\/app\/api\/.*route\.ts$/.test(f)).map((f) => routeOf(f, "src/app/", /\/?route\.ts$/));
  const sections = [
    `Files: ${files.length}`,
    `Pages (${pages.length}): ${pages.sort().join(" ")}`,
    `API routes (${apis.length}): ${apis.sort().join(" ")}`,
    `Components: ${groupCount(files, "src/components/", 1).join(", ")}`,
    `Lib modules: ${groupCount(files, "src/lib/", 1).join(", ")}`,
    `i18n catalogues: ${files.filter((f) => f.startsWith("src/lib/i18n/ns/")).map((f) => f.slice(16)).join(", ")}`,
    `Tests: ${files.filter((f) => /^tests\/[^/]+\.test\.mjs$/.test(f)).length} files in tests/ (node:test) + scripts/test-team-chat.ts`,
    `UI kit: ${files.filter((f) => f.startsWith("src/components/ui/")).map((f) => f.slice(18)).join(", ")}`,
  ];
  const text = sections.join("\n");
  return text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}…` : text;
}

export async function repoMapFor(snapshot: RepoSnapshot): Promise<string> {
  const hit = cache.get(snapshot.sha);
  if (hit) return hit;
  const map = buildRepoMap(await snapshot.listFiles());
  cache.set(snapshot.sha, map);
  if (cache.size > 4) cache.delete(cache.keys().next().value ?? "");
  return map;
}
