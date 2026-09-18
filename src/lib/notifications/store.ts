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
  | "device_login";

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

function seed(): AppNotification[] {
  const now = Date.now();
  const iso = (minsAgo: number) => new Date(now - minsAgo * 60_000).toISOString();
  return [
    {
      id: "ntf-seed-video",
      userId: "user-demo-student",
      audience: "student",
      kind: "video_ready",
      title: "AI video explanation ready",
      titleAr: "شرح الفيديو جاهز",
      body: "Your avatar explanation for the last solver question is ready to watch.",
      bodyAr: "شرح الفيديو لسؤال الحلّال الأخير جاهز للمشاهدة.",
      href: "/math-solver",
      read: false,
      createdAt: iso(40),
    },
    {
      id: "ntf-seed-live",
      userId: "user-demo-student",
      audience: "student",
      kind: "live_upcoming",
      title: "Live session in 15 minutes",
      titleAr: "حصة مباشرة بعد 15 دقيقة",
      body: "Prof. Munzer Haddara — join from /live.",
      bodyAr: "الأستاذ منذر حداره — ادخل من صفحة المباشر.",
      href: "/live",
      read: false,
      createdAt: iso(8),
    },
    {
      id: "ntf-seed-exam",
      userId: "user-demo-student",
      audience: "student",
      kind: "exam_uploaded",
      title: "New official exam papers",
      titleAr: "نماذج امتحان رسمية جديدة",
      body: "Brevet and Terminale LS/GS/SE simulators are open.",
      bodyAr: "محاكاة المتوسطة والثانوية (علوم حياة / عامة / اقتصاد) متاحة.",
      href: "/exams",
      read: false,
      createdAt: iso(120),
    },
    {
      id: "ntf-seed-book",
      userId: "user-demo-teacher",
      audience: "teacher",
      kind: "live_booked",
      title: "Student booked a live session",
      titleAr: "طالب حجز حصة مباشرة",
      body: "Sara Nassar booked a 1-on-1 slot.",
      bodyAr: "سارة نصار حجزت حصة فردية.",
      href: "/live",
      read: false,
      createdAt: iso(25),
    },
    {
      id: "ntf-seed-submit",
      userId: "user-demo-teacher",
      audience: "teacher",
      kind: "exam_submitted",
      title: "Exam submitted for review",
      titleAr: "امتحان أُرسل للمراجعة",
      body: "A Brevet simulation was graded against the barème.",
      bodyAr: "تم تصحيح محاكاة المتوسطة وفق السلّم.",
      href: "/admin/exams",
      read: false,
      createdAt: iso(15),
    },
    {
      id: "ntf-seed-issue",
      userId: "user-demo-teacher",
      audience: "teacher",
      kind: "solver_issue",
      title: "Issue reported on an AI solution",
      titleAr: "بلاغ على حلّ الذكاء",
      body: "A student marked a solver explanation as incorrect.",
      bodyAr: "طالب وضّح أن شرح الحلّال غير صحيح.",
      href: "/admin",
      read: false,
      createdAt: iso(55),
    },
  ];
}

async function readNotifs(): Promise<NotifStore> {
  const data = await readJsonFile<NotifStore>(FILE, { notifications: seed() });
  if (!Array.isArray(data.notifications) || data.notifications.length === 0) {
    const seeded = { notifications: seed() };
    await writeJsonFile(FILE, seeded);
    return seeded;
  }
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
