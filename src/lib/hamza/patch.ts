/**
 * Multi-file patch ops from the model → TeamProposalFile[] against an exact-SHA snapshot.
 * edit = exact search/replace (each search must match exactly once), create, delete, rename (+ optional edits).
 * Pure apart from snapshot reads; writes nothing.
 */
import { isAllowedPath } from "@/lib/team/codeChecks";
import { unifiedDiff } from "@/lib/team/diff";
import type { TeamProposalFile } from "@/lib/team/types";
import type { RepoSnapshot } from "./snapshot";

export type SearchReplace = { search: string; replace: string };
export type PatchOp =
  | { op: "edit"; path: string; edits: SearchReplace[] }
  | { op: "create"; path: string; content: string }
  | { op: "delete"; path: string }
  | { op: "rename"; from: string; to: string; edits: SearchReplace[] };

export type PatchResult = { ok: true; files: TeamProposalFile[] } | { ok: false; errors: string[] };

const MAX_OPS = 40;

function cleanPath(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/^\.?\/+/, "") : "";
}

function parseEdits(value: unknown): SearchReplace[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .filter((item) => typeof item.search === "string" && typeof item.replace === "string")
    .map((item) => ({ search: item.search as string, replace: item.replace as string }));
}

/** Tolerant parse of the model's `patch` array; unknown shapes are dropped (and reported by applyPatch). */
export function parsePatchOps(value: unknown): PatchOp[] {
  if (!Array.isArray(value)) return [];
  const ops: PatchOp[] = [];
  for (const raw of value.slice(0, MAX_OPS)) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const path = cleanPath(item.path);
    if (item.op === "edit" && path) ops.push({ op: "edit", path, edits: parseEdits(item.edits) });
    else if (item.op === "create" && path && typeof item.content === "string") ops.push({ op: "create", path, content: item.content });
    else if (item.op === "delete" && path) ops.push({ op: "delete", path });
    else if (item.op === "rename" && cleanPath(item.from) && cleanPath(item.to)) {
      ops.push({ op: "rename", from: cleanPath(item.from), to: cleanPath(item.to), edits: parseEdits(item.edits) });
    }
  }
  return ops;
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + needle.length)) count += 1;
  return count;
}

/** Applies search/replace edits in order; every search must occur exactly once in the current text. */
export function applyEdits(path: string, content: string, edits: SearchReplace[]): { content: string; errors: string[] } {
  let next = content;
  const errors: string[] = [];
  edits.forEach((edit, index) => {
    if (!edit.search) return errors.push(`${path}: edit ${index + 1} has an empty "search".`);
    const n = countOccurrences(next, edit.search);
    if (n !== 1) {
      return errors.push(`${path}: edit ${index + 1} "search" matched ${n} times (must match exactly once — copy the lines verbatim from read_file and add context).`);
    }
    next = next.replace(edit.search, () => edit.replace);
  });
  return { content: next, errors };
}

function withNewline(text: string): string {
  return text === "" || text.endsWith("\n") ? text : `${text}\n`;
}

function fileEntry(input: {
  path: string;
  before: { sha: string; content: string } | null;
  after: string;
  change: TeamProposalFile["change"];
  oldPath?: string;
}): TeamProposalFile {
  const diff = unifiedDiff(input.path, input.before?.content ?? null, input.after);
  return {
    path: input.path,
    baseSha: input.before?.sha ?? null,
    isNew: input.before === null,
    newContent: input.after,
    diff: diff.text,
    additions: diff.additions,
    deletions: diff.deletions,
    change: input.change,
    ...(input.oldPath ? { oldPath: input.oldPath } : {}),
    ...(input.before ? { oldContent: input.before.content } : {}),
  };
}

export async function applyPatch(snapshot: RepoSnapshot, ops: PatchOp[]): Promise<PatchResult> {
  const errors: string[] = [];
  const files: TeamProposalFile[] = [];
  const touched = new Set<string>();
  const claim = (path: string) => {
    if (!isAllowedPath(path)) errors.push(`${path}: path is not writable from the platform (allowed: src/ docs/ content/ scripts/ public/ README.md).`);
    if (touched.has(path)) errors.push(`${path}: touched by more than one op — merge them into one.`);
    touched.add(path);
  };
  if (!ops.length) return { ok: false, errors: ["The patch is empty or malformed."] };
  for (const op of ops) {
    if (op.op === "create") {
      claim(op.path);
      if (await snapshot.readFile(op.path)) errors.push(`${op.path}: already exists — use "edit".`);
      else files.push(fileEntry({ path: op.path, before: null, after: withNewline(op.content), change: "add" }));
      continue;
    }
    const source = op.op === "rename" ? op.from : op.path;
    claim(source);
    if (op.op === "rename") claim(op.to);
    const current = await snapshot.readFile(source);
    if (!current) {
      errors.push(`${source}: not found at ${snapshot.sha.slice(0, 7)}.`);
      continue;
    }
    const before = { sha: current.sha, content: current.content };
    if (op.op === "delete") {
      files.push(fileEntry({ path: op.path, before, after: "", change: "delete" }));
      continue;
    }
    const edited = applyEdits(source, current.content, op.edits);
    errors.push(...edited.errors);
    if (op.op === "rename") {
      if (await snapshot.readFile(op.to)) errors.push(`${op.to}: rename target already exists.`);
      files.push(fileEntry({ path: op.to, before, after: edited.content, change: "rename", oldPath: op.from }));
    } else if (!op.edits.length) errors.push(`${op.path}: "edit" without edits.`);
    else if (edited.content !== current.content) files.push(fileEntry({ path: op.path, before, after: edited.content, change: "modify" }));
  }
  if (errors.length) return { ok: false, errors: errors.slice(0, 20) };
  if (!files.length) return { ok: false, errors: ["The patch changes nothing (all edits are no-ops)."] };
  return { ok: true, files };
}
