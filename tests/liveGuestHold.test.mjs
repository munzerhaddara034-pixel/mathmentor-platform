// Round 2 / item 6: unpaid / unconfirmed guest holds expire after LIVE_GUEST_HOLD_TTL_MINUTES (default 30).
import { test } from "node:test";
import assert from "node:assert/strict";

const live = await import("../src/lib/live/store.ts");
const MIN = 60_000;
const now = Date.parse("2026-10-05T12:00:00.000Z");
const booking = (over = {}) => ({
  id: "b1",
  slotId: "s1",
  startsAt: "2026-10-06T12:00:00.000Z",
  durationMinutes: 45,
  studentId: "guest-1",
  studentName: "G",
  studentEmail: "",
  studentPhone: "961",
  status: "pending_payment",
  paymentStatus: "pending",
  createdAt: new Date(now - 31 * MIN).toISOString(),
  updatedAt: new Date(now - 31 * MIN).toISOString(),
  ...over,
});

test("TTL: default 30 min, env override, 0 disables, garbage falls back to the default", () => {
  assert.equal(live.guestHoldTtlMs({}), 30 * MIN);
  assert.equal(live.guestHoldTtlMs({ LIVE_GUEST_HOLD_TTL_MINUTES: "45" }), 45 * MIN);
  assert.equal(live.guestHoldTtlMs({ LIVE_GUEST_HOLD_TTL_MINUTES: "0" }), 0);
  assert.equal(live.guestHoldTtlMs({ LIVE_GUEST_HOLD_TTL_MINUTES: "abc" }), 30 * MIN);
});

test("only stale, unpaid, unconfirmed GUEST holds expire", () => {
  const ttl = 30 * MIN;
  assert.equal(live.isExpiredGuestHold(booking(), now, ttl), true);
  assert.equal(live.isExpiredGuestHold(booking({ status: "requested" }), now, ttl), true);
  assert.equal(live.isExpiredGuestHold(booking({ createdAt: new Date(now - 29 * MIN).toISOString() }), now, ttl), false, "still fresh");
  assert.equal(live.isExpiredGuestHold(booking({ studentId: "user-1" }), now, ttl), false, "members are not auto-cancelled");
  assert.equal(live.isExpiredGuestHold(booking({ status: "confirmed" }), now, ttl), false);
  assert.equal(live.isExpiredGuestHold(booking({ paymentStatus: "paid" }), now, ttl), false);
  assert.equal(live.isExpiredGuestHold(booking({ studentMarkedPaidAt: "2026-10-05T11:40:00.000Z" }), now, ttl), false);
  assert.equal(live.isExpiredGuestHold(booking(), now, 0), false, "TTL 0 disables expiry");
});

test("expireGuestHolds cancels and stamps holdExpiredAt; untouched input is returned as-is", () => {
  const rows = [booking(), booking({ id: "b2", studentId: "user-2" })];
  const result = live.expireGuestHolds(rows, now, 30 * MIN);
  assert.equal(result.expired, 1);
  assert.equal(result.bookings[0].status, "cancelled");
  assert.equal(result.bookings[0].holdExpiredAt, new Date(now).toISOString());
  assert.equal(result.bookings[1], rows[1]);
  const none = [booking({ status: "confirmed" })];
  assert.equal(live.expireGuestHolds(none, now, 30 * MIN).bookings, none);
});
