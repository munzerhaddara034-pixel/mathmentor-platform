import { createId } from "@/lib/ids";
import { readJsonFile, writeJsonFile } from "@/lib/dataDir";
import { findUserById, setUserSubscription } from "@/lib/auth/store";
import { planIdToSubscriptionType } from "@/lib/auth/tiers";

const FILE = "billing.json";

export type LedgerKind = "activation" | "topup" | "live_booking" | "ai_grant";

export type LedgerEntry = {
  id: string;
  userId: string;
  kind: LedgerKind;
  hoursDelta: number;
  code?: string;
  description: string;
  descriptionAr: string;
  relatedId?: string;
  createdAt: string;
};

export type TopUpCode = {
  code: string;
  liveHours: number;
  used: boolean;
  usedBy?: string;
  usedUserId?: string;
  createdAt: string;
  expiresAt?: string;
  note?: string;
  createdBy?: string;
};

type BillingStore = { codes: TopUpCode[]; ledger: LedgerEntry[] };

function seed(): BillingStore {
  const now = new Date().toISOString();
  return {
    codes: [
      {
        code: "MUNZER-HRS-2H",
        liveHours: 2,
        used: false,
        createdAt: now,
        note: "Demo live-hour top-up from Prof. Munzer Haddara",
        createdBy: "user-demo-teacher",
      },
    ],
    ledger: [
      {
        id: "led-seed-both",
        userId: "user-demo-student",
        kind: "activation",
        hoursDelta: 4,
        code: "MUNZER-BOTH-1X",
        description: "Activated AI + Live bundle (demo seed)",
        descriptionAr: "تفعيل باقة الذكاء + المباشر (تجريبي)",
        createdAt: now,
      },
      {
        id: "led-seed-ai",
        userId: "user-demo-ai",
        kind: "ai_grant",
        hoursDelta: 0,
        code: "MUNZER-AI-3K",
        description: "AI platform access granted (demo seed)",
        descriptionAr: "تفعيل منصة الذكاء (تجريبي)",
        createdAt: now,
      },
    ],
  };
}

async function readBilling(): Promise<BillingStore> {
  const data = await readJsonFile<BillingStore>(FILE, seed());
  if (!Array.isArray(data.codes) || !Array.isArray(data.ledger)) return seed();
  if (data.codes.length === 0 && data.ledger.length === 0) {
    const seeded = seed();
    await writeJsonFile(FILE, seeded);
    return seeded;
  }
  if (!data.codes.some((code) => code.code === "MUNZER-HRS-2H")) {
    data.codes.unshift(seed().codes[0]);
    await writeJsonFile(FILE, data);
  }
  return data;
}

async function writeBilling(store: BillingStore) {
  await writeJsonFile(FILE, store);
}

export async function addLedger(entry: Omit<LedgerEntry, "id" | "createdAt"> & { id?: string }) {
  const store = await readBilling();
  const record: LedgerEntry = {
    ...entry,
    id: entry.id ?? createId("led"),
    createdAt: new Date().toISOString(),
  };
  store.ledger.unshift(record);
  await writeBilling(store);
  return record;
}

export async function listLedger(userId?: string) {
  const store = await readBilling();
  return userId ? store.ledger.filter((item) => item.userId === userId) : store.ledger;
}

export async function listTopUpCodes() {
  const store = await readBilling();
  return store.codes;
}

export async function createTopUpCodes(input: {
  prefix?: string;
  liveHours: number;
  count?: number;
  note?: string;
  expiresAt?: string;
  createdBy?: string;
  code?: string;
}) {
  const store = await readBilling();
  const count = Math.min(Math.max(input.count ?? 1, 1), 50);
  const hours = Math.max(1, Math.round(input.liveHours));
  const created: TopUpCode[] = [];
  for (let i = 0; i < count; i += 1) {
    const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
    const code =
      count === 1 && input.code?.trim()
        ? input.code.trim().toUpperCase()
        : `${(input.prefix || "MUNZER-HRS").trim().toUpperCase()}-${suffix}`;
    created.push({
      code,
      liveHours: hours,
      used: false,
      createdAt: new Date().toISOString(),
      expiresAt: input.expiresAt,
      note: input.note,
      createdBy: input.createdBy,
    });
  }
  store.codes.unshift(...created);
  await writeBilling(store);
  return created;
}

export async function redeemTopUp(code: string, userId: string, studentName: string) {
  const store = await readBilling();
  const card = store.codes.find((item) => item.code.toLowerCase() === code.trim().toLowerCase());
  if (!card) return { ok: false as const, error: "رمز الشحن غير صحيح", errorEn: "Unknown top-up code." };
  if (card.used) return { ok: false as const, error: "هذا الرمز مستخدم", errorEn: "This top-up code was already used." };
  if (card.expiresAt && Date.parse(card.expiresAt) < Date.now()) {
    return { ok: false as const, error: "انتهت صلاحية الرمز", errorEn: "This top-up code has expired." };
  }
  card.used = true;
  card.usedBy = studentName;
  card.usedUserId = userId;
  const user = await findUserById(userId);
  const nextCredits = (user?.liveCredits ?? 0) + card.liveHours;
  const currentType = user?.subscriptionType ?? null;
  const nextType =
    currentType === "AI_TIER" || currentType === "BOTH" ? "BOTH" : currentType === "LIVE_TIER" ? "LIVE_TIER" : "LIVE_TIER";
  await setUserSubscription(userId, { liveCredits: nextCredits, subscriptionType: nextType });
  const record: LedgerEntry = {
    id: createId("led"),
    userId,
    kind: "topup",
    hoursDelta: card.liveHours,
    code: card.code,
    description: `Redeemed live-hour top-up (+${card.liveHours} h)`,
    descriptionAr: `شحن حصص مباشرة (+${card.liveHours} ساعات)`,
    createdAt: new Date().toISOString(),
  };
  store.ledger.unshift(record);
  await writeBilling(store);
  return { ok: true as const, hours: card.liveHours, liveCredits: nextCredits, code: card.code };
}

export async function recordLiveBookingDebit(userId: string, bookingId: string, studentName: string) {
  return addLedger({
    userId,
    kind: "live_booking",
    hoursDelta: -1,
    relatedId: bookingId,
    description: `Booked live 1-on-1 (${studentName})`,
    descriptionAr: `حجز حصة مباشرة (${studentName})`,
  });
}

export async function recordActivation(userId: string, planId: string, code: string) {
  const type = planIdToSubscriptionType(planId);
  const hours = type === "BOTH" ? 8 : type === "LIVE_TIER" ? 4 : 0;
  return addLedger({
    userId,
    kind: type === "LIVE_TIER" ? "topup" : type === "AI_TIER" ? "ai_grant" : "activation",
    hoursDelta: hours,
    code,
    description: `Activation card ${code} (${planId})`,
    descriptionAr: `بطاقة تفعيل ${code} (${planId})`,
  });
}

export async function walletSnapshot(userId: string) {
  const user = await findUserById(userId);
  if (!user) return undefined;
  const expired = Boolean(user.aiExpiresAt && Date.parse(user.aiExpiresAt) < Date.now());
  const type = user.subscriptionType;
  const hasAiPlan = type === "AI_TIER" || type === "BOTH";
  const aiStatus = !hasAiPlan ? "none" : expired ? "expired" : "active";
  const ledger = await listLedger(userId);
  return {
    name: user.name,
    phone: user.phone,
    email: user.email,
    subscriptionType: type ?? null,
    aiStatus,
    aiExpiresAt: user.aiExpiresAt ?? null,
    liveCredits: user.liveCredits ?? 0,
    ledger,
  };
}
