import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createId } from "@/lib/ids";
import type { LiveBooking, LiveSlot, LiveStoreData, BookingStatus } from "./types";

const dataDir = path.join(process.cwd(), "data");
const storePath = path.join(dataDir, "live-sessions.json");

function seedSlots(): LiveSlot[] {
  const slots: LiveSlot[] = [];
  const now = new Date();
  now.setUTCHours(13, 0, 0, 0);
  for (let day = 1; day <= 14; day += 1) {
    const date = new Date(now.getTime() + day * 24 * 60 * 60 * 1000);
    const weekday = date.getUTCDay();
    if (weekday === 0 || weekday === 5) continue;
    for (const hour of [13, 15, 17]) {
      const starts = new Date(date);
      starts.setUTCHours(hour, 0, 0, 0);
      slots.push({
        id: createId("slot"),
        startsAt: starts.toISOString(),
        durationMinutes: 45,
        capacity: 1,
        note: "1-on-1 with Prof. Munzer Haddara",
        createdAt: new Date().toISOString(),
      });
    }
  }
  return slots;
}

async function readLiveStore(): Promise<LiveStoreData> {
  await mkdir(dataDir, { recursive: true });
  try {
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<LiveStoreData>;
    const slots = Array.isArray(parsed.slots) ? parsed.slots : [];
    const bookings = Array.isArray(parsed.bookings) ? parsed.bookings : [];
    if (!slots.length) {
      const seeded = { slots: seedSlots(), bookings };
      await writeFile(storePath, JSON.stringify(seeded, null, 2), "utf8");
      return seeded;
    }
    return { slots, bookings };
  } catch {
    const initial = { slots: seedSlots(), bookings: [] as LiveBooking[] };
    await writeFile(storePath, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
}

async function writeLiveStore(store: LiveStoreData) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
}

export async function listSlots() {
  const store = await readLiveStore();
  return store.slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export async function listBookings(filter?: { studentId?: string }) {
  const store = await readLiveStore();
  const rows = filter?.studentId ? store.bookings.filter((item) => item.studentId === filter.studentId) : store.bookings;
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function availableSlots() {
  const store = await readLiveStore();
  const taken = new Map<string, number>();
  for (const booking of store.bookings) {
    if (booking.status === "cancelled") continue;
    taken.set(booking.slotId, (taken.get(booking.slotId) ?? 0) + 1);
  }
  const now = Date.now();
  return store.slots
    .filter((slot) => Date.parse(slot.startsAt) > now && (taken.get(slot.id) ?? 0) < slot.capacity)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export async function addSlot(input: { startsAt: string; durationMinutes?: number; capacity?: number; note?: string }) {
  const store = await readLiveStore();
  const slot: LiveSlot = {
    id: createId("slot"),
    startsAt: input.startsAt,
    durationMinutes: input.durationMinutes ?? 45,
    capacity: input.capacity ?? 1,
    note: input.note,
    createdAt: new Date().toISOString(),
  };
  store.slots.push(slot);
  await writeLiveStore(store);
  return slot;
}

export async function removeSlot(id: string) {
  const store = await readLiveStore();
  store.slots = store.slots.filter((item) => item.id !== id);
  await writeLiveStore(store);
}

export async function bookSlot(input: {
  slotId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
}) {
  const store = await readLiveStore();
  const slot = store.slots.find((item) => item.id === input.slotId);
  if (!slot) return { ok: false as const, error: "Slot not found.", errorAr: "الموعد غير موجود." };
  if (Date.parse(slot.startsAt) <= Date.now()) {
    return { ok: false as const, error: "That slot is in the past.", errorAr: "هذا الموعد مضى." };
  }
  const active = store.bookings.filter((item) => item.slotId === slot.id && item.status !== "cancelled");
  if (active.length >= slot.capacity) {
    return { ok: false as const, error: "This slot is already booked.", errorAr: "هذا الموعد محجوز." };
  }
  if (store.bookings.some((item) => item.studentId === input.studentId && item.slotId === slot.id && item.status !== "cancelled")) {
    return { ok: false as const, error: "You already booked this slot.", errorAr: "لقد حجزت هذا الموعد مسبقاً." };
  }
  const booking: LiveBooking = {
    id: createId("live"),
    slotId: slot.id,
    startsAt: slot.startsAt,
    durationMinutes: slot.durationMinutes,
    studentId: input.studentId,
    studentName: input.studentName,
    studentEmail: input.studentEmail,
    studentPhone: input.studentPhone,
    status: "requested",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.bookings.unshift(booking);
  await writeLiveStore(store);
  return { ok: true as const, booking };
}

export async function patchBooking(id: string, patch: { status?: BookingStatus; meetingLink?: string; teacherNote?: string }) {
  const store = await readLiveStore();
  const index = store.bookings.findIndex((item) => item.id === id);
  if (index < 0) return undefined;
  store.bookings[index] = {
    ...store.bookings[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await writeLiveStore(store);
  return store.bookings[index];
}
