/**
 * File / Netlify Blobs JSON persistence for agent records.
 */

import { readJsonFile, writeJsonFile, withStoreLock } from "@/lib/dataDir";
import type {
  ActionReminder,
  AgentStoreSnapshot,
  ApprovalItem,
  MarketingCampaign,
  ParentDigest,
  PlatformHealthSnapshot,
  ScheduleAppointment,
  SchoolReport,
  SelfEvolutionSnapshot,
  WhatsAppVoiceTask,
} from "./types";

const FILE = "agent-ops.json";
const MAX_EACH = 80;

function emptyStore(): AgentStoreSnapshot {
  return {
    schoolReports: [],
    parentDigests: [],
    campaigns: [],
    voiceTasks: [],
    health: [],
    approvals: [],
    evolution: [],
    appointments: [],
    reminders: [],
  };
}

function normalize(raw: unknown): AgentStoreSnapshot {
  if (!raw || typeof raw !== "object") return emptyStore();
  const rec = raw as Partial<AgentStoreSnapshot>;
  return {
    schoolReports: Array.isArray(rec.schoolReports) ? rec.schoolReports : [],
    parentDigests: Array.isArray(rec.parentDigests) ? rec.parentDigests : [],
    campaigns: Array.isArray(rec.campaigns) ? rec.campaigns : [],
    voiceTasks: Array.isArray(rec.voiceTasks) ? rec.voiceTasks : [],
    health: Array.isArray(rec.health) ? rec.health : [],
    approvals: Array.isArray(rec.approvals) ? rec.approvals : [],
    evolution: Array.isArray(rec.evolution) ? rec.evolution : [],
    appointments: Array.isArray(rec.appointments) ? rec.appointments : [],
    reminders: Array.isArray(rec.reminders) ? rec.reminders : [],
  };
}

async function readStore(): Promise<AgentStoreSnapshot> {
  const data = await readJsonFile<AgentStoreSnapshot>(FILE, emptyStore());
  return normalize(data);
}

async function writeStore(store: AgentStoreSnapshot) {
  await writeJsonFile(FILE, store);
}

function trimList<T>(items: T[]): T[] {
  return items.slice(0, MAX_EACH);
}

export async function listSchoolReports(limit = 20): Promise<SchoolReport[]> {
  const store = await readStore();
  return store.schoolReports.slice(0, limit);
}

export async function listParentDigests(limit = 20): Promise<ParentDigest[]> {
  const store = await readStore();
  return store.parentDigests.slice(0, limit);
}

export async function listCampaigns(limit = 20): Promise<MarketingCampaign[]> {
  const store = await readStore();
  return store.campaigns.slice(0, limit);
}

export async function listVoiceTasks(limit = 30): Promise<WhatsAppVoiceTask[]> {
  const store = await readStore();
  return store.voiceTasks.slice(0, limit);
}

export async function latestHealth(): Promise<PlatformHealthSnapshot | null> {
  const store = await readStore();
  return store.health[0] ?? null;
}

export async function saveSchoolReport(report: SchoolReport): Promise<SchoolReport> {
  return withStoreLock(FILE, async () => {
    const store = await readStore();
    store.schoolReports = trimList([report, ...store.schoolReports.filter((r) => r.id !== report.id)]);
    await writeStore(store);
    return report;
  });
}

export async function saveParentDigest(digest: ParentDigest): Promise<ParentDigest> {
  return withStoreLock(FILE, async () => {
    const store = await readStore();
    store.parentDigests = trimList([digest, ...store.parentDigests.filter((d) => d.id !== digest.id)]);
    await writeStore(store);
    return digest;
  });
}

export async function saveCampaign(campaign: MarketingCampaign): Promise<MarketingCampaign> {
  return withStoreLock(FILE, async () => {
    const store = await readStore();
    store.campaigns = trimList([campaign, ...store.campaigns.filter((c) => c.id !== campaign.id)]);
    await writeStore(store);
    return campaign;
  });
}

export async function getCampaign(id: string): Promise<MarketingCampaign | undefined> {
  const store = await readStore();
  return store.campaigns.find((c) => c.id === id || c.heygenJobId === id || c.heygenVideoId === id);
}

export async function patchCampaign(
  id: string,
  patch: Partial<MarketingCampaign>,
): Promise<MarketingCampaign | undefined> {
  return withStoreLock(FILE, async () => {
    const store = await readStore();
    const idx = store.campaigns.findIndex(
      (c) => c.id === id || c.heygenJobId === id || c.heygenVideoId === id,
    );
    if (idx < 0) return undefined;
    const updated: MarketingCampaign = {
      ...store.campaigns[idx],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    store.campaigns[idx] = updated;
    await writeStore(store);
    return updated;
  });
}

export async function saveVoiceTask(task: WhatsAppVoiceTask): Promise<WhatsAppVoiceTask> {
  return withStoreLock(FILE, async () => {
    const store = await readStore();
    store.voiceTasks = trimList([task, ...store.voiceTasks.filter((t) => t.id !== task.id)]);
    await writeStore(store);
    return task;
  });
}

export async function getVoiceTask(id: string): Promise<WhatsAppVoiceTask | undefined> {
  const store = await readStore();
  return store.voiceTasks.find((t) => t.id === id);
}

export async function patchVoiceTask(
  id: string,
  patch: Partial<WhatsAppVoiceTask>,
): Promise<WhatsAppVoiceTask | undefined> {
  return withStoreLock(FILE, async () => {
    const store = await readStore();
    const idx = store.voiceTasks.findIndex((t) => t.id === id);
    const now = new Date().toISOString();
    if (idx < 0) {
      // Upsert when closing stuck hub tasks that raced out of Blobs.
      if (!patch.id && !id) return undefined;
      const created: WhatsAppVoiceTask = {
        id,
        audioLog: patch.audioLog ?? { receivedAt: now },
        whisperTranscript: patch.whisperTranscript ?? "",
        transcriptSource: patch.transcriptSource ?? "typed",
        transcriptWarning: patch.transcriptWarning,
        intent: patch.intent ?? {
          kind: "general_task",
          confidence: 0.5,
          parameters: {},
          source: "heuristic",
        },
        status: patch.status ?? "completed",
        automatedReplyText: patch.automatedReplyText ?? "",
        relatedIds: patch.relatedIds ?? [],
        outboundWhatsApp: patch.outboundWhatsApp,
        createdAt: patch.createdAt ?? now,
        updatedAt: now,
      };
      store.voiceTasks = trimList([created, ...store.voiceTasks]);
      await writeStore(store);
      return created;
    }
    const updated: WhatsAppVoiceTask = {
      ...store.voiceTasks[idx],
      ...patch,
      id,
      updatedAt: now,
    };
    store.voiceTasks[idx] = updated;
    await writeStore(store);
    return updated;
  });
}

export async function saveHealth(snapshot: PlatformHealthSnapshot): Promise<PlatformHealthSnapshot> {
  return withStoreLock(FILE, async () => {
    const store = await readStore();
    store.health = trimList([snapshot, ...store.health]);
    await writeStore(store);
    return snapshot;
  });
}

export async function agentOverview() {
  const store = await readStore();
  return {
    schoolReports: store.schoolReports.slice(0, 8),
    parentDigests: store.parentDigests.slice(0, 8),
    campaigns: store.campaigns.slice(0, 8),
    voiceTasks: store.voiceTasks.slice(0, 12),
    health: store.health[0] ?? null,
    approvals: store.approvals.slice(0, 20),
    evolution: store.evolution[0] ?? null,
    appointments: store.appointments.slice(0, 30),
    reminders: store.reminders.slice(0, 30),
  };
}

export async function listApprovalItems(limit = 30): Promise<ApprovalItem[]> {
  const store = await readStore();
  return store.approvals.slice(0, limit);
}

export async function getApprovalItem(id: string): Promise<ApprovalItem | undefined> {
  const store = await readStore();
  return store.approvals.find((a) => a.id === id);
}

export async function saveApprovalItem(item: ApprovalItem): Promise<ApprovalItem> {
  return withStoreLock(FILE, async () => {
    const store = await readStore();
    store.approvals = trimList([item, ...store.approvals.filter((a) => a.id !== item.id)]);
    await writeStore(store);
    return item;
  });
}

export async function saveEvolutionSnapshot(
  snapshot: SelfEvolutionSnapshot,
): Promise<SelfEvolutionSnapshot> {
  return withStoreLock(FILE, async () => {
    const store = await readStore();
    store.evolution = trimList([snapshot, ...store.evolution]);
    await writeStore(store);
    return snapshot;
  });
}

export async function latestEvolution(): Promise<SelfEvolutionSnapshot | null> {
  const store = await readStore();
  return store.evolution[0] ?? null;
}

export async function listAppointments(limit = 40): Promise<ScheduleAppointment[]> {
  const store = await readStore();
  return store.appointments.slice(0, limit);
}

export async function saveAppointment(appointment: ScheduleAppointment): Promise<ScheduleAppointment> {
  return withStoreLock(FILE, async () => {
    const store = await readStore();
    store.appointments = trimList([
      appointment,
      ...store.appointments.filter((a) => a.id !== appointment.id),
    ]);
    await writeStore(store);
    return appointment;
  });
}

export async function listReminders(limit = 40): Promise<ActionReminder[]> {
  const store = await readStore();
  return store.reminders.slice(0, limit);
}

export async function saveReminder(reminder: ActionReminder): Promise<ActionReminder> {
  return withStoreLock(FILE, async () => {
    const store = await readStore();
    store.reminders = trimList([
      reminder,
      ...store.reminders.filter((r) => r.id !== reminder.id),
    ]);
    await writeStore(store);
    return reminder;
  });
}

export type SecretaryAgenda = {
  appointments: ScheduleAppointment[];
  reminders: ActionReminder[];
};

/** Pending/scheduled appointments + open reminders, soonest first. */
export async function listSecretaryAgenda(limit = 40): Promise<SecretaryAgenda> {
  const store = await readStore();
  const appointments = store.appointments
    .filter((a) => a.status === "scheduled" || a.status === "pending")
    .sort((a, b) => a.dateTime.localeCompare(b.dateTime))
    .slice(0, limit);
  const reminders = store.reminders
    .filter((r) => r.status === "open")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, limit);
  return { appointments, reminders };
}
