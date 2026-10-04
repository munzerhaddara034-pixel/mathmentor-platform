import { createId } from "@/lib/ids";
import { readJsonFile, writeJsonFile } from "@/lib/dataDir";
import { listPublicUsers } from "@/lib/auth/store";
import { isStaffRole } from "@/lib/auth/paths";

const FILE = "notifications.json";

export type NotificationKind =
  | "video_ready"
  | "live_upcoming"
  | "exam_uploaded"
  | "live_booked"
  | "exam_submitted"
  | "solver_issue"
  | "device_login"
  | "whish_payment"
  | "payment";

export type AppNotification = {
  id: string;
  userId: string;
  audience: "student" | "teacher";
  kind: NotificationKind;
  title: string;
  titleAr: string;
  body: string;
  bodyAr: string;
  href: string;
  relatedId?: string;
  read: boolean;
  createdAt: string;
};

type NotifStore = { notifications: AppNotification[] };

/** No demo notifications for demo users: the store starts empty. */
async function readNotifs(): Promise<NotifStore> {
  const data = await readJsonFile<NotifStore>(FILE, { notifications: [] });
  if (!Array.isArray(data.notifications)) return { notifications: [] };
  return data;
}

async function writeNotifs(store: NotifStore) {
  await writeJsonFile(FILE, store);
}

export async function listNotifications(userId: string) {
  const store = await readNotifs();
  return store.notifications
    .filter((item) => item.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function unreadCount(userId: string) {
  const rows = await listNotifications(userId);
  return rows.filter((item) => !item.read).length;
}

export async function pushNotification(input: Omit<AppNotification, "id" | "createdAt" | "read"> & { id?: string; read?: boolean }) {
  const store = await readNotifs();
  if (input.relatedId && store.notifications.some((item) => item.userId === input.userId && item.relatedId === input.relatedId && item.kind === input.kind)) {
    return store.notifications.find((item) => item.userId === input.userId && item.relatedId === input.relatedId && item.kind === input.kind)!;
  }
  const record: AppNotification = {
    ...input,
    id: input.id ?? createId("ntf"),
    read: input.read ?? false,
    createdAt: new Date().toISOString(),
  };
  store.notifications.unshift(record);
  await writeNotifs(store);
  return record;
}

export async function notifyStaff(input: Omit<AppNotification, "id" | "createdAt" | "read" | "userId" | "audience">) {
  const users = await listPublicUsers();
  const staff = users.filter((user) => isStaffRole(user.role));
  const created = [];
  for (const user of staff) {
    created.push(await pushNotification({ ...input, userId: user.id, audience: "teacher" }));
  }
  return created;
}

export async function markRead(id: string, userId: string) {
  const store = await readNotifs();
  const item = store.notifications.find((row) => row.id === id && row.userId === userId);
  if (!item) return undefined;
  item.read = true;
  await writeNotifs(store);
  return item;
}

export async function markAllRead(userId: string) {
  const store = await readNotifs();
  for (const item of store.notifications) {
    if (item.userId === userId) item.read = true;
  }
  await writeNotifs(store);
}

export async function seedIfNeeded() {
  await readNotifs();
}
