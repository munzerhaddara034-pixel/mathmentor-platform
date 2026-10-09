import { createId } from "@/lib/ids";
import { createStagedApproval } from "@/lib/agent/approvalWorkflow";
import { readJsonFile, updateJsonFile } from "@/lib/dataDir";
import { redactSecrets } from "./secrets";
import { sendOwnerWhatsApp } from "./ownerWhatsApp";
import { TEAM_AGENT_IDS, type TeamAgentId } from "./types";

export const TEAM_MEMORY_LIMIT = 12;
export const TEAM_NOTES_LIMIT = 3_000;
export const TEAM_HEALTH_LIMIT = 240;
export const TEAM_WEB_AUDIT_LIMIT = 240;

export type TeamMemorySummary = {
  at: string;
  intent: string;
  outcome: "success" | "failed";
  summary: string;
  verified: boolean;
  tools: string[];
};

export type TeamAgentMemory = {
  agent: TeamAgentId;
  notes: string;
  summaries: TeamMemorySummary[];
};

export type TeamHealthRecord = {
  id: string;
  agent: TeamAgentId;
  intent: string;
  tools: string[];
  outcome: "success" | "failed";
  durationMs: number;
  verified: boolean;
  escalation: boolean;
  failure?: string;
  createdAt: string;
};

export type TeamWebAuditRecord = {
  id: string;
  agent: TeamAgentId | "unknown";
  query: string;
  resultCount: number;
  durationMs: number;
  ok: boolean;
  failureReason?: string;
  createdAt: string;
};

export type TeamHealthSnapshot = {
  records: TeamHealthRecord[];
  webCalls: TeamWebAuditRecord[];
  memory: Record<TeamAgentId, TeamAgentMemory>;
};

const EMPTY_MEMORY = (agent: TeamAgentId): TeamAgentMemory => ({ agent, notes: "", summaries: [] });

export function memoryDocumentName(agent: TeamAgentId): string {
  return `team-memory-${agent}.json`;
}

export const TEAM_HEALTH_DOCUMENT = "team-agent-health.json";

function clean(value: string, max: number): string {
  return redactSecrets(value).text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
}

function cleanTools(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((tool): tool is string => typeof tool === "string").map((tool) => clean(tool, 80)).filter(Boolean))].slice(0, 12)
    : [];
}

function cleanSummary(value: unknown): TeamMemorySummary | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<TeamMemorySummary>;
  if (typeof item.at !== "string" || typeof item.intent !== "string" || typeof item.summary !== "string") return null;
  return {
    at: clean(item.at, 40),
    intent: clean(item.intent, 180),
    outcome: item.outcome === "success" ? "success" : "failed",
    summary: clean(item.summary, 500),
    verified: item.verified === true,
    tools: cleanTools(item.tools),
  };
}

function cleanRecord(value: unknown): TeamHealthRecord | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<TeamHealthRecord>;
  if (!TEAM_AGENT_IDS.includes(item.agent as TeamAgentId) || typeof item.intent !== "string") return null;
  return {
    id: clean(typeof item.id === "string" ? item.id : createId("team-health"), 80),
    agent: item.agent as TeamAgentId,
    intent: clean(item.intent, 180),
    tools: cleanTools(item.tools),
    outcome: item.outcome === "success" ? "success" : "failed",
    durationMs: Number.isFinite(item.durationMs) ? Math.max(0, Math.min(900_000, Number(item.durationMs))) : 0,
    verified: item.verified === true,
    escalation: item.escalation === true,
    failure: typeof item.failure === "string" ? clean(item.failure, 300) : undefined,
    createdAt: clean(typeof item.createdAt === "string" ? item.createdAt : new Date(0).toISOString(), 40),
  };
}

function cleanWebAudit(value: unknown): TeamWebAuditRecord | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<TeamWebAuditRecord>;
  if ((!TEAM_AGENT_IDS.includes(item.agent as TeamAgentId) && item.agent !== "unknown") || typeof item.query !== "string") return null;
  return {
    id: clean(typeof item.id === "string" ? item.id : createId("team-web"), 80),
    agent: item.agent as TeamAgentId | "unknown",
    query: clean(item.query, 180),
    resultCount: Number.isFinite(item.resultCount) ? Math.max(0, Math.min(5, Math.floor(Number(item.resultCount)))) : 0,
    durationMs: Number.isFinite(item.durationMs) ? Math.max(0, Math.min(900_000, Number(item.durationMs))) : 0,
    ok: item.ok === true,
    failureReason: typeof item.failureReason === "string" ? clean(item.failureReason, 180) : undefined,
    createdAt: clean(typeof item.createdAt === "string" ? item.createdAt : new Date(0).toISOString(), 40),
  };
}

export async function loadTeamMemory(agent: TeamAgentId): Promise<TeamAgentMemory> {
  const memory = await readJsonFile<TeamAgentMemory>(memoryDocumentName(agent), EMPTY_MEMORY(agent));
  return {
    agent,
    notes: clean(typeof memory.notes === "string" ? memory.notes : "", TEAM_NOTES_LIMIT),
    summaries: (Array.isArray(memory.summaries) ? memory.summaries.map(cleanSummary).filter((item): item is TeamMemorySummary => Boolean(item)) : []).slice(-TEAM_MEMORY_LIMIT),
  };
}

export async function saveTeamMemory(input: {
  agent: TeamAgentId;
  intent: string;
  summary: string;
  tools: string[];
  outcome: "success" | "failed";
  verified: boolean;
  notes?: string;
}): Promise<TeamAgentMemory> {
  const now = new Date().toISOString();
  return updateJsonFile<TeamAgentMemory>(memoryDocumentName(input.agent), EMPTY_MEMORY(input.agent), (current) => {
    const nextSummary: TeamMemorySummary = {
      at: now,
      intent: clean(input.intent, 180),
      outcome: input.outcome,
      summary: clean(input.summary, 500),
      verified: input.verified,
      tools: [...new Set(input.tools.map((tool) => clean(tool, 80)).filter(Boolean))].slice(0, 12),
    };
    const noteText = input.notes === undefined ? clean(current.notes, TEAM_NOTES_LIMIT) : clean(input.notes, TEAM_NOTES_LIMIT);
    return {
      agent: input.agent,
      notes: noteText,
      summaries: [...(Array.isArray(current.summaries) ? current.summaries : []), nextSummary].slice(-TEAM_MEMORY_LIMIT),
    };
  });
}

export async function recordTeamHealth(record: Omit<TeamHealthRecord, "id" | "createdAt">): Promise<TeamHealthRecord> {
  const saved: TeamHealthRecord = {
    id: createId("team-health"),
    agent: record.agent,
    intent: clean(record.intent, 180),
    tools: cleanTools(record.tools),
    outcome: record.outcome === "success" ? "success" : "failed",
    durationMs: Number.isFinite(record.durationMs) ? Math.max(0, Math.min(900_000, record.durationMs)) : 0,
    verified: record.verified === true,
    escalation: record.escalation === true,
    failure: record.failure ? clean(record.failure, 300) : undefined,
    createdAt: new Date().toISOString(),
  };
  await updateJsonFile<{ records: TeamHealthRecord[]; webCalls?: TeamWebAuditRecord[] }>(TEAM_HEALTH_DOCUMENT, { records: [], webCalls: [] }, (current) => ({
    records: [...(Array.isArray(current.records) ? current.records : []), saved].slice(-TEAM_HEALTH_LIMIT),
    webCalls: (Array.isArray(current.webCalls) ? current.webCalls.map(cleanWebAudit).filter((item): item is TeamWebAuditRecord => Boolean(item)) : []).slice(-TEAM_WEB_AUDIT_LIMIT),
  }));
  return saved;
}

export async function recordTeamWebAudit(record: Omit<TeamWebAuditRecord, "id" | "createdAt">): Promise<TeamWebAuditRecord> {
  const saved: TeamWebAuditRecord = {
    id: createId("team-web"),
    agent: record.agent,
    query: clean(record.query, 180),
    resultCount: Number.isFinite(record.resultCount) ? Math.max(0, Math.min(5, Math.floor(record.resultCount))) : 0,
    durationMs: Number.isFinite(record.durationMs) ? Math.max(0, Math.min(900_000, record.durationMs)) : 0,
    ok: record.ok === true,
    failureReason: record.failureReason ? clean(record.failureReason, 180) : undefined,
    createdAt: new Date().toISOString(),
  };
  await updateJsonFile<{ records: TeamHealthRecord[]; webCalls?: TeamWebAuditRecord[] }>(TEAM_HEALTH_DOCUMENT, { records: [], webCalls: [] }, (current) => ({
    records: (Array.isArray(current.records) ? current.records : []).slice(-TEAM_HEALTH_LIMIT),
    webCalls: [...(Array.isArray(current.webCalls) ? current.webCalls.map(cleanWebAudit).filter((item): item is TeamWebAuditRecord => Boolean(item)) : []), saved].slice(-TEAM_WEB_AUDIT_LIMIT),
  }));
  return saved;
}

export async function escalateTeamAgent(input: {
  agent: TeamAgentId;
  intent: string;
  reason: string;
}): Promise<{ itemId: string; whatsapp: string }> {
  const reason = clean(input.reason, 700);
  const titleAr = `تصعيد ${input.agent}: قرار أو مراجعة مطلوبة`;
  const previewAr = `الوكيل ${input.agent} متوقف بصدق ولم يعتمد النتيجة.\nالطلب: ${clean(input.intent, 400)}\nالسبب: ${reason}\nالمطلوب من منذر: مراجعة واتخاذ القرار.`;
  const staged = await createStagedApproval({
    kind: "general",
    titleAr,
    titleEn: `Team agent escalation: ${input.agent}`,
    previewAr,
    previewEn: `Agent ${input.agent} needs an owner decision. ${reason}`,
    payload: { agent: input.agent, intent: clean(input.intent, 400), reason },
    notifyWhatsApp: false,
  });
  const notification = await sendOwnerWhatsApp({ text: `⚠️ تصعيد صريح من ${input.agent}:\n${previewAr}\nالمعرّف: ${staged.item.id}` });
  return { itemId: staged.item.id, whatsapp: notification.detailAr };
}

function emptyHealth(): { records: TeamHealthRecord[]; webCalls: TeamWebAuditRecord[] } {
  return { records: [], webCalls: [] };
}

export async function readTeamHealth(): Promise<TeamHealthSnapshot> {
  const stored = await readJsonFile<{ records?: TeamHealthRecord[]; webCalls?: TeamWebAuditRecord[] }>(TEAM_HEALTH_DOCUMENT, emptyHealth());
  const records = (Array.isArray(stored.records) ? stored.records.map(cleanRecord).filter((item): item is TeamHealthRecord => Boolean(item)) : []).slice(-TEAM_HEALTH_LIMIT);
  const webCalls = (Array.isArray(stored.webCalls) ? stored.webCalls.map(cleanWebAudit).filter((item): item is TeamWebAuditRecord => Boolean(item)) : []).slice(-TEAM_WEB_AUDIT_LIMIT);
  const memory = {} as Record<TeamAgentId, TeamAgentMemory>;
  for (const agent of TEAM_AGENT_IDS) memory[agent] = await loadTeamMemory(agent);
  return { records, webCalls, memory };
}

export function medianDuration(records: TeamHealthRecord[]): number {
  const values = records.map((record) => record.durationMs).filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!values.length) return 0;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : Math.round((values[middle - 1] + values[middle]) / 2);
}
