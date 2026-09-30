// Live classroom: access rules, guest join links, ended reset, board deltas, stroke thinning/chunking.
// Run: npm test   (Node >= 22.18 strips TypeScript types natively.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { bookingAllowsJoin, decideClassroomAccess, decideGuestAccess } from "../src/lib/livekit/accessRules.ts";
import { joinExpiryFor, liveJoinSecret, signJoinToken, verifyJoinToken } from "../src/lib/livekit/joinToken.ts";
import {
  applyBoardOp,
  applyGrant,
  boardDelta,
  emptyRoom,
  endClass,
  normalizeRoom,
  parseSince,
  reopenForTeacher,
  sinceFromEtag,
  roomEtag,
} from "../src/lib/livekit/roomState.ts";
import {
  chunkStroke,
  compactPoints,
  compactStroke,
  sanitizeStroke,
  simplifyPoints,
  StrokeAssembler,
  STROKE_CHUNK_MAX_BYTES,
  utf8Bytes,
} from "../src/lib/livekit/strokeCodec.ts";
import { applyBoardDelta, emptyBoard } from "../src/lib/livekit/boardMerge.ts";

const booking = (over = {}) => ({
  id: "live-abc123",
  studentId: "user-1",
  status: "confirmed",
  paymentStatus: "paid",
  classroomRoomId: "live-abc123",
  ...over,
});
const base = { staff: false, wantTeacher: false, liveTier: false, roomName: "live-abc123", userId: "user-1" };

// ── Access ────────────────────────────────────────────────────────────────────
test("paid confirmed booking grants its room without a LIVE subscription", () => {
  const access = decideClassroomAccess({ ...base, bookings: [booking()] });
  assert.deepEqual(access, { ok: true, isTeacher: false, bookingId: "live-abc123" });
});

test("pending_payment / pending / failed never grant access (402)", () => {
  for (const over of [
    { status: "pending_payment", paymentStatus: "pending" },
    { status: "confirmed", paymentStatus: "pending" },
    { status: "confirmed", paymentStatus: "failed" },
  ]) {
    const access = decideClassroomAccess({ ...base, liveTier: true, bookings: [booking(over)] });
    assert.equal(access.ok, false);
    assert.equal(access.ok === false && access.status, 402, JSON.stringify(over));
  }
});

test("confirmed booking without a payment flow (staff-created / Whish off) grants access", () => {
  assert.equal(bookingAllowsJoin({ status: "confirmed", paymentStatus: "none" }).ok, true);
  assert.equal(bookingAllowsJoin({ status: "confirmed" }).ok, true);
  assert.equal(bookingAllowsJoin({ status: "requested", paymentStatus: "none" }).ok, false);
  assert.equal(bookingAllowsJoin({ status: "cancelled", paymentStatus: "paid" }).ok, false);
});

test("another user's paid booking does not grant the room", () => {
  const access = decideClassroomAccess({ ...base, userId: "user-2", liveTier: true, bookings: [booking()] });
  assert.equal(access.ok, false);
  assert.equal(access.ok === false && access.status, 403);
});

test("a cancelled duplicate does not hide a paid booking for the same room", () => {
  const access = decideClassroomAccess({ ...base, bookings: [booking({ status: "cancelled" }), booking()] });
  assert.equal(access.ok, true);
});

test("demo room needs LIVE tier; staff always allowed; teacher tokens need staff", () => {
  assert.equal(decideClassroomAccess({ ...base, roomName: "demo", bookings: [] }).ok, false);
  assert.equal(decideClassroomAccess({ ...base, roomName: "demo", liveTier: true, bookings: [] }).ok, true);
  assert.deepEqual(decideClassroomAccess({ ...base, staff: true, wantTeacher: true, bookings: [] }), { ok: true, isTeacher: true });
  const denied = decideClassroomAccess({ ...base, wantTeacher: true, liveTier: true, bookings: [booking()] });
  assert.equal(denied.ok === false && denied.status, 403);
});

test("LIVE tier alone does not open someone else's booking room", () => {
  const access = decideClassroomAccess({ ...base, liveTier: true, bookings: [] });
  assert.equal(access.ok, false);
});

// ── Guest links ───────────────────────────────────────────────────────────────
const SECRET = "test-secret-0123456789abcdef";

test("guest join token: round trip, tamper, expiry, missing secret", () => {
  const now = Date.parse("2026-10-01T10:00:00Z");
  const expiresAt = now + 3_600_000;
  const token = signJoinToken({ bookingId: "live-g1", studentId: "guest-xyz", expiresAt }, SECRET);
  const ok = verifyJoinToken(token, SECRET, now);
  assert.deepEqual(ok, { ok: true, bookingId: "live-g1", studentId: "guest-xyz", expiresAt });

  const [payload, sig] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ b: "live-other", s: "guest-xyz", e: expiresAt })).toString("base64url");
  assert.equal(verifyJoinToken(`${forged}.${sig}`, SECRET, now).ok, false);
  assert.equal(verifyJoinToken(`${payload}.${sig.slice(0, -2)}xx`, SECRET, now).ok, false);
  assert.deepEqual(verifyJoinToken(token, "another-secret-0123456789", now), { ok: false, reason: "bad_signature" });
  assert.deepEqual(verifyJoinToken(token, SECRET, expiresAt + 1), { ok: false, reason: "expired" });
  assert.deepEqual(verifyJoinToken(token, null, now), { ok: false, reason: "no_secret" });
  assert.deepEqual(verifyJoinToken("garbage", SECRET, now), { ok: false, reason: "malformed" });
});

test("join secret: LIVE_JOIN_SECRET, then AGENT_WEBHOOK_SECRET, min 16 chars", () => {
  assert.equal(liveJoinSecret({ LIVE_JOIN_SECRET: "x".repeat(16), AGENT_WEBHOOK_SECRET: "y".repeat(20) }), "x".repeat(16));
  assert.equal(liveJoinSecret({ AGENT_WEBHOOK_SECRET: "y".repeat(20) }), "y".repeat(20));
  assert.equal(liveJoinSecret({ AGENT_WEBHOOK_SECRET: "short" }), null);
  assert.equal(liveJoinSecret({}), null);
});

test("guest link expires after session end + grace", () => {
  const exp = joinExpiryFor({ startsAt: "2026-10-01T13:00:00.000Z", durationMinutes: 45 });
  assert.equal(exp, Date.parse("2026-10-01T13:00:00.000Z") + (45 + 120) * 60_000);
});

test("guest access is tied to the booking, its room and payment", () => {
  const guestBooking = booking({ id: "live-g1", classroomRoomId: "live-g1", studentId: "guest-xyz" });
  const input = { roomName: "live-g1", tokenBookingId: "live-g1", tokenStudentId: "guest-xyz", booking: guestBooking };
  assert.equal(decideGuestAccess(input).ok, true);
  assert.equal(decideGuestAccess({ ...input, roomName: "live-other" }).ok, false);
  assert.equal(decideGuestAccess({ ...input, tokenStudentId: "guest-other" }).ok, false);
  assert.equal(decideGuestAccess({ ...input, booking: null }).ok, false);
  const pending = decideGuestAccess({ ...input, booking: { ...guestBooking, status: "pending_payment", paymentStatus: "pending" } });
  assert.equal(pending.ok === false && pending.status, 402);
});

// ── Room state: ended reset, grants, deltas ───────────────────────────────────
const T = "2026-10-01T10:00:00.000Z";
const stroke = (id, n = 3) => ({
  id,
  color: "#10213d",
  width: 3.2,
  authorId: "teacher",
  points: Array.from({ length: n }, (_, i) => ({ x: i / (n + 1), y: 0.5 })),
});

test("teacher rejoin clears `ended`; open rooms are untouched", () => {
  const ended = endClass(emptyRoom(T), T);
  assert.equal(ended.ended, true);
  const { state, reopened } = reopenForTeacher(ended, T);
  assert.equal(reopened, true);
  assert.equal(state.ended, false);
  assert.ok(state.version > ended.version, "reopen bumps version so pollers see it");
  const again = reopenForTeacher(state, T);
  assert.equal(again.reopened, false);
  assert.equal(again.state, state);
});

test("ending a class revokes AV grants; grants bump version", () => {
  let s = applyGrant(emptyRoom(T), { identity: "stu", canPublishAv: true, canWriteBoard: true }, T);
  assert.deepEqual(s.avAllowed, ["stu"]);
  assert.deepEqual(s.writers, ["stu"]);
  s = endClass(s, T);
  assert.deepEqual(s.avAllowed, []);
  assert.deepEqual(s.writers, ["stu"]);
});

test("append-only ops, idempotent ids, since-deltas, 304 and clear", () => {
  let s = emptyRoom(T);
  s = applyBoardOp(s, { kind: "stroke", stroke: stroke("a") }, T).state;
  s = applyBoardOp(s, { kind: "stroke", stroke: stroke("b") }, T).state;
  const dup = applyBoardOp(s, { kind: "stroke", stroke: stroke("b") }, T);
  assert.equal(dup.changed, false);
  assert.equal(s.version, 2);

  assert.equal(boardDelta(s, 2), null, "unchanged → 304");
  const d1 = boardDelta(s, 1);
  assert.equal(d1.full, false);
  assert.deepEqual(d1.strokes.map((x) => x.id), ["b"]);
  assert.equal("seq" in d1.strokes[0], false, "server seq is not sent");
  const full = boardDelta(s, null);
  assert.equal(full.full, true);
  assert.equal(full.strokes.length, 2);

  s = applyBoardOp(s, { kind: "clear" }, T).state;
  const afterClear = boardDelta(s, 2);
  assert.equal(afterClear.full, true, "a clear forces a full reload for older clients");
  assert.equal(afterClear.strokes.length, 0);
  assert.equal(boardDelta(s, 99).full, true, "future version (store reset) → full");
});

test("client applies partial + full deltas", () => {
  let local = emptyBoard();
  local = applyBoardDelta(local, { full: true, version: 2, strokes: [stroke("a"), stroke("b")], equations: [], plots: [], writers: [], avAllowed: [], ended: false, updatedAt: T });
  local = { ...local, strokes: [...local.strokes, stroke("mine")] };
  local = applyBoardDelta(local, { full: false, version: 3, strokes: [stroke("b"), stroke("c")], equations: [], plots: [], writers: ["stu"], avAllowed: [], ended: false, updatedAt: T });
  assert.deepEqual(local.strokes.map((x) => x.id), ["a", "b", "mine", "c"]);
  assert.deepEqual(local.writers, ["stu"]);
  local = applyBoardDelta(local, { full: true, version: 4, strokes: [], equations: [], plots: [], writers: [], avAllowed: [], ended: true, updatedAt: T });
  assert.equal(local.strokes.length, 0);
  assert.equal(local.ended, true);
  local = applyBoardDelta(local, { full: false, version: 5, strokes: [], equations: [], plots: [], writers: [], avAllowed: [], ended: false, updatedAt: T });
  assert.equal(local.ended, false, "reopen propagates (ended is not sticky)");
});

test("legacy stored rooms normalise with seq/version; since/etag parsing", () => {
  const legacy = normalizeRoom({ writers: ["x"], ended: true, strokes: [stroke("a"), stroke("b")], equations: [], plots: [] }, T);
  assert.equal(legacy.version, 2);
  assert.deepEqual(legacy.strokes.map((x) => x.seq), [1, 2]);
  assert.equal(legacy.ended, true);
  assert.equal(parseSince("7"), 7);
  assert.equal(parseSince("-1"), null);
  assert.equal(parseSince(null), null);
  assert.equal(sinceFromEtag(roomEtag({ version: 12 })), 12);
});

// ── Strokes: rounding, thinning, chunking ─────────────────────────────────────
function wobblyStroke(id, n) {
  const points = [];
  for (let i = 0; i < n; i += 1) points.push({ x: 0.05 + (i % 250) * 0.0035 + Math.random() * 1e-9, y: 0.5 + Math.sin(i / 8) * 0.04 });
  return { id, color: "#10213d", width: 3.2, authorId: "teacher", points };
}

test("rounding to 3 decimals + RDP thinning shrinks strokes and keeps endpoints", () => {
  const raw = wobblyStroke("w", 700);
  const compact = compactStroke(raw);
  assert.ok(compact.points.length < raw.points.length / 2, `${compact.points.length} of ${raw.points.length}`);
  for (const p of compact.points) {
    assert.equal(Math.round(p.x * 1000) / 1000, p.x);
    assert.equal(Math.round(p.y * 1000) / 1000, p.y);
  }
  assert.deepEqual(compact.points[0], { x: 0.05, y: 0.5 });
  const rawBytes = utf8Bytes(JSON.stringify(raw));
  const compactBytes = utf8Bytes(JSON.stringify(compact));
  assert.ok(compactBytes * 4 < rawBytes, `raw ${rawBytes} B → compact ${compactBytes} B`);
});

test("RDP collapses a straight line to its endpoints; short input unchanged", () => {
  const line = Array.from({ length: 50 }, (_, i) => ({ x: i / 49, y: i / 49 }));
  assert.equal(simplifyPoints(line).length, 2);
  assert.deepEqual(simplifyPoints([{ x: 0, y: 0 }]), [{ x: 0, y: 0 }]);
  assert.equal(compactPoints([{ x: 0.1, y: 0.1 }, { x: 0.1, y: 0.1 }, { x: 0.1, y: 0.1 }]).length, 1);
});

test("chunks stay under the LiveKit 15 KiB reliable limit and reassemble exactly", () => {
  const big = { id: "big", color: "#9a3412", width: 3.2, authorId: "t", points: Array.from({ length: 3000 }, (_, i) => ({ x: (i % 997) / 997, y: ((i * 7) % 991) / 991 })) };
  const chunks = chunkStroke(big);
  assert.ok(chunks.length > 1);
  for (const c of chunks) assert.ok(utf8Bytes(JSON.stringify(c)) <= STROKE_CHUNK_MAX_BYTES, `chunk ${utf8Bytes(JSON.stringify(c))} B`);
  assert.ok(STROKE_CHUNK_MAX_BYTES < 15 * 1024);

  const assembler = new StrokeAssembler();
  const shuffled = [...chunks].reverse();
  let result = null;
  for (const c of shuffled) result = assembler.add(c) ?? result;
  assert.deepEqual(result, big);
  assert.equal(assembler.size, 0);

  const small = compactStroke(wobblyStroke("s", 80));
  assert.equal(chunkStroke(small).length, 1);
});

test("assembler ignores bad indices and duplicate chunks", () => {
  const assembler = new StrokeAssembler();
  const [c0, c1] = chunkStroke({ id: "x", color: "#000", width: 2, authorId: "a", points: Array.from({ length: 900 }, (_, i) => ({ x: i / 900, y: 0.123456 })) }, 4000);
  assert.equal(assembler.add({ ...c0, index: 9 }), null);
  assert.equal(assembler.add(c0), null);
  assert.equal(assembler.add(c0), null);
  assert.ok(c1);
});

test("sanitizeStroke rejects junk and compacts valid input", () => {
  assert.equal(sanitizeStroke(null, "a"), null);
  assert.equal(sanitizeStroke({ id: "bad id!", color: "#000", width: 2, points: [] }, "a"), null);
  assert.equal(sanitizeStroke({ id: "s1", color: "red;", width: 2, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }, "a"), null);
  assert.equal(sanitizeStroke({ id: "s1", color: "#000", width: 2, points: [{ x: "0", y: 0 }, { x: 1, y: 1 }] }, "a"), null);
  const ok = sanitizeStroke({ id: "s1", color: "#000", width: 2, authorId: "spoofed", points: [{ x: 0.12345, y: 2 }, { x: 0.5, y: 0.5 }] }, "real");
  assert.deepEqual(ok, { id: "s1", color: "#000", width: 2, authorId: "real", points: [{ x: 0.123, y: 1 }, { x: 0.5, y: 0.5 }] });
});
