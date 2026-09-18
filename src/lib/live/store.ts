import { readJsonFile, writeJsonFile } from "@/lib/dataDir";
import { createId } from "@/lib/ids";
import { createMeetingLink } from "./meeting";
import { addYmd, formatInTimeZone, wallTimeToUtc } from "./timezone";
import {
  DEFAULT_AVAILABILITY,
  type BookingStatus,
  type LiveBooking,
  type LiveSlot,
  type LiveStoreData,
  type TeacherAvailability,
} from "./types";

const STORE_FILE = "live-sessions.json";

export function generateSlotsFromAvailability(availability: TeacherAvailability, existing: LiveSlot[] = []): LiveSlot[] {
  const tz = availability.timezone || "Asia/Beirut";
  const duration = availability.durationMinutes || 45;
  const horizon = Math.max(7, availability.horizonDays || 21);
  const today = formatInTimeZone(new Date(), tz).date;
  const bookedTimes = new Set(existing.map((slot) => slot.startsAt));
  const slots: LiveSlot[] = [];
  const now = Date.now();

  for (let day = 0; day < horizon; day += 1) {
    const ymd = addYmd(today, day);
    const weekday = wallTimeToUtc(ymd, "12:00", tz);
    const wd = formatInTimeZone(weekday, tz).weekday;
    for (const window of availability.windows) {
      if (window.weekday !== wd) continue;
      let cursor = wallTimeToUtc(ymd, window.start, tz);
      const end = wallTimeToUtc(ymd, window.end, tz);
      while (cursor.getTime() + duration * 60_000 <= end.getTime() + 1000) {
        const startsAt = cursor.toISOString();
        if (cursor.getTime() > now && !bookedTimes.has(startsAt)) {
          slots.push({
            id: createId("slot"),
            startsAt,
            durationMinutes: duration,
            capacity: 1,
            note: "1-on-1 with Prof. Munzer Haddara · Asia/Beirut",
            createdAt: new Date().toISOString(),
          });
          bookedTimes.add(startsAt);
        }
        cursor = new Date(cursor.getTime() + duration * 60_000);
      }
    }
  }
  return slots;
}

function normalizeAvailability(value: Partial<TeacherAvailability> | undefined): TeacherAvailability {
  const windows = Array.isArray(value?.windows)
    ? value!.windows.filter(
        (item) =>
          item &&
          Number.isInteger(item.weekday) &&
          item.weekday >= 0 &&
          item.weekday <= 6 &&
          /^\d{2}:\d{2}$/.test(item.start) &&
          /^\d{2}:\d{2}$/.test(item.end),
      )
    : DEFAULT_AVAILABILITY.windows;
  return {
    timezone: value?.timezone?.trim() || DEFAULT_AVAILABILITY.timezone,
    durationMinutes: value?.durationMinutes || DEFAULT_AVAILABILITY.durationMinutes,
    horizonDays: value?.horizonDays || DEFAULT_AVAILABILITY.horizonDays,
    windows: windows.length ? windows : DEFAULT_AVAILABILITY.windows,
  };
}

async function readLiveStore(): Promise<LiveStoreData> {
  const availability = DEFAULT_AVAILABILITY;
  const initial: LiveStoreData = {
    slots: generateSlotsFromAvailability(availability),
    bookings: [],
    availability,
  };
  try {
    const parsed = await readJsonFile<Partial<LiveStoreData>>(STORE_FILE, initial);
    const bookings = Array.isArray(parsed.bookings) ? parsed.bookings : [];
    const nextAvailability = normalizeAvailability(parsed.availability);
    let slots = Array.isArray(parsed.slots) ? parsed.slots : [];
    if (!slots.length || !parsed.availability) {
      const generated = generateSlotsFromAvailability(
        nextAvailability,
        slots.filter((slot) => bookings.some((b) => b.slotId === slot.id && b.status !== "cancelled")),
      );
      const bookedIds = new Set(bookings.filter((item) => item.status !== "cancelled").map((item) => item.slotId));
      const keep = slots.filter((slot) => bookedIds.has(slot.id));
      slots = [...keep, ...generated];
      const next = { slots, bookings, availability: nextAvailability };
      await writeJsonFile(STORE_FILE, next);
      return next;
    }
    return { slots, bookings, availability: nextAvailability };
  } catch {
    await writeJsonFile(STORE_FILE, initial);
    return initial;
  }
}

async function writeLiveStore(store: LiveStoreData) {
  await writeJsonFile(STORE_FILE, store);
}

export async function getAvailability() {
  const store = await readLiveStore();
  return store.availability;
}

export async function setAvailability(input: Partial<TeacherAvailability>) {
  const store = await readLiveStore();
  const availability = normalizeAvailability({ ...store.availability, ...input, windows: input.windows ?? store.availability.windows });
  store.availability = availability;
  const bookedIds = new Set(store.bookings.filter((item) => item.status !== "cancelled").map((item) => item.slotId));
  const keepBooked = store.slots.filter((slot) => bookedIds.has(slot.id));
  const generated = generateSlotsFromAvailability(availability, keepBooked);
  store.slots = [...keepBooked, ...generated];
  await writeLiveStore(store);
  return store;
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
    durationMinutes: input.durationMinutes ?? store.availability.durationMinutes ?? 45,
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

  const bookingId = createId("live");
  const meeting = await createMeetingLink({
    id: bookingId,
    topic: `MathMentor live · ${input.studentName} · Prof. Munzer Haddara`,
    startsAt: slot.startsAt,
    durationMinutes: slot.durationMinutes,
  });

  const booking: LiveBooking = {
    id: bookingId,
    slotId: slot.id,
    startsAt: slot.startsAt,
    durationMinutes: slot.durationMinutes,
    studentId: input.studentId,
    studentName: input.studentName,
    studentEmail: input.studentEmail,
    studentPhone: input.studentPhone,
    status: "confirmed",
    meetingLink: meeting.url,
    meetingProvider: meeting.provider,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.bookings.unshift(booking);
  await writeLiveStore(store);
  return { ok: true as const, booking };
}

export async function patchBooking(
  id: string,
  patch: {
    status?: BookingStatus;
    meetingLink?: string;
    meetingProvider?: string;
    teacherNote?: string;
    reminderSentAt?: string;
  },
) {
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

export async function bookingsNeedingReminder(windowMin = 20, windowMax = 40) {
  const store = await readLiveStore();
  const now = Date.now();
  return store.bookings.filter((booking) => {
    if (booking.status === "cancelled" || booking.reminderSentAt) return false;
    const start = Date.parse(booking.startsAt);
    if (!Number.isFinite(start)) return false;
    const minutes = (start - now) / 60_000;
    return minutes >= windowMin && minutes <= windowMax;
  });
}
