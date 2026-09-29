import { readJsonFile, writeJsonFile } from "@/lib/dataDir";
import type { WhiteboardEquation, WhiteboardPlot, WhiteboardStroke } from "./protocol";
import { sanitizeRoomName } from "./rooms";

const FILE = "livekit-rooms.json";

export type ClassroomRoomState = {
  writers: string[];
  avAllowed: string[];
  ended: boolean;
  strokes: WhiteboardStroke[];
  equations: WhiteboardEquation[];
  plots: WhiteboardPlot[];
  updatedAt: string;
};

export type LivekitRoomStore = {
  rooms: Record<string, ClassroomRoomState>;
};

function emptyRoom(): ClassroomRoomState {
  return {
    writers: [],
    avAllowed: [],
    ended: false,
    strokes: [],
    equations: [],
    plots: [],
    updatedAt: new Date().toISOString(),
  };
}

function normalizeRoom(raw: Partial<ClassroomRoomState> | undefined): ClassroomRoomState {
  const base = emptyRoom();
  if (!raw) return base;
  return {
    writers: Array.isArray(raw.writers) ? raw.writers : base.writers,
    avAllowed: Array.isArray(raw.avAllowed) ? raw.avAllowed : base.avAllowed,
    ended: Boolean(raw.ended),
    strokes: Array.isArray(raw.strokes) ? raw.strokes : base.strokes,
    equations: Array.isArray(raw.equations) ? raw.equations : base.equations,
    plots: Array.isArray(raw.plots) ? raw.plots : base.plots,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : base.updatedAt,
  };
}

async function readStore(): Promise<LivekitRoomStore> {
  return readJsonFile<LivekitRoomStore>(FILE, { rooms: {} }, { persistFallback: false });
}

async function writeStore(store: LivekitRoomStore) {
  await writeJsonFile(FILE, store);
}

export async function getClassroomRoom(roomName: string): Promise<ClassroomRoomState> {
  const store = await readStore();
  return normalizeRoom(store.rooms[sanitizeRoomName(roomName)]);
}

export async function patchClassroomRoom(
  roomName: string,
  patch: Partial<ClassroomRoomState>,
): Promise<ClassroomRoomState> {
  const key = sanitizeRoomName(roomName);
  const store = await readStore();
  const current = normalizeRoom(store.rooms[key]);
  const next: ClassroomRoomState = {
    ...current,
    ...patch,
    writers: patch.writers ?? current.writers,
    avAllowed: patch.avAllowed ?? current.avAllowed,
    strokes: patch.strokes ?? current.strokes,
    equations: patch.equations ?? current.equations,
    plots: patch.plots ?? current.plots,
    updatedAt: new Date().toISOString(),
  };
  store.rooms[key] = next;
  await writeStore(store);
  return next;
}

export function toggleId(list: string[], identity: string, allowed: boolean) {
  const next = list.filter((item) => item !== identity);
  if (allowed) next.push(identity);
  return next;
}
