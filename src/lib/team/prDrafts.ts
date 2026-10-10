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
export type TeamPrDraft = { id: string; agent: TeamAgentId; agentId: TeamAgentId; title: string; summary: string; rationale: string; patch: string; branch: string; files: string[]; additions: number; deletions: number; commitMessage: string; verdict: string; status: "draft" | "pr_open" | "failed"; createdAt: string; prUrl?: string; prNumber?: number; ci: "unknown" | "pending"; error?: string };
type Store = { records?: unknown[]; webCalls?: unknown[]; prDrafts?: TeamPrDraft[]; prDraftAudits?: Array<{ id: string; draftId: string; status: string; prUrl?: string; prNumber?: number; ci: string; error?: string; createdAt: string }> };
type PatchFile = { path: string; lines: string[]; additions: number; deletions: number };
let fetchOverride: typeof fetch | undefined;
let escalationOverride: typeof escalateTeamAgent | undefined;
export function setPrDraftTestOverrides(input: { fetchImpl?: typeof fetch; escalate?: typeof escalateTeamAgent } = {}) { fetchOverride = input.fetchImpl; escalationOverride = input.escalate; }
export function resetPrDraftTestState() { fetchOverride = undefined; escalationOverride = undefined; }
const tr = (locale: "ar" | "en" | "fr" = "ar") => teamMessages[locale].prDrafts;
const clean = (s: unknown, n: number) => redactSecrets(typeof s === "string" ? s : "").text.replace(/[\u0000-\u001f]/g, "").trim().slice(0, n);
function fail(key: keyof typeof teamMessages.en.prDrafts) { return { ok: false as const, reason: tr("en")[key], reasonAr: tr("ar")[key] }; }
function allowedPath(path: string) {
  const p = path.replace(/^\//, "");
  if (!p || p.includes("\\") || p.split("/").some((x) => x === ".." || x === ".")) return false;
  if (/(^|\/)(\.env[^/]*|package\.json|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|npm-shrinkwrap\.json|[^/]*\.lock(?:\.[^/]*)?)(\/|$)/i.test(p)) return false;
  if (/^(?:src\/lib\/(?:auth|db|security)|data|migrations)(?:\/|$)/.test(p)) return false;
  if (["src/middleware.ts", "middleware.ts"].includes(p) || /^next\.config\.[^/]+$/i.test(p)) return false;
  return p === "README.md" || /^(?:src|tests|docs|scripts|public)\/[A-Za-z0-9._/-]+$/.test(p);
}
function parsePatch(patch: string): PatchFile[] | null {
  const out: PatchFile[] = []; let current: PatchFile | undefined;
  for (const line of patch.replace(/\r\n/g, "\n").split("\n")) {
    if (line.startsWith("diff --git ")) { const m = /^diff --git a\/(.+) b\/(.+)$/.exec(line); if (!m || m[1] !== m[2]) return null; current = { path: m[2], lines: [], additions: 0, deletions: 0 }; out.push(current); }
    else if (line.startsWith("--- ")) { if (!current || !(line === "--- /dev/null" || line === `--- a/${current.path}`)) return null; }
    else if (line.startsWith("+++ ")) { if (!current || !(line === "+++ /dev/null" || line === `+++ b/${current.path}`)) return null; }
    else if (line.startsWith("@@")) { if (!current || !/^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/.test(line)) return null; current.lines.push(line); }
    else if (/^[ +\\-]/.test(line)) { if (!current) return null; current.lines.push(line); if (line.startsWith("+")) current.additions++; if (line.startsWith("-")) current.deletions++; }
    else if (line && !/^(?:index |new file mode |deleted file mode |\ No newline)/.test(line)) return null;
  }
  return out.length && new Set(out.map((f) => f.path)).size === out.length && out.every((f) => f.lines.some((l) => l.startsWith("@@"))) ? out : null;
}
export function isValidAgentDraftBranch(agentId: string, branch: string): boolean {
  return TEAM_AGENT_IDS.includes(agentId as TeamAgentId) && branch === `agent/${agentId}-${branch.slice(`agent/${agentId}-`.length)}` && /^agent\/[a-z0-9_-]+-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(branch) && !["main", "master", PR_DEPLOY_BRANCH].includes(branch);
}
function slug(s: string) { return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 45).replace(/-$/, "") || "change"; }
async function store() { return readJsonFile<Store>(PR_DRAFT_STORE, { records: [], webCalls: [], prDrafts: [] }); }
export async function listPrDrafts() { return ((await store()).prDrafts ?? []).slice(-PR_DRAFT_LIMIT).map(({ patch, ...d }) => d); }
export async function getPrDraft(id: string) { return ((await store()).prDrafts ?? []).find((d) => d.id === id) ?? null; }
export async function draftPullRequest(input: { agentId: string; title: string; summary: string; rationale: string; patch: string; files: string[]; commitMessage?: string }) {
  if ((process.env.AGENT_PR_DRAFTS ?? "on").toLowerCase() === "off") return fail("disabled");
  if (!TEAM_AGENT_IDS.includes(input.agentId as TeamAgentId)) return fail("invalidAgent");
  const patch = typeof input.patch === "string" ? input.patch : "";
  if (Buffer.byteLength(patch) > PR_DRAFT_PATCH_BYTES) return fail("patchTooLarge");
  if (redactSecrets(patch).text !== patch) return fail("secretInPatch");
  const parsed = parsePatch(patch); const files = Array.isArray(input.files) ? [...new Set(input.files.filter((x): x is string => typeof x === "string").map((x) => x.trim()))] : [];
  if (!clean(input.title, 180) || !clean(input.summary, 1000) || !clean(input.rationale, 1200) || !files.length || !patch) return fail("missingFields");
  if (!parsed || parsed.length !== files.length || parsed.some((f) => !files.includes(f.path))) return fail("invalidPatch");
  if (files.length > PR_DRAFT_FILE_LIMIT) return fail("tooManyFiles");
  if (parsed.some((f) => !allowedPath(f.path))) return fail("forbiddenPath");
  const additions = parsed.reduce((n, f) => n + f.additions, 0), deletions = parsed.reduce((n, f) => n + f.deletions, 0);
  if (additions + deletions > PR_DRAFT_LINE_LIMIT) return fail("tooManyLines");
  if (input.commitMessage && input.commitMessage.length > PR_DRAFT_COMMIT_LIMIT) return fail("commitTooLong");
  const title = clean(input.title, 180), branch = `agent/${input.agentId}-${slug(title)}`;
  if (!isValidAgentDraftBranch(input.agentId, branch)) return fail("invalidBranch");
  const now = new Date(), cutoff = now.getTime() - 86400000, capN = Number(process.env.AGENT_PR_DRAFTS_MAX_PER_DAY), cap = Number.isFinite(capN) ? Math.max(0, Math.min(100, Math.floor(capN))) : 5;
  let item: TeamPrDraft | null = null;
  try { await updateJsonFile<Store>(PR_DRAFT_STORE, { records: [], webCalls: [], prDrafts: [] }, (db) => {
    const rows = db.prDrafts ?? []; if (rows.filter((d) => d.agentId === input.agentId && Date.parse(d.createdAt) > cutoff).length >= cap) throw new Error("limit");
    item = { id: createId("pr-draft"), agent: input.agentId as TeamAgentId, agentId: input.agentId as TeamAgentId, title, summary: clean(input.summary, 1000), rationale: clean(input.rationale, 1200), patch, branch, files, additions, deletions, commitMessage: clean(input.commitMessage || `${title} (${input.agentId})`, 200), verdict: "PASS — allowed paths, patch/file/line caps, branch and daily budget", status: "draft", createdAt: now.toISOString(), ci: "unknown" };
    return { ...db, prDrafts: [...rows, item].slice(-PR_DRAFT_LIMIT) };
  }); } catch (e) { if (String(e).includes("limit")) return fail("dailyLimit"); throw e; }
  let notice: string; try { const escalation = await (escalationOverride ?? escalateTeamAgent)({ agent: item!.agentId, intent: `PR draft: ${item!.title}`, reason: `Draft ${item!.id} awaits staff review; no branch or PR was created.` }); notice = tr("ar").ownerNotified.replace("{id}", escalation.itemId); } catch { notice = tr("ar").ownerNotifyFailed; }
  return { ok: true as const, draft: item!, notice };
}
async function gh<T>(repo: string, token: string, endpoint: string, init?: RequestInit): Promise<T> {
  const response = await (fetchOverride ?? fetch)(`https://api.github.com/repos/${repo}${endpoint}`, { ...init, headers: { accept: "application/vnd.github+json", authorization: `Bearer ${token}`, "x-github-api-version": "2022-11-28", ...(init?.body ? { "content-type": "application/json" } : {}) } });
  if (!response.ok) throw new Error(`GitHub API failed (${response.status}).`); return response.json() as Promise<T>;
}
function applyPatch(original: string, file: PatchFile) {
  const input = original.replace(/\r\n/g, "\n").split("\n"); if (input.at(-1) === "") input.pop(); const output: string[] = []; let pos = 0;
  for (let i = 0; i < file.lines.length; i++) if (file.lines[i].startsWith("@@")) {
    const m = /^@@ -(\d+)/.exec(file.lines[i])!; const start = Math.max(0, Number(m[1]) - 1); if (start < pos || start > input.length) throw Error("Patch range mismatch"); output.push(...input.slice(pos, start)); pos = start;
    for (i++; i < file.lines.length && !file.lines[i].startsWith("@@"); i++) { const l = file.lines[i]; if (l.startsWith("\\")) continue; if (l[0] === " ") { if (input[pos] !== l.slice(1)) throw Error("Patch context mismatch"); output.push(input[pos++]); } else if (l[0] === "-") { if (input[pos] !== l.slice(1)) throw Error("Patch content mismatch"); pos++; } else if (l[0] === "+") output.push(l.slice(1)); } i--;
  }
  output.push(...input.slice(pos)); return output.join("\n") + (original.endsWith("\n") ? "\n" : "");
}
async function saveDraft(id: string, transform: (d: TeamPrDraft) => TeamPrDraft) { const result = await updateJsonFile<Store>(PR_DRAFT_STORE, { records: [], webCalls: [], prDrafts: [] }, (db) => ({ ...db, prDrafts: (db.prDrafts ?? []).map((d) => d.id === id ? transform(d) : d) })); return (result.prDrafts ?? []).find((d) => d.id === id)!; }
export async function createDraftPullRequest(id: string) {
  if ((process.env.AGENT_PR_DRAFTS ?? "on").trim().toLowerCase() === "off") return { ok: false as const, status: 503, error: tr("en").disabled, errorAr: tr("ar").disabled };
  const token = process.env.GITHUB_AGENT_TOKEN?.trim(), repo = process.env.GITHUB_AGENT_REPO?.trim();
  if (!token || !repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return { ok: false as const, status: 503, error: tr("en").notConfigured, errorAr: tr("ar").notConfigured };
  const draft = await getPrDraft(id); if (!draft) return { ok: false as const, status: 404, error: tr("en").notFound, errorAr: tr("ar").notFound };
  if (draft.status === "pr_open" && draft.prUrl) return { ok: true as const, draft };
  try {
    const ref = await gh<{ object: { sha: string } }>(repo, token, `/git/ref/heads/${PR_DEPLOY_BRANCH}`), baseSha = ref.object.sha;
    const baseCommit = await gh<{ tree: { sha: string } }>(repo, token, `/git/commits/${baseSha}`);
    const patchFiles = parsePatch(draft.patch); if (!patchFiles || patchFiles.length !== draft.files.length || patchFiles.some((f) => !allowedPath(f.path))) throw Error("Patch guardrail mismatch");
    const entries: Array<{ path: string; mode: string; type: string; sha: string | null }> = [];
    for (const file of patchFiles) {
      let original = "";
      if (!file.lines.some((line) => line.startsWith("@@ -0,0"))) { const c = await gh<{ content: string; encoding: string }>(repo, token, `/contents/${file.path.split("/").map(encodeURIComponent).join("/")}?ref=${PR_DEPLOY_BRANCH}`); original = c.encoding === "base64" ? Buffer.from(c.content.replace(/\n/g, ""), "base64").toString("utf8") : c.content; }
      if (file.lines.some((line) => line === "+++ /dev/null")) entries.push({ path: file.path, mode: "100644", type: "blob", sha: null }); else { const blob = await gh<{ sha: string }>(repo, token, "/git/blobs", { method: "POST", body: JSON.stringify({ content: applyPatch(original, file), encoding: "utf-8" }) }); entries.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha }); }
    }
    await gh(repo, token, "/git/refs", { method: "POST", body: JSON.stringify({ ref: `refs/heads/${draft.branch}`, sha: baseSha }) });
    const tree = await gh<{ sha: string }>(repo, token, "/git/trees", { method: "POST", body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: entries }) });
    const commit = await gh<{ sha: string }>(repo, token, "/git/commits", { method: "POST", body: JSON.stringify({ message: draft.commitMessage, tree: tree.sha, parents: [baseSha] }) });
    await gh(repo, token, `/git/refs/heads/${draft.branch}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false }) });
    const body = `## Agent draft evidence\n\n- Files: ${draft.files.join(", ")}\n- Changes: +${draft.additions} / -${draft.deletions}\n- Guardrail verdict: ${draft.verdict}\n- CI: GitHub Actions CI is the source of truth. This action neither merges nor deploys.\n\n### Summary\n${draft.summary}\n\n### Agent rationale\n${draft.rationale}`;
    const pr = await gh<{ html_url: string; number: number }>(repo, token, "/pulls", { method: "POST", body: JSON.stringify({ title: `[${TEAM_AGENT_NAMES_AR[draft.agentId]}] ${draft.title}`, head: draft.branch, base: PR_DEPLOY_BRANCH, body }) });
    const updated = await saveDraft(id, (d) => ({ ...d, status: "pr_open", prUrl: pr.html_url, prNumber: pr.number, ci: "pending", error: undefined }));
    await appendPrDraftAudit(updated);
    return { ok: true as const, draft: updated };
  } catch (e) { const updated = await saveDraft(id, (d) => ({ ...d, status: "failed", error: clean(e instanceof Error ? e.message : "GitHub error", 200).replaceAll(token, "[redacted]") })); await appendPrDraftAudit(updated); return { ok: false as const, status: 502, error: tr("en").githubFailed, errorAr: tr("ar").githubFailed }; }
}

async function appendPrDraftAudit(draft: TeamPrDraft) {
  await updateJsonFile<Store>(PR_DRAFT_STORE, { records: [], webCalls: [], prDrafts: [], prDraftAudits: [] }, (db) => ({ ...db, prDraftAudits: [...(db.prDraftAudits ?? []), { id: createId("pr-draft-audit"), draftId: draft.id, status: draft.status, prUrl: draft.prUrl, prNumber: draft.prNumber, ci: draft.ci, error: draft.error, createdAt: new Date().toISOString() }].slice(-PR_DRAFT_LIMIT) }));
}
