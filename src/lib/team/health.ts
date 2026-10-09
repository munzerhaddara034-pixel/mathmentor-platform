import { createId } from "@/lib/ids";
import { createStagedApproval } from "@/lib/agent/approvalWorkflow";
import { readJsonFile, updateJsonFile } from "@/lib/dataDir";
import { redactSecrets } from "./secrets";
import { sendOwnerWhatsApp } from "./ownerWhatsApp";
import { TEAM_AGENT_IDS, type TeamAgentId } from "./types";

export const TEAM_MEMORY_LIMIT = 12;
export const TEAM_NOTES_LIMIT = 3_000;
export const TEAM_HEALTH_LIMIT = 240;

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

export type TeamHealthSnapshot = {
  records: TeamHealthRecord[];
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
  await updateJsonFile<{ records: TeamHealthRecord[] }>(TEAM_HEALTH_DOCUMENT, { records: [] }, (current) => ({
    records: [...(Array.isArray(current.records) ? current.records : []), saved].slice(-TEAM_HEALTH_LIMIT),
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

function emptyHealth(): { records: TeamHealthRecord[] } {
  return { records: [] };
}

export async function readTeamHealth(): Promise<TeamHealthSnapshot> {
  const stored = await readJsonFile<{ records?: TeamHealthRecord[] }>(TEAM_HEALTH_DOCUMENT, emptyHealth());
  const records = (Array.isArray(stored.records) ? stored.records.map(cleanRecord).filter((item): item is TeamHealthRecord => Boolean(item)) : []).slice(-TEAM_HEALTH_LIMIT);
  const memory = {} as Record<TeamAgentId, TeamAgentMemory>;
  for (const agent of TEAM_AGENT_IDS) memory[agent] = await loadTeamMemory(agent);
  return { records, memory };
}

export function medianDuration(records: TeamHealthRecord[]): number {
  const values = records.map((record) => record.durationMs).filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!values.length) return 0;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : Math.round((values[middle - 1] + values[middle]) / 2);
}
