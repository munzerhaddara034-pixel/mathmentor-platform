/** Node-only snapshot sources: local git checkout, or the GitHub tarball for an exact SHA cached in /tmp/hamza. */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { isReadablePath, type RepoSnapshot, type SnapshotFile } from "./snapshot";

const run = promisify(execFile);
const MAX_READ_BYTES = 400_000;

function blobSha(bytes: Buffer): string {
  return createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
}

export function gitSnapshot(dir: string, ref: string, sha: string): RepoSnapshot {
  let files: string[] | null = null;
  return {
    ref,
    sha,
    async listFiles() {
      if (!files) {
        const { stdout } = await run("git", ["-C", dir, "ls-tree", "-r", "--name-only", sha], { maxBuffer: 16 * 1024 * 1024 });
        files = stdout.split("\n").filter((item) => item && isReadablePath(item));
      }
      return files;
    },
    async readFile(file) {
      if (!isReadablePath(file)) return null;
      try {
        const { stdout } = await run("git", ["-C", dir, "show", `${sha}:${file}`], { encoding: "buffer", maxBuffer: 8 * 1024 * 1024 });
        const bytes = Buffer.from(stdout);
        if (bytes.length > MAX_READ_BYTES) return null;
        return { path: file, sha: blobSha(bytes), content: bytes.toString("utf8"), size: bytes.length };
      } catch {
        return null;
      }
    },
  };
}

export async function localGitSha(dir: string, ref: string): Promise<string> {
  const { stdout } = await run("git", ["-C", dir, "rev-parse", ref]);
  return stdout.trim();
}

async function walk(root: string, rel = ""): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(path.join(root, rel), { withFileTypes: true })) {
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".git") out.push(...(await walk(root, child)));
    } else if (isReadablePath(child)) out.push(child);
  }
  return out;
}

export function dirSnapshot(root: string, ref: string, sha: string): RepoSnapshot {
  let files: string[] | null = null;
  return {
    ref,
    sha,
    async listFiles() {
      files ??= (await walk(root)).sort();
      return files;
    },
    async readFile(file): Promise<SnapshotFile | null> {
      if (!isReadablePath(file)) return null;
      try {
        const full = path.join(root, file);
        if (!full.startsWith(root) || (await stat(full)).size > MAX_READ_BYTES) return null;
        const bytes = await readFile(full);
        return { path: file, sha: blobSha(bytes), content: bytes.toString("utf8"), size: bytes.length };
      } catch {
        return null;
      }
    },
  };
}

/** Downloads + extracts the tarball of `sha` once (≈24 MB repo) into $TMPDIR/hamza/<sha>. */
export async function githubTarballSnapshot(input: { owner: string; repo: string; ref: string; sha: string }): Promise<RepoSnapshot> {
  if (!/^[0-9a-f]{40}$/.test(input.sha)) throw new Error("Snapshot needs an exact commit SHA.");
  const base = path.join(os.tmpdir(), "hamza");
  const dir = path.join(base, input.sha);
  try {
    await stat(path.join(dir, ".hamza-ready"));
    return dirSnapshot(dir, input.ref, input.sha);
  } catch {
    // not cached yet
  }
  await mkdir(dir, { recursive: true });
  const token = process.env.GITHUB_TOKEN?.trim();
  const response = await fetch(`https://api.github.com/repos/${input.owner}/${input.repo}/tarball/${input.sha}`, {
    headers: { Accept: "application/vnd.github+json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`GitHub tarball ${response.status}`);
  const archive = path.join(base, `${input.sha}.tar.gz`);
  await writeFile(archive, Buffer.from(await response.arrayBuffer()));
  try {
    await run("tar", ["-xzf", archive, "-C", dir, "--strip-components=1", "--exclude=*/data/*", "--exclude=*/.env*"]);
    await writeFile(path.join(dir, ".hamza-ready"), new Date().toISOString());
  } finally {
    await rm(archive, { force: true });
  }
  return dirSnapshot(dir, input.ref, input.sha);
}
