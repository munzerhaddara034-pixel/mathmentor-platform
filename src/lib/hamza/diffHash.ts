/**
 * Canonical hash of a proposal's patch. Approval codes bind to it, so the approved bytes are exactly the
 * bytes that get committed. Order-independent (sorted by path) and covers deletes / renames.
 */
import { createHash } from "node:crypto";

export type HashableFile = {
  path: string;
  oldPath?: string;
  change?: "add" | "modify" | "delete" | "rename";
  baseSha: string | null;
  newContent: string;
};

export function computeDiffHash(files: HashableFile[]): string {
  const canonical = [...files]
    .map((file) => ({
      path: file.path,
      oldPath: file.oldPath ?? null,
      change: file.change ?? (file.baseSha ? "modify" : "add"),
      baseSha: file.baseSha ?? null,
      content: file.change === "delete" ? null : file.newContent,
    }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
