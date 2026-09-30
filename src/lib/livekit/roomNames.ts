/** Pure room-name helpers (no server imports) — shared by API routes, stores and tests. */

const ROOM_RE = /[^a-zA-Z0-9_-]+/g;

export function sanitizeRoomName(raw: string) {
  const cleaned = raw.trim().replace(ROOM_RE, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return cleaned.slice(0, 64) || "demo";
}

export function isDemoRoom(roomName: string) {
  const n = sanitizeRoomName(roomName).toLowerCase();
  return n === "demo" || n.startsWith("demo-") || n === "practice";
}

export function classroomPath(roomId: string) {
  return `/live/classroom/${encodeURIComponent(sanitizeRoomName(roomId))}`;
}

/** Guest bookings are created without an account (`studentId = guest-…`). */
export function isGuestStudentId(studentId: string) {
  return studentId.startsWith("guest-") || studentId.startsWith("guest_");
}
