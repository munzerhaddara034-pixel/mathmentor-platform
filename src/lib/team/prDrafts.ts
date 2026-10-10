import path from "node:path";
import { createId } from "@/lib/ids";
import { readJsonFile, updateJsonFile } from "@/lib/dataDir";
import { redactSecrets } from "./secrets";
import { escalateTeamAgent } from "./health";
import { TEAM_AGENT_IDS, TEAM_AGENT_NAMES_AR, type TeamAgentId } from "./types";
import { teamMessages } from "@/lib/i18n/ns/team";

export const PR_DRAFT_STORE = "team-agent-health.json";
export const PR_DRAFT_LIMIT = 240;
export const PR_DRAFT_PATCH_BYTES = 200 * 1024;
export const PR_DRAFT_FILE_LIMIT = 12;
export const PR_DRAFT_LINE_LIMIT = 400;
export const PR_DRAFT_COMMIT_LIMIT = 200;
export const PR_DEPLOY_BRANCH = "agent-hub-latest";
export type TeamPrDraft = { id: string; agent: TeamAgentId; agentId: TeamAgentId; title: string; summary: string; rationale: string; patch: string; branch: string; files: string[]; additions: number; deletions: number; commitMessage: string; verdict: string; status: "draft" | "branch_pushed" | "pr_open" | "failed"; createdAt: string; prUrl?: string; prNumber?: number; compareUrl?: string; notice?: string; ci: "unknown" | "pending"; error?: string };
type Store = { records?: unknown[]; webCalls?: unknown[]; prDrafts?: TeamPrDraft[]; prDraftAudits?: Array<{ id: string; draftId: string; status: string; prUrl?: string; prNumber?: number; ci: string; error?: string; createdAt: string }> };
type PatchFile = { path: string; lines: string[]; additions: number; deletions: number; hunkOpen: boolean; oldRemaining: number; newRemaining: number; hasOldHeader: boolean; hasNewHeader: boolean };
type GithubPr = { html_url?: unknown; number?: unknown };
let fetchOverride: typeof fetch | undefined;
let escalationOverride: typeof escalateTeamAgent | undefined;
const createLocks = new Map<string, Promise<Awaited<ReturnType<typeof createDraftPullRequestInternal>>>>();

export function setPrDraftTestOverrides(input: { fetchImpl?: typeof fetch; escalate?: typeof escalateTeamAgent } = {}) { fetchOverride = input.fetchImpl; escalationOverride = input.escalate; }
export function resetPrDraftTestState() { fetchOverride = undefined; escalationOverride = undefined; createLocks.clear(); }
const tr = (locale: "ar" | "en" | "fr" = "ar") => teamMessages[locale].prDrafts;
function agentToken() { return process.env.GITHUB_AGENT_TOKEN?.trim() || ""; }
function stripAgentToken(text: string) { const token = agentToken(); return token ? text.split(token).join("[redacted]") : text; }
function clean(s: unknown, n: number) { return stripAgentToken(redactSecrets(typeof s === "string" ? s : "").text).replace(/[\u0000-\u001f]/g, "").trim().slice(0, n); }
function containsSecret(s: unknown) { const text = typeof s === "string" ? s : ""; return text !== redactSecrets(text).text || Boolean(agentToken() && text.includes(agentToken())); }
function fail(key: keyof typeof teamMessages.en.prDrafts) { return { ok: false as const, reason: tr("en")[key], reasonAr: tr("ar")[key] }; }

/** Return a canonical repository-relative path, while rejecting every spelling variant. */
function resolvedRepositoryPath(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw || raw.trim() !== raw || raw !== raw.normalize("NFC")) return null;
  let decoded: string;
  try { decoded = decodeURIComponent(raw); } catch { return null; }
  if (decoded !== raw || raw.includes("\\") || raw.includes("//") || raw.startsWith("/")) return null;
  const normalized = path.posix.normalize(raw), resolved = path.posix.resolve("/repository", raw);
  if (normalized !== raw || normalized === "." || resolved !== `/repository/${normalized}`) return null;
  return normalized;
}

function allowedPath(raw: string) {
  const p = resolvedRepositoryPath(raw);
  if (!p) return false;
  const lower = p.toLowerCase();
  const parts = lower.split("/");
  if (parts.some((part) => /^\.env(?:$|\.)/i.test(part) || part === "package.json" || /(?:^|\.)lock(?:\.[^/]*)?$/.test(part) || ["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lock", "bun.lockb", "npm-shrinkwrap.json"].includes(part))) return false;
  if (/^(?:src\/lib\/(?:auth|db|security)|data|migrations)(?:\/|$)/i.test(lower)) return false;
  if (parts.some((part) => part === "middleware.ts" || /^next\.config\.[^/]+$/i.test(part))) return false;
  return p === "README.md" || /^(?:src|tests|docs|scripts|public)\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/.test(p);
}

function closeHunk(current: PatchFile) {
  return !current.hunkOpen || (current.oldRemaining === 0 && current.newRemaining === 0);
}

function parsePatch(patch: string): PatchFile[] | null {
  const out: PatchFile[] = [];
  let current: PatchFile | undefined;
  const lines = patch.replace(/\r\n/g, "\n").split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith("diff --git ")) {
      if (current && (!closeHunk(current) || !current.hasOldHeader || !current.hasNewHeader)) return null;
      const match = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
      if (!match || match[1] !== match[2]) return null;
      current = { path: match[2], lines: [], additions: 0, deletions: 0, hunkOpen: false, oldRemaining: 0, newRemaining: 0, hasOldHeader: false, hasNewHeader: false };
      out.push(current);
      continue;
    }
    if (/^(?:new file mode|deleted file mode|old mode|new mode|similarity index|rename from|rename to|copy from|copy to|GIT binary patch|Binary files|literal |delta )/.test(line)) return null;
    if (line.startsWith("--- ") && current && !current.hasOldHeader && !current.hunkOpen) {
      if (line !== `--- a/${current.path}`) return null;
      current.hasOldHeader = true;
      continue;
    }
    if (line.startsWith("+++ ") && current && current.hasOldHeader && !current.hasNewHeader && !current.hunkOpen) {
      if (line !== `+++ b/${current.path}`) return null;
      current.hasNewHeader = true;
      continue;
    }
    if (line.startsWith("@@")) {
      if (!current || !current.hasOldHeader || !current.hasNewHeader || !closeHunk(current)) return null;
      const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?: .*)?$/.exec(line);
      if (!match || match[1] === "0" || match[3] === "0") return null;
      current.lines.push(line);
      current.hunkOpen = true;
      current.oldRemaining = Number(match[2] ?? 1);
      current.newRemaining = Number(match[4] ?? 1);
      continue;
    }
    if (line === "\\ No newline at end of file") {
      if (!current?.hunkOpen) return null;
      current.lines.push(line);
      continue;
    }
    if (current?.hunkOpen && /^[ +\-]/.test(line)) {
      if (line.startsWith(" ")) { current.oldRemaining -= 1; current.newRemaining -= 1; }
      else if (line.startsWith("+")) { current.newRemaining -= 1; current.additions += 1; }
      else { current.oldRemaining -= 1; current.deletions += 1; }
      if (current.oldRemaining < 0 || current.newRemaining < 0) return null;
      current.lines.push(line);
      continue;
    }
    if (line.startsWith("index ") && current && !current.hunkOpen) continue;
    if (line === "" && index === lines.length - 1) continue;
    return null;
  }
  if (!current || !out.length || out.some((file) => !file.hasOldHeader || !file.hasNewHeader || !file.lines.some((line) => line.startsWith("@@")) || !closeHunk(file))) return null;
  return new Set(out.map((file) => file.path)).size === out.length ? out : null;
}

function sameFiles(left: string[], right: string[]) {
  return left.length === right.length && new Set(left).size === left.length && left.every((file) => right.includes(file));
}
type PatchGuardResult = { ok: true; parsed: PatchFile[]; files: string[]; additions: number; deletions: number } | { ok: false; reason: keyof typeof teamMessages.en.prDrafts };
function patchGuard(patch: unknown, suppliedFiles: unknown): PatchGuardResult {
  if (typeof patch !== "string" || !patch) return { ok: false, reason: "invalidPatch" };
  const parsed = parsePatch(patch);
  if (!parsed) return { ok: false, reason: "invalidPatch" };
  const files = parsed.map((file) => file.path);
  if (!Array.isArray(suppliedFiles) || !suppliedFiles.every((file): file is string => typeof file === "string") || !sameFiles(suppliedFiles, files)) return { ok: false, reason: "invalidPatch" };
  if (files.length > PR_DRAFT_FILE_LIMIT) return { ok: false, reason: "tooManyFiles" };
  if (parsed.some((file) => !allowedPath(file.path))) return { ok: false, reason: "forbiddenPath" };
  const additions = parsed.reduce((total, file) => total + file.additions, 0), deletions = parsed.reduce((total, file) => total + file.deletions, 0);
  if (additions + deletions > PR_DRAFT_LINE_LIMIT) return { ok: false, reason: "tooManyLines" };
  return { ok: true, parsed, files, additions, deletions };
}

export function isValidAgentDraftBranch(agentId: string, branch: string): boolean {
  if (typeof agentId !== "string" || typeof branch !== "string" || !TEAM_AGENT_IDS.includes(agentId as TeamAgentId)) return false;
  const prefix = `agent/${agentId}-`, slugPart = branch.startsWith(prefix) ? branch.slice(prefix.length) : "";
  return Boolean(slugPart) && slugPart.length <= 45 && branch === `${prefix}${slugPart}` && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slugPart) && !branch.includes("..") && !["main", "master", PR_DEPLOY_BRANCH].includes(branch);
}
function slug(s: string) {
  const ascii = s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  return ascii.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 45).replace(/-$/, "");
}
async function store() { return readJsonFile<Store>(PR_DRAFT_STORE, { records: [], webCalls: [], prDrafts: [], prDraftAudits: [] }); }
function safeString(value: unknown, max = 2_000) { return clean(value, max); }
function safeDraft(draft: TeamPrDraft, includePatch = false): TeamPrDraft {
  const result = { ...draft, id: safeString(draft.id, 160), title: safeString(draft.title, 180), summary: safeString(draft.summary, 1_000), rationale: safeString(draft.rationale, 1_200), branch: safeString(draft.branch, 120), files: draft.files.map((file) => safeString(file, 240)), commitMessage: safeString(draft.commitMessage, PR_DRAFT_COMMIT_LIMIT), verdict: safeString(draft.verdict, 300), createdAt: safeString(draft.createdAt, 80), prUrl: draft.prUrl ? safeString(draft.prUrl, 500) : undefined, compareUrl: draft.compareUrl ? safeString(draft.compareUrl, 500) : undefined, notice: draft.notice ? safeString(draft.notice, 600) : undefined, error: draft.error ? safeString(draft.error, 200) : undefined };
  if (includePatch) result.patch = stripAgentToken(draft.patch);
  else delete (result as Partial<TeamPrDraft>).patch;
  return result;
}
export async function listPrDrafts() { return ((await store()).prDrafts ?? []).slice(-PR_DRAFT_LIMIT).map((draft) => safeDraft(draft)); }
export async function getPrDraft(id: string) { return ((await store()).prDrafts ?? []).find((draft) => draft.id === id) ?? null; }

export async function draftPullRequest(input: { agentId: string; title: string; summary: string; rationale: string; patch: string; files: string[]; commitMessage?: string }) {
  if ((process.env.AGENT_PR_DRAFTS ?? "on").trim().toLowerCase() === "off") return fail("disabled");
  if (!TEAM_AGENT_IDS.includes(input.agentId as TeamAgentId)) return fail("invalidAgent");
  const patch = typeof input.patch === "string" ? input.patch : "";
  if (Buffer.byteLength(patch, "utf8") > PR_DRAFT_PATCH_BYTES) return fail("patchTooLarge");
  if (containsSecret(patch)) return fail("secretInPatch");
  const title = clean(input.title, 180), summary = clean(input.summary, 1_000), rationale = clean(input.rationale, 1_200);
  const commitRaw = typeof input.commitMessage === "string" ? input.commitMessage : "";
  if (!title || !summary || !rationale || !patch) return fail("missingFields");
  if (commitRaw && [...commitRaw].length > PR_DRAFT_COMMIT_LIMIT) return fail("commitTooLong");
  const guarded = patchGuard(patch, input.files);
  if (!guarded.ok) return fail(guarded.reason);
  const branch = `agent/${input.agentId}-${slug(title)}`;
  if (!isValidAgentDraftBranch(input.agentId, branch)) return fail("invalidBranch");
  const now = new Date(), cutoff = now.getTime() - 86400000;
  const capN = Number(process.env.AGENT_PR_DRAFTS_MAX_PER_DAY), cap = Number.isFinite(capN) ? Math.max(0, Math.min(5, Math.floor(capN))) : 5;
  let item: TeamPrDraft | null = null;
  try {
    await updateJsonFile<Store>(PR_DRAFT_STORE, { records: [], webCalls: [], prDrafts: [], prDraftAudits: [] }, (db) => {
      const rows = Array.isArray(db.prDrafts) ? db.prDrafts : [];
      if (rows.filter((draft) => draft.agentId === input.agentId && Date.parse(draft.createdAt) > cutoff).length >= cap) throw new Error("limit");
      const message = clean(commitRaw || `${title} (${input.agentId})`, PR_DRAFT_COMMIT_LIMIT);
      item = { id: createId("pr-draft"), agent: input.agentId as TeamAgentId, agentId: input.agentId as TeamAgentId, title, summary, rationale, patch, branch, files: guarded.files, additions: guarded.additions, deletions: guarded.deletions, commitMessage: message || `${title} (${input.agentId})`, verdict: "PASS — allowed paths, patch/file/line caps, branch and daily budget", status: "draft", createdAt: now.toISOString(), ci: "unknown" };
      return { ...db, prDrafts: [...rows, item].slice(-PR_DRAFT_LIMIT) };
    });
  } catch (error) {
    if (String(error).includes("limit")) return fail("dailyLimit");
    throw error;
  }
  if (!item) throw new Error("Draft was not stored.");
  const stored = item as TeamPrDraft;
  let notice: string;
  try {
    const escalation = await (escalationOverride ?? escalateTeamAgent)({ agent: stored.agentId, intent: `PR draft: ${stored.title}`, reason: `Draft ${stored.id} awaits staff review; no branch or PR was created.` });
    notice = stripAgentToken(tr("ar").ownerNotified.replace("{id}", safeString(escalation.itemId, 160)));
  } catch { notice = tr("ar").ownerNotifyFailed; }
  return { ok: true as const, draft: safeDraft(stored, true), notice };
}

class GithubRequestError extends Error {
  readonly status: number;
  readonly responseMessage: string;
  constructor(status: number, responseMessage = "") { super(`GitHub API failed (${status}).`); this.status = status; this.responseMessage = stripAgentToken(responseMessage); }
}
function isPrPermissionDenied(error: unknown) {
  if (!error || (typeof error !== "object" && typeof error !== "function")) return false;
  const candidate = error as { message?: unknown; status?: unknown; statusCode?: unknown; responseMessage?: unknown };
  const explicitStatuses = [error instanceof GithubRequestError ? error.status : undefined, candidate.status, candidate.statusCode].filter((status): status is number => typeof status === "number");
  if (explicitStatuses.length) return explicitStatuses.every((status) => status === 403);
  const message = [candidate.message, candidate.responseMessage].filter((part): part is string => typeof part === "string").join(" ");
  // GitHub's permission wording (including "Resource not accessible by integration", "not accessible by integration", and "Forbidden") is optional; the 403 status alone is sufficient.
  return /\(403\)/.test(message);
}
async function gh<T>(repo: string, token: string, endpoint: string, init?: RequestInit): Promise<T> {
  const response = await (fetchOverride ?? fetch)(`https://api.github.com/repos/${repo}${endpoint}`, { ...init, headers: { accept: "application/vnd.github+json", authorization: `Bearer ${token}`, "x-github-api-version": "2022-11-28", ...(init?.body ? { "content-type": "application/json" } : {}) } });
  if (!response.ok) {
    let responseMessage = "";
    try { const body = await response.text(); const parsed = JSON.parse(body) as { message?: unknown }; responseMessage = typeof parsed.message === "string" ? parsed.message : body; } catch { /* The response body is optional diagnostic information. */ }
    throw new GithubRequestError(response.status, responseMessage);
  }
  return response.json() as Promise<T>;
}
function applyPatch(original: string, file: PatchFile) {
  const input = original.replace(/\r\n/g, "\n").split("\n"); if (input.at(-1) === "") input.pop(); const output: string[] = []; let pos = 0;
  for (let i = 0; i < file.lines.length; i++) if (file.lines[i].startsWith("@@")) {
    const m = /^@@ -(\d+)/.exec(file.lines[i])!; const start = Math.max(0, Number(m[1]) - 1); if (start < pos || start > input.length) throw Error("Patch range mismatch"); output.push(...input.slice(pos, start)); pos = start;
    for (i++; i < file.lines.length && !file.lines[i].startsWith("@@"); i++) { const l = file.lines[i]; if (l.startsWith("\\")) continue; if (l[0] === " ") { if (input[pos] !== l.slice(1)) throw Error("Patch context mismatch"); output.push(input[pos++]); } else if (l[0] === "-") { if (input[pos] !== l.slice(1)) throw Error("Patch content mismatch"); pos++; } else if (l[0] === "+") output.push(l.slice(1)); } i--;
  }
  output.push(...input.slice(pos)); return output.join("\n") + (original.endsWith("\n") ? "\n" : "");
}
async function saveDraft(id: string, transform: (d: TeamPrDraft) => TeamPrDraft) { const result = await updateJsonFile<Store>(PR_DRAFT_STORE, { records: [], webCalls: [], prDrafts: [], prDraftAudits: [] }, (db) => ({ ...db, prDrafts: (db.prDrafts ?? []).map((draft) => draft.id === id ? transform(draft) : draft) })); return (result.prDrafts ?? []).find((draft) => draft.id === id)!; }
function storedDraftGuard(draft: TeamPrDraft) {
  if (!draft || !TEAM_AGENT_IDS.includes(draft.agentId) || !isValidAgentDraftBranch(draft.agentId, draft.branch) || typeof draft.patch !== "string" || Buffer.byteLength(draft.patch, "utf8") > PR_DRAFT_PATCH_BYTES || containsSecret(draft.patch) || [draft.title, draft.summary, draft.rationale, draft.commitMessage, draft.branch, draft.id].some(containsSecret)) return false;
  if ([draft.commitMessage].some((value) => typeof value !== "string" || [...value].length > PR_DRAFT_COMMIT_LIMIT)) return false;
  const guarded = patchGuard(draft.patch, draft.files);
  return guarded.ok && guarded.additions === draft.additions && guarded.deletions === draft.deletions;
}
async function findOpenDraftPr(repo: string, token: string, draft: TeamPrDraft) {
  const owner = repo.split("/", 1)[0];
  const query = `?head=${encodeURIComponent(`${owner}:${draft.branch}`)}&base=${encodeURIComponent(PR_DEPLOY_BRANCH)}&state=open`;
  const found = await gh<GithubPr[]>(repo, token, `/pulls${query}`);
  const first = Array.isArray(found) ? found.find((pr) => typeof pr.number === "number" && typeof pr.html_url === "string") : undefined;
  return first ? { number: first.number as number, url: stripAgentToken(first.html_url as string) } : null;
}
async function appendPrDraftAudit(draft: TeamPrDraft) {
  await updateJsonFile<Store>(PR_DRAFT_STORE, { records: [], webCalls: [], prDrafts: [], prDraftAudits: [] }, (db) => ({ ...db, prDraftAudits: [...(db.prDraftAudits ?? []), { id: safeString(createId("pr-draft-audit"), 160), draftId: safeString(draft.id, 160), status: safeString(draft.status, 40), prUrl: draft.prUrl ? stripAgentToken(draft.prUrl) : undefined, prNumber: draft.prNumber, ci: safeString(draft.ci, 40), error: draft.error ? safeString(draft.error, 200) : undefined, createdAt: new Date().toISOString() }].slice(-PR_DRAFT_LIMIT) }));
}

async function createDraftPullRequestInternal(id: string) {
  if ((process.env.AGENT_PR_DRAFTS ?? "on").trim().toLowerCase() === "off") return { ok: false as const, status: 503, error: tr("en").disabled, errorAr: tr("ar").disabled };
  const token = process.env.GITHUB_AGENT_TOKEN?.trim(), repo = process.env.GITHUB_AGENT_REPO?.trim();
  if (!token || !repo || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) return { ok: false as const, status: 503, error: tr("en").notConfigured, errorAr: tr("ar").notConfigured };
  const draft = await getPrDraft(id);
  if (!draft) return { ok: false as const, status: 404, error: tr("en").notFound, errorAr: tr("ar").notFound };
  if (!storedDraftGuard(draft)) return { ok: false as const, status: 422, error: tr("en").invalidPatch, errorAr: tr("ar").invalidPatch };
  if (draft.status === "pr_open" && draft.prUrl) return { ok: true as const, draft: safeDraft(draft, true) };
  if (draft.status === "branch_pushed" && draft.compareUrl) return { ok: true as const, draft: safeDraft(draft, true), compareUrl: draft.compareUrl, notice: draft.notice ?? tr("ar").prPermissionNotice };
  try {
    if (draft.status === "failed") {
      const existing = await findOpenDraftPr(repo, token, draft);
      if (existing) {
        const recovered = await saveDraft(id, (current) => ({ ...current, status: "pr_open", prUrl: existing.url, prNumber: existing.number, ci: "pending", error: undefined }));
        await appendPrDraftAudit(recovered);
        return { ok: true as const, draft: safeDraft(recovered, true) };
      }
    }
    const ref = await gh<{ object: { sha: string } }>(repo, token, `/git/ref/heads/${PR_DEPLOY_BRANCH}`), baseSha = ref.object.sha;
    const baseCommit = await gh<{ tree: { sha: string } }>(repo, token, `/git/commits/${baseSha}`);
    const patchFiles = parsePatch(draft.patch), guarded = patchGuard(draft.patch, draft.files);
    if (!patchFiles || !guarded || patchFiles.length !== draft.files.length) throw Error("Patch guardrail mismatch");
    const entries: Array<{ path: string; mode: string; type: string; sha: string | null }> = [];
    for (const file of patchFiles) {
      let original = "";
      if (!file.lines.some((line) => line.startsWith("@@ -0,0"))) { const content = await gh<{ content: string; encoding: string }>(repo, token, `/contents/${file.path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(PR_DEPLOY_BRANCH)}`); original = content.encoding === "base64" ? Buffer.from(content.content.replace(/\n/g, ""), "base64").toString("utf8") : content.content; }
      const blob = await gh<{ sha: string }>(repo, token, "/git/blobs", { method: "POST", body: JSON.stringify({ content: applyPatch(original, file), encoding: "utf-8" }) });
      entries.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
    }
    await gh(repo, token, "/git/refs", { method: "POST", body: JSON.stringify({ ref: `refs/heads/${draft.branch}`, sha: baseSha }) });
    const tree = await gh<{ sha: string }>(repo, token, "/git/trees", { method: "POST", body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: entries }) });
    const commit = await gh<{ sha: string }>(repo, token, "/git/commits", { method: "POST", body: JSON.stringify({ message: draft.commitMessage, tree: tree.sha, parents: [baseSha] }) });
    await gh(repo, token, `/git/refs/heads/${draft.branch}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false }) });
    const body = `## Agent draft evidence\n\n- Files: ${draft.files.join(", ")}\n- Changes: +${draft.additions} / -${draft.deletions}\n- Guardrail verdict: ${safeString(draft.verdict, 300)}\n- CI: GitHub Actions CI is the source of truth. This action neither merges nor deploys.\n\n### Summary\n${safeString(draft.summary, 1_000)}\n\n### Agent rationale\n${safeString(draft.rationale, 1_200)}`;
    let pr: { html_url: string; number: number };
    try {
      pr = await gh<{ html_url: string; number: number }>(repo, token, "/pulls", { method: "POST", body: JSON.stringify({ title: `[${TEAM_AGENT_NAMES_AR[draft.agentId]}] ${safeString(draft.title, 180)}`, head: draft.branch, base: PR_DEPLOY_BRANCH, body }) });
    } catch (error) {
      // This catch is reached only after the branch ref and commit have both been pushed successfully.
      if (!isPrPermissionDenied(error)) throw error;
      const compareUrl = `https://github.com/${repo}/compare/${PR_DEPLOY_BRANCH}...${draft.branch}?expand=1`;
      const notice = tr("ar").prPermissionNotice;
      const pushed = await saveDraft(id, (current) => ({ ...current, status: "branch_pushed", compareUrl, notice, prUrl: undefined, prNumber: undefined, error: undefined }));
      await appendPrDraftAudit(pushed);
      return { ok: true as const, draft: safeDraft(pushed, true), compareUrl, notice };
    }
    if (typeof pr.html_url !== "string" || typeof pr.number !== "number") throw Error("GitHub returned an invalid PR.");
    const updated = await saveDraft(id, (current) => ({ ...current, status: "pr_open", prUrl: stripAgentToken(pr.html_url), prNumber: pr.number, ci: "pending", error: undefined }));
    await appendPrDraftAudit(updated);
    return { ok: true as const, draft: safeDraft(updated, true) };
  } catch (error) {
    const message = stripAgentToken(clean(error instanceof Error ? error.message : "GitHub error", 200));
    const updated = await saveDraft(id, (current) => ({ ...current, status: "failed", error: message }));
    await appendPrDraftAudit(updated);
    const status = error instanceof GithubRequestError && error.status === 429 ? 429 : 502;
    return { ok: false as const, status, error: tr("en").githubFailed, errorAr: tr("ar").githubFailed };
  }
}

export function createDraftPullRequest(id: string) {
  const prior = createLocks.get(id);
  if (prior) return prior;
  const pending = createDraftPullRequestInternal(id).finally(() => { if (createLocks.get(id) === pending) createLocks.delete(id); });
  createLocks.set(id, pending);
  return pending;
}
