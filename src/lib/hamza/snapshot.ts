/**
 * Read-only view of the repository at one exact commit. Sources: local git (TEAM_REPO_LOCAL_DIR), a GitHub
 * tarball cached per SHA (./snapshotSources.ts), or memory (tests). Secrets / data / binaries are hidden.
 */
export type SnapshotFile = { path: string; sha: string; content: string; size: number };

export interface RepoSnapshot {
  readonly ref: string;
  readonly sha: string;
  listFiles(): Promise<string[]>;
  readFile(path: string): Promise<SnapshotFile | null>;
}

const HIDDEN = [
  /(^|\/)\.env/i,
  /^data\//,
  /(^|\/)node_modules\//,
  /^\.next\//,
  /(^|\/)secrets?(\/|\.|$)/i,
  /\.(pem|key|p12|pfx|db|sqlite|zip|gz|tgz|png|jpe?g|gif|webp|ico|mp4|mp3|wav|pdf|woff2?|ttf|otf)$/i,
];

export function isReadablePath(path: string): boolean {
  if (!path || path.startsWith("/") || path.includes("..") || path.includes("\\")) return false;
  return !HIDDEN.some((re) => re.test(path));
}

export function gitBlobShaOf(content: string, sha1: (input: string) => string): string {
  return sha1(`blob ${Buffer.byteLength(content, "utf8")}\0${content}`);
}

/** In-memory snapshot (tests, evals). `shaOf` computes blob shas (pass a real git-blob sha1 in tests). */
export function memorySnapshot(files: Record<string, string>, options: { sha?: string; ref?: string; shaOf?: (content: string) => string } = {}): RepoSnapshot {
  const shaOf = options.shaOf ?? ((content: string) => `mem-${content.length}`);
  return {
    ref: options.ref ?? "memory",
    sha: options.sha ?? "memory",
    async listFiles() {
      return Object.keys(files).filter(isReadablePath).sort();
    },
    async readFile(path) {
      if (!isReadablePath(path) || !(path in files)) return null;
      const content = files[path];
      return { path, sha: shaOf(content), content, size: Buffer.byteLength(content, "utf8") };
    },
  };
}
