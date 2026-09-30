/** File fallback for the team chat (data/team-chat.json + data/team-uploads/*) when DATABASE_URL is unset. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { platformDataDir, readJsonFile, withStoreLock, writeJsonFile } from "@/lib/dataDir";
import type { TeamRepo } from "./repo";
import type { TeamAttachmentRef, TeamMessage, TeamProposal } from "./types";

const FILE = "team-chat.json";
const MAX_MESSAGES = 2000;

type TeamFileStore = {
  messages: TeamMessage[];
  proposals: TeamProposal[];
  attachments: TeamAttachmentRef[];
};

function empty(): TeamFileStore {
  return { messages: [], proposals: [], attachments: [] };
}

async function readStore(): Promise<TeamFileStore> {
  const raw = await readJsonFile<Partial<TeamFileStore>>(FILE, empty());
  return {
    messages: Array.isArray(raw.messages) ? raw.messages : [],
    proposals: Array.isArray(raw.proposals) ? raw.proposals : [],
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
  };
}

async function mutate<T>(fn: (store: TeamFileStore) => T): Promise<T> {
  return withStoreLock(FILE, async () => {
    const store = await readStore();
    const value = fn(store);
    if (store.messages.length > MAX_MESSAGES) store.messages = store.messages.slice(-MAX_MESSAGES);
    await writeJsonFile(FILE, store);
    return value;
  });
}

function uploadsDir() {
  return path.join(platformDataDir(), "team-uploads");
}

function safeId(id: string) {
  return id.replace(/[^A-Za-z0-9_-]/g, "");
}

export const fileTeamRepo: TeamRepo = {
  kind: "file",
  async listMessages(channel, limit) {
    const store = await readStore();
    return store.messages.filter((message) => message.channel === channel).slice(-limit);
  },
  async getMessage(id) {
    const store = await readStore();
    return store.messages.find((message) => message.id === id);
  },
  async addMessage(message) {
    await mutate((store) => {
      store.messages.push(message);
    });
  },
  async saveAttachment(meta, bytes) {
    await mkdir(uploadsDir(), { recursive: true });
    await writeFile(path.join(uploadsDir(), safeId(meta.id)), bytes);
    await mutate((store) => {
      store.attachments.push(meta);
    });
  },
  async getAttachment(id) {
    const store = await readStore();
    const meta = store.attachments.find((item) => item.id === id);
    if (!meta) return undefined;
    try {
      const bytes = await readFile(path.join(uploadsDir(), safeId(id)));
      return { meta, bytes };
    } catch {
      return undefined;
    }
  },
  async saveProposal(proposal) {
    await mutate((store) => {
      const index = store.proposals.findIndex((item) => item.id === proposal.id);
      if (index >= 0) store.proposals[index] = proposal;
      else store.proposals.push(proposal);
    });
  },
  async getProposal(id) {
    const store = await readStore();
    return store.proposals.find((item) => item.id === id);
  },
  async listProposals(ids) {
    const store = await readStore();
    return store.proposals.filter((item) => ids.includes(item.id));
  },
  async transitionProposal(id, from, patch) {
    return mutate((store) => {
      const index = store.proposals.findIndex((item) => item.id === id);
      if (index < 0) return undefined;
      const current = store.proposals[index];
      if (!from.includes(current.status)) return undefined;
      const next: TeamProposal = { ...current, ...patch, updatedAt: new Date().toISOString() };
      store.proposals[index] = next;
      return next;
    });
  },
};
