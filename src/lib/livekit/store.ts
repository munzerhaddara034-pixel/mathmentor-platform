/**
 * Classroom room store — one JSON document per room (`livekit-room-<name>.json`), every
 * mutation through `updateJsonFile` (in-process lock + Postgres row lock when DATABASE_URL).
 * Rooms no longer share one document, so two classes never overwrite each other.
 */
import { readJsonFile, updateJsonFile } from "@/lib/dataDir";
import { sanitizeRoomName } from "./roomNames";
import {
  applyBoardOp,
  applyGrant,
  emptyRoom,
  endClass,
  normalizeRoom,
  reopenForTeacher,
  type BoardOp,
  type ClassroomRoomState,
} from "./roomState";

export type { ClassroomRoomState } from "./roomState";

/** Pre-2026-10 shared document; read once as a fallback for rooms not migrated yet. */
const LEGACY_FILE = "livekit-rooms.json";

function roomKey(roomName: string) {
  return `livekit-room-${sanitizeRoomName(roomName)}.json`;
}

async function legacyRoom(roomName: string): Promise<unknown> {
  try {
    const legacy = await readJsonFile<{ rooms?: Record<string, unknown> }>(LEGACY_FILE, { rooms: {} }, { persistFallback: false });
    return legacy.rooms?.[sanitizeRoomName(roomName)] ?? null;
  } catch {
    return null;
  }
}

export async function getClassroomRoom(roomName: string): Promise<ClassroomRoomState> {
  const raw = await readJsonFile<unknown>(roomKey(roomName), null, { persistFallback: false });
  return normalizeRoom(raw ?? (await legacyRoom(roomName)));
}

async function mutateRoom(
  roomName: string,
  mutate: (state: ClassroomRoomState) => ClassroomRoomState,
): Promise<ClassroomRoomState> {
  const seed = await getClassroomRoom(roomName);
  const stored = await updateJsonFile<unknown>(roomKey(roomName), seed, (current) => mutate(normalizeRoom(current ?? seed)));
  return normalizeRoom(stored);
}

export async function appendBoardOp(roomName: string, op: BoardOp): Promise<ClassroomRoomState> {
  return mutateRoom(roomName, (state) => applyBoardOp(state, op).state);
}

export async function grantInRoom(
  roomName: string,
  grant: { identity: string; canWriteBoard?: boolean; canPublishAv?: boolean },
): Promise<ClassroomRoomState> {
  return mutateRoom(roomName, (state) => applyGrant(state, grant));
}

export async function endClassroom(roomName: string): Promise<ClassroomRoomState> {
  return mutateRoom(roomName, (state) => endClass(state));
}

/** Clears `ended` when a teacher (re)joins; no write when the room is open. */
export async function reopenClassroomForTeacher(roomName: string): Promise<ClassroomRoomState> {
  const current = await getClassroomRoom(roomName);
  if (!current.ended) return current;
  return mutateRoom(roomName, (state) => reopenForTeacher(state).state);
}

export { emptyRoom };
