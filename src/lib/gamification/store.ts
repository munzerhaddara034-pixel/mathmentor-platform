import { createId } from "@/lib/ids";
import { readJsonFile, writeJsonFile } from "@/lib/dataDir";
import { formatInTimeZone, BEIRUT_TZ } from "@/lib/live/timezone";
import { listPublicUsers } from "@/lib/auth/store";

const FILE = "gamification.json";

export type ActivityKind = "lesson" | "solver" | "exam" | "quiz";

export type BadgeId = "calculus-master" | "probability-pro" | "brevet-champ" | "streak-7" | "first-solve";

export type StudentGamification = {
  userId: string;
  name: string;
  streakDays: number;
  lastActivityDate: string;
  xp: number;
  monthlyXp: Record<string, number>;
  badges: BadgeId[];
  topicXp: Record<string, number>;
};

type GameStore = { profiles: StudentGamification[] };

export const BADGE_META: Record<BadgeId, { title: string; titleAr: string; blurb: string }> = {
  "calculus-master": { title: "Calculus Master", titleAr: "سيد التفاضل", blurb: "High XP on functions / derivatives." },
  "probability-pro": { title: "Probability Pro", titleAr: "خبير الاحتمال", blurb: "Scored well on probability items." },
  "brevet-champ": { title: "Brevet Champ", titleAr: "بطل المتوسطة", blurb: "Strong Brevet exam simulation." },
  "streak-7": { title: "7-day flame", titleAr: "سبعة أيام متتالية", blurb: "Studied 7 calendar days in a row (Beirut)." },
  "first-solve": { title: "First solve", titleAr: "أول حلّ", blurb: "Submitted an AI solver question." },
};

const XP: Record<ActivityKind, number> = {
  lesson: 20,
  solver: 15,
  exam: 0,
  quiz: 10,
};

function monthKey(date = new Date()) {
  const { date: ymd } = formatInTimeZone(date, BEIRUT_TZ);
  return ymd.slice(0, 7);
}

function todayBeirut(date = new Date()) {
  return formatInTimeZone(date, BEIRUT_TZ).date;
}

function addDays(ymd: string, days: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function emptyProfile(userId: string, name: string): StudentGamification {
  return {
    userId,
    name,
    streakDays: 0,
    lastActivityDate: "",
    xp: 0,
    monthlyXp: {},
    badges: [],
    topicXp: {},
  };
}

function seedProfiles(): StudentGamification[] {
  const month = monthKey();
  return [
    {
      userId: "user-demo-student",
      name: "Sara Nassar",
      streakDays: 7,
      lastActivityDate: todayBeirut(),
      xp: 480,
      monthlyXp: { [month]: 320 },
      badges: ["calculus-master", "probability-pro", "brevet-champ", "streak-7", "first-solve"],
      topicXp: { calculus: 120, probability: 80, brevet: 90 },
    },
    {
      userId: "user-demo-ai",
      name: "Nour Khalil",
      streakDays: 3,
      lastActivityDate: todayBeirut(),
      xp: 210,
      monthlyXp: { [month]: 140 },
      badges: ["first-solve", "calculus-master"],
      topicXp: { calculus: 70 },
    },
    {
      userId: "user-demo-live",
      name: "Hassan Mansour",
      streakDays: 1,
      lastActivityDate: todayBeirut(),
      xp: 80,
      monthlyXp: { [month]: 40 },
      badges: [],
      topicXp: {},
    },
    {
      userId: "user-demo-pending",
      name: "Karim Fares",
      streakDays: 0,
      lastActivityDate: "",
      xp: 25,
      monthlyXp: { [month]: 10 },
      badges: [],
      topicXp: {},
    },
  ];
}

async function readGame(): Promise<GameStore> {
  const data = await readJsonFile<GameStore>(FILE, { profiles: seedProfiles() });
  if (!Array.isArray(data.profiles) || data.profiles.length === 0) {
    const seeded = { profiles: seedProfiles() };
    await writeJsonFile(FILE, seeded);
    return seeded;
  }
  return data;
}

async function writeGame(store: GameStore) {
  await writeJsonFile(FILE, store);
}

function applyBadges(profile: StudentGamification) {
  const add = (id: BadgeId) => {
    if (!profile.badges.includes(id)) profile.badges.push(id);
  };
  if ((profile.topicXp.calculus ?? 0) >= 60) add("calculus-master");
  if ((profile.topicXp.probability ?? 0) >= 40) add("probability-pro");
  if ((profile.topicXp.brevet ?? 0) >= 50 || profile.badges.includes("brevet-champ")) add("brevet-champ");
  if (profile.streakDays >= 7) add("streak-7");
  if ((profile.topicXp.solver ?? 0) >= 15) add("first-solve");
}

function bumpStreak(profile: StudentGamification, day: string) {
  if (profile.lastActivityDate === day) return;
  if (profile.lastActivityDate && addDays(profile.lastActivityDate, 1) === day) {
    profile.streakDays += 1;
  } else if (profile.lastActivityDate === day) {
    return;
  } else {
    profile.streakDays = 1;
  }
  profile.lastActivityDate = day;
}

export async function getProfile(userId: string, name?: string) {
  const store = await readGame();
  let profile = store.profiles.find((item) => item.userId === userId);
  if (!profile) {
    profile = emptyProfile(userId, name || "Student");
    store.profiles.push(profile);
    await writeGame(store);
  }
  return profile;
}

export async function recordActivity(input: {
  userId: string;
  name?: string;
  kind: ActivityKind;
  topic?: string;
  examPercent?: number;
  examTrack?: string;
  lessonId?: string;
}) {
  const store = await readGame();
  let profile = store.profiles.find((item) => item.userId === input.userId);
  if (!profile) {
    profile = emptyProfile(input.userId, input.name || "Student");
    store.profiles.push(profile);
  }
  if (input.name) profile.name = input.name;
  const day = todayBeirut();
  bumpStreak(profile, day);

  let gained = XP[input.kind] ?? 10;
  if (input.kind === "exam") {
    const percent = input.examPercent ?? 0;
    gained = Math.round(percent / 2);
    if (percent >= 80) gained += 25;
    if (percent >= 100) gained += 15;
  }
  profile.xp += gained;
  const month = monthKey();
  profile.monthlyXp[month] = (profile.monthlyXp[month] ?? 0) + gained;
  const topic = input.topic || (input.examTrack?.includes("brevet") ? "brevet" : input.kind === "solver" ? "solver" : input.kind);
  profile.topicXp[topic] = (profile.topicXp[topic] ?? 0) + gained;
  if (input.kind === "exam" && (input.examTrack ?? "").includes("brevet") && (input.examPercent ?? 0) >= 70) {
    profile.topicXp.brevet = (profile.topicXp.brevet ?? 0) + 50;
  }
  if (input.kind === "exam" && (input.examPercent ?? 0) >= 80) {
    profile.topicXp.calculus = (profile.topicXp.calculus ?? 0) + 20;
  }
  applyBadges(profile);
  await writeGame(store);
  return { profile, gained, day };
}

export async function monthlyLeaderboard(month = monthKey()) {
  const store = await readGame();
  const users = await listPublicUsers();
  const names = new Map(users.map((user) => [user.id, user.name]));
  return store.profiles
    .map((profile) => ({
      userId: profile.userId,
      name: names.get(profile.userId) || profile.name,
      xp: profile.monthlyXp[month] ?? 0,
      streakDays: profile.streakDays,
      badges: profile.badges,
    }))
    .filter((row) => row.xp > 0)
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 20);
}

export { monthKey, todayBeirut };
