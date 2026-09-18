import { readJsonFile, writeJsonFile } from "@/lib/dataDir";
import type { WhiteboardEquation, WhiteboardStroke } from "./protocol";
import { sanitizeRoomName } from "./rooms";

const FILE = "livekit-rooms.json";

export type ClassroomRoomState = {
  writers: string[];
  avAllowed: string[];
  ended: boolean;
  strokes: WhiteboardStroke[];
  equations: WhiteboardEquation[];
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
    updatedAt: new Date().toISOString(),
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
  return store.rooms[sanitizeRoomName(roomName)] ?? emptyRoom();
}

export async function patchClassroomRoom(
  roomName: string,
  patch: Partial<ClassroomRoomState>,
): Promise<ClassroomRoomState> {
  const key = sanitizeRoomName(roomName);
  const store = await readStore();
  const current = store.rooms[key] ?? emptyRoom();
  const next: ClassroomRoomState = {
    ...current,
    ...patch,
    writers: patch.writers ?? current.writers,
    avAllowed: patch.avAllowed ?? current.avAllowed,
    strokes: patch.strokes ?? current.strokes,
    equations: patch.equations ?? current.equations,
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
