import { createId } from "../ids";
import { readJsonFile, withStoreLock, writeJsonFile } from "../dataDir";
import { DEMO_ACCOUNTS } from "./demoAccounts";
import { classifyDevice, deviceDisplayName, fingerprintHash, formatDeviceTimestamp, type DeviceClass, type DeviceFingerprint } from "./device";
import { hashPassword, hashToken } from "./passwords";
import { isSessionSharingExempt, type AuthRole } from "./paths";
import {
  accessFromSubscription,
  liveCreditsForPlan,
  mergeSubscription,
  planIdToSubscriptionType,
  type SubscriptionType,
} from "./tiers";

const AUTH_FILE = "auth.json";
const REVOKED_TTL_MS = 1000 * 60 * 60 * 24 * 31;
const MAX_REVOKED_TOKENS = 2000;

export const AI_ACCESS_DAYS = 90;

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: AuthRole;
  passwordHash: string;
  entitlementPlanId?: string;
  subscriptionType?: SubscriptionType | null;
  liveCredits?: number;
  aiExpiresAt?: string | null;
  createdAt: string;
};

export type AuthSession = {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  userAgent?: string;
  deviceClass?: DeviceClass;
  fingerprintHash?: string;
  timezone?: string;
  screen?: string;
  deviceId?: string;
};

/** Recorded when a student same-class login kicks the previous device. */
export type RevokedSession = {
  tokenHash: string;
  userId: string;
  replacedAt: string;
  deviceClass?: DeviceClass;
};

export type AuthStoreData = {
  users: AuthUser[];
  sessions: AuthSession[];
  revokedTokens: RevokedSession[];
};

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: AuthRole;
  entitlementPlanId?: string;
  subscriptionType: SubscriptionType | null;
  liveCredits: number;
  aiExpiresAt: string | null;
};

export function defaultAiExpiry(from = new Date(), days = AI_ACCESS_DAYS) {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function extendAiExpiry(current: string | null | undefined, days = AI_ACCESS_DAYS) {
  const now = Date.now();
  const existing = current ? Date.parse(current) : NaN;
  const base = Number.isFinite(existing) && existing > now ? existing : now;
  return new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
}

function migrateUser(user: AuthUser): AuthUser {
  const inferred = user.subscriptionType ?? planIdToSubscriptionType(user.entitlementPlanId);
  const staff = user.role === "teacher" || user.role === "admin";
  const subscriptionType = staff ? inferred ?? "BOTH" : inferred ?? null;
  const liveCredits =
    typeof user.liveCredits === "number"
      ? user.liveCredits
      : staff
        ? 99
        : liveCreditsForPlan(user.entitlementPlanId);
  let aiExpiresAt = user.aiExpiresAt ?? null;
  if (staff && !aiExpiresAt) aiExpiresAt = defaultAiExpiry(new Date(), 3650);
  const aiType = subscriptionType === "AI_TIER" || subscriptionType === "BOTH";
  if (aiType && !aiExpiresAt) {
    const created = user.createdAt ? new Date(user.createdAt) : new Date();
    aiExpiresAt = defaultAiExpiry(Number.isNaN(created.getTime()) ? new Date() : created);
  }
  return { ...user, subscriptionType, liveCredits, aiExpiresAt };
}

function toPublic(user: AuthUser): PublicUser {
  const migrated = migrateUser(user);
  return {
    id: migrated.id,
    email: migrated.email,
    name: migrated.name,
    phone: migrated.phone?.trim() || "76532421",
    role: migrated.role,
    entitlementPlanId: migrated.entitlementPlanId,
    subscriptionType: migrated.subscriptionType ?? null,
    liveCredits: migrated.liveCredits ?? 0,
    aiExpiresAt: migrated.aiExpiresAt ?? null,
  };
}

async function seedAuth(): Promise<AuthStoreData> {
  const now = new Date().toISOString();
  const users: AuthUser[] = DEMO_ACCOUNTS.map((account) => ({
    id: account.id,
    email: account.email.toLowerCase(),
    name: account.name,
    phone: account.phone,
    role: account.role,
    passwordHash: hashPassword(account.password),
    entitlementPlanId: account.entitlementPlanId,
    subscriptionType: account.subscriptionType ?? planIdToSubscriptionType(account.entitlementPlanId),
    liveCredits: account.liveCredits ?? liveCreditsForPlan(account.entitlementPlanId),
    aiExpiresAt: account.aiExpiresAt ?? null,
    createdAt: now,
  }));
  return { users, sessions: [], revokedTokens: [] };
}

function pruneRevoked(entries: RevokedSession[] | undefined): RevokedSession[] {
  const cutoff = Date.now() - REVOKED_TTL_MS;
  return (entries ?? [])
    .filter((entry) => {
      const at = Date.parse(entry.replacedAt);
      return Number.isFinite(at) && at >= cutoff && entry.tokenHash;
    })
    .slice(-MAX_REVOKED_TOKENS);
}

function normalizeAuthStore(parsed: Partial<AuthStoreData> | AuthStoreData): AuthStoreData {
  return {
    users: Array.isArray(parsed.users) ? parsed.users : [],
    sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    revokedTokens: pruneRevoked(parsed.revokedTokens),
  };
}

async function readAuthStoreUnlocked(): Promise<AuthStoreData> {
  const parsed = await readJsonFile<Partial<AuthStoreData> | null>(AUTH_FILE, null, { persistFallback: false });
  const store = normalizeAuthStore(parsed ?? {});
  if (store.users.length === 0) {
    const seeded = await seedAuth();
    await writeJsonFile(AUTH_FILE, seeded);
    return seeded;
  }
  const migratedUsers = store.users.map(migrateUser);
  const knownIds = new Set(migratedUsers.map((user) => user.id));
  const extras = DEMO_ACCOUNTS.filter(
    (account) => !knownIds.has(account.id) && !migratedUsers.some((user) => user.email === account.email.toLowerCase()),
  );
  if (extras.length) {
    const now = new Date().toISOString();
    for (const account of extras) {
      migratedUsers.push({
        id: account.id,
        email: account.email.toLowerCase(),
        name: account.name,
        phone: account.phone,
        role: account.role,
        passwordHash: hashPassword(account.password),
        entitlementPlanId: account.entitlementPlanId,
        subscriptionType: account.subscriptionType ?? planIdToSubscriptionType(account.entitlementPlanId),
        liveCredits: account.liveCredits ?? liveCreditsForPlan(account.entitlementPlanId),
        aiExpiresAt: account.aiExpiresAt ?? null,
        createdAt: now,
      });
    }
    const next = { users: migratedUsers, sessions: store.sessions, revokedTokens: store.revokedTokens };
    await writeJsonFile(AUTH_FILE, next);
    return next;
  }
  return { users: migratedUsers, sessions: store.sessions, revokedTokens: store.revokedTokens };
}

async function writeAuthStoreUnlocked(store: AuthStoreData) {
  await writeJsonFile(AUTH_FILE, {
    users: store.users,
    sessions: store.sessions,
    revokedTokens: pruneRevoked(store.revokedTokens),
  });
}

async function readAuthStore(): Promise<AuthStoreData> {
  return withStoreLock(AUTH_FILE, readAuthStoreUnlocked);
}

async function mutateAuth<T>(fn: (store: AuthStoreData) => Promise<T> | T): Promise<T> {
  return withStoreLock(AUTH_FILE, async () => {
    const store = await readAuthStoreUnlocked();
    const result = await fn(store);
    await writeAuthStoreUnlocked(store);
    return result;
  });
}

export async function findUserByEmail(email: string) {
  const store = await readAuthStore();
  return store.users.find((user) => user.email === email.trim().toLowerCase());
}

export async function findUserById(id: string) {
  const store = await readAuthStore();
  return store.users.find((user) => user.id === id);
}

export async function publicUserById(id: string) {
  const user = await findUserById(id);
  return user ? toPublic(user) : undefined;
}

export function asPublicUser(user: AuthUser) {
  return toPublic(user);
}

export async function setUserEntitlement(userId: string, planId: string) {
  return mutateAuth((store) => {
    const user = store.users.find((item) => item.id === userId);
    if (!user) return undefined;
    const incoming = planIdToSubscriptionType(planId);
    user.entitlementPlanId = planId;
    user.subscriptionType = mergeSubscription(user.subscriptionType ?? null, incoming);
    const extraCredits = liveCreditsForPlan(planId);
    user.liveCredits = (user.liveCredits ?? 0) + extraCredits;
    if (incoming === "AI_TIER" || incoming === "BOTH") {
      user.aiExpiresAt = extendAiExpiry(user.aiExpiresAt);
    }
    return toPublic(user);
  });
}

export async function setUserSubscription(
  userId: string,
  patch: {
    subscriptionType?: SubscriptionType | null;
    liveCredits?: number;
    entitlementPlanId?: string;
    aiExpiresAt?: string | null;
  },
) {
  return mutateAuth((store) => {
    const user = store.users.find((item) => item.id === userId);
    if (!user) return undefined;
    if (patch.subscriptionType !== undefined) user.subscriptionType = patch.subscriptionType;
    if (typeof patch.liveCredits === "number") user.liveCredits = Math.max(0, patch.liveCredits);
    if (patch.entitlementPlanId) user.entitlementPlanId = patch.entitlementPlanId;
    if (patch.aiExpiresAt !== undefined) user.aiExpiresAt = patch.aiExpiresAt;
    return toPublic(user);
  });
}

export async function adjustLiveCredits(userId: string, delta: number) {
  return mutateAuth((store) => {
    const user = store.users.find((item) => item.id === userId);
    if (!user) return undefined;
    user.liveCredits = Math.max(0, (user.liveCredits ?? 0) + delta);
    return toPublic(user);
  });
}

export async function listPublicUsers() {
  const store = await readAuthStore();
  return store.users.map(toPublic);
}

function accessFor(user: Pick<AuthUser, "id" | "role" | "entitlementPlanId" | "phone" | "subscriptionType" | "liveCredits" | "aiExpiresAt">) {
  const base = accessFromSubscription(user.role, user.subscriptionType ?? planIdToSubscriptionType(user.entitlementPlanId), user.liveCredits ?? 0);
  if (user.role === "teacher" || user.role === "admin") return base;
  const expired = Boolean(user.aiExpiresAt && Date.parse(user.aiExpiresAt) < Date.now());
  if (expired && base.aiAccess) {
    return {
      ...base,
      aiAccess: false,
      subscribed: false,
    };
  }
  return base;
}

export async function userHasSubscription(user: Pick<AuthUser, "id" | "role" | "entitlementPlanId" | "phone" | "subscriptionType" | "liveCredits" | "aiExpiresAt">) {
  return (await userAccess(user)).aiAccess;
}

export async function userHasAiAccess(user: Pick<AuthUser, "id" | "role" | "entitlementPlanId" | "phone" | "subscriptionType" | "liveCredits" | "aiExpiresAt">) {
  return (await userAccess(user)).aiAccess;
}

export async function userHasLiveAccess(user: Pick<AuthUser, "id" | "role" | "entitlementPlanId" | "phone" | "subscriptionType" | "liveCredits" | "aiExpiresAt">) {
  return (await userAccess(user)).liveAccess;
}

export async function userAccess(user: Pick<AuthUser, "id" | "role" | "entitlementPlanId" | "phone" | "subscriptionType" | "liveCredits" | "aiExpiresAt">) {
  const base = accessFor(user);
  if (base.aiAccess || base.liveAccess || user.role === "teacher" || user.role === "admin") return base;
  if (user.entitlementPlanId) {
    return accessFor({ ...user, subscriptionType: planIdToSubscriptionType(user.entitlementPlanId) });
  }
  const { readStore } = await import("../store");
  const data = await readStore();
  const entitlement = (data.entitlements ?? []).find(
    (item) =>
      item.userId === user.id ||
      (user.phone && item.phone && item.phone.replace(/\s/g, "") === user.phone.replace(/\s/g, "")),
  );
  if (!entitlement) return base;
  return accessFor({
    ...user,
    subscriptionType: planIdToSubscriptionType(entitlement.planId),
    liveCredits: user.liveCredits ?? liveCreditsForPlan(entitlement.planId),
  });
}

export type SessionCreateResult = {
  session: AuthSession;
  replaced: boolean;
  replacedClass: DeviceClass | null;
  sharingExempt: boolean;
};

export type PublicSession = {
  id: string;
  deviceClass: DeviceClass;
  createdAt: string;
  createdAtBeirut: string;
  userAgent: string;
  timezone: string;
  fingerprintHash: string;
  deviceId: string;
  deviceName: string;
  deviceNameAr: string;
};

function toPublicSession(session: AuthSession): PublicSession {
  const described = deviceDisplayName(session.userAgent, session.deviceClass);
  return {
    id: session.id,
    deviceClass: classifyDevice(session.userAgent, session.deviceClass),
    createdAt: session.createdAt,
    createdAtBeirut: formatDeviceTimestamp(session.createdAt),
    userAgent: session.userAgent ?? "",
    timezone: session.timezone ?? "",
    fingerprintHash: session.fingerprintHash ?? "",
    deviceId: session.deviceId ?? "",
    deviceName: described.nameWithClass,
    deviceNameAr: described.nameWithClassAr,
  };
}

export async function createExclusiveSession(
  userId: string,
  token: string,
  userAgent?: string,
  fingerprint?: DeviceFingerprint,
): Promise<SessionCreateResult> {
  return mutateAuth((store) => {
    const user = store.users.find((item) => item.id === userId);
    const sharingExempt = isSessionSharingExempt(user);
    const ua = fingerprint?.userAgent || userAgent;
    const deviceClass = classifyDevice(ua, fingerprint?.deviceClass);
    const incomingHash = fingerprintHash({
      userAgent: ua,
      screen: fingerprint?.screen,
      timezone: fingerprint?.timezone,
      deviceId: fingerprint?.deviceId,
    });
    const incomingDeviceId = fingerprint?.deviceId?.trim() || "";

    let previousSameClass: AuthSession[] = [];
    if (!sharingExempt) {
      previousSameClass = store.sessions.filter(
        (session) =>
          session.userId === userId &&
          classifyDevice(session.userAgent, session.deviceClass) === deviceClass,
      );
      const replacedAt = new Date().toISOString();
      store.revokedTokens = pruneRevoked([
        ...(store.revokedTokens ?? []),
        ...previousSameClass.map((session) => ({
          tokenHash: session.tokenHash,
          userId: session.userId,
          replacedAt,
          deviceClass,
        })),
      ]);
      store.sessions = store.sessions.filter(
        (session) =>
          session.userId !== userId || classifyDevice(session.userAgent, session.deviceClass) !== deviceClass,
      );
    } else {
      store.sessions = store.sessions.filter((session) => {
        if (session.userId !== userId) return true;
        if (incomingDeviceId && session.deviceId && session.deviceId === incomingDeviceId) return false;
        if (!incomingDeviceId && session.fingerprintHash === incomingHash) return false;
        return true;
      });
    }

    const session: AuthSession = {
      id: createId("sess"),
      userId,
      tokenHash: hashToken(token),
      createdAt: new Date().toISOString(),
      userAgent: ua,
      deviceClass,
      fingerprintHash: incomingHash,
      timezone: fingerprint?.timezone,
      screen: fingerprint?.screen,
      deviceId: fingerprint?.deviceId,
    };
    store.sessions.push(session);
    return {
      session,
      replaced: sharingExempt ? false : previousSameClass.length > 0,
      replacedClass: sharingExempt || !previousSameClass.length ? null : deviceClass,
      sharingExempt,
    };
  });
}

export async function listUserSessions(userId: string) {
  const store = await readAuthStore();
  return store.sessions
    .filter((session) => session.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toPublicSession);
}

export async function findSessionByToken(token: string) {
  if (!token) return undefined;
  const store = await readAuthStore();
  const tokenHash = hashToken(token);
  const session = store.sessions.find((item) => item.tokenHash === tokenHash);
  if (!session) return undefined;
  const user = store.users.find((item) => item.id === session.userId);
  if (!user) return undefined;
  return { session, user, publicUser: toPublic(user) };
}

/** True only when a student same-class kick recorded this token hash. */
export async function wasTokenReplaced(token: string) {
  if (!token) return false;
  const store = await readAuthStore();
  const tokenHash = hashToken(token);
  return (store.revokedTokens ?? []).some((item) => item.tokenHash === tokenHash);
}

export async function deleteSessionByToken(token: string) {
  await mutateAuth((store) => {
    const tokenHash = hashToken(token);
    store.sessions = store.sessions.filter((item) => item.tokenHash !== tokenHash);
  });
}

export async function deleteSessionsForUser(userId: string) {
  await mutateAuth((store) => {
    store.sessions = store.sessions.filter((item) => item.userId !== userId);
  });
}
