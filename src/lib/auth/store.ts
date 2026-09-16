import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createId } from "../ids";
import { DEMO_ACCOUNTS } from "./demoAccounts";
import { hashPassword, hashToken } from "./passwords";
import type { AuthRole } from "./paths";

const dataDir = path.join(process.cwd(), "data");
const authPath = path.join(dataDir, "auth.json");

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: AuthRole;
  passwordHash: string;
  entitlementPlanId?: string;
  createdAt: string;
};

export type AuthSession = {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  userAgent?: string;
};

export type AuthStoreData = {
  users: AuthUser[];
  sessions: AuthSession[];
};

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: AuthRole;
  entitlementPlanId?: string;
};

function toPublic(user: AuthUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone?.trim() || "76532421",
    role: user.role,
    entitlementPlanId: user.entitlementPlanId,
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
    createdAt: now,
  }));
  return { users, sessions: [] };
}

async function readAuthStore(): Promise<AuthStoreData> {
  await mkdir(dataDir, { recursive: true });
  try {
    const raw = await readFile(authPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<AuthStoreData>;
    const users = Array.isArray(parsed.users) ? parsed.users : [];
    const sessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
    if (users.length === 0) {
      const seeded = await seedAuth();
      await writeFile(authPath, JSON.stringify(seeded, null, 2), "utf8");
      return seeded;
    }
    return { users, sessions };
  } catch {
    const seeded = await seedAuth();
    await writeFile(authPath, JSON.stringify(seeded, null, 2), "utf8");
    return seeded;
  }
}

async function writeAuthStore(store: AuthStoreData) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(authPath, JSON.stringify(store, null, 2), "utf8");
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
  const store = await readAuthStore();
  const user = store.users.find((item) => item.id === userId);
  if (!user) return undefined;
  user.entitlementPlanId = planId;
  await writeAuthStore(store);
  return toPublic(user);
}

export async function userHasSubscription(user: Pick<AuthUser, "id" | "role" | "entitlementPlanId" | "phone">) {
  if (user.role === "teacher" || user.role === "admin") return true;
  if (user.entitlementPlanId) return true;
  const { readStore } = await import("../store");
  const data = await readStore();
  return (data.entitlements ?? []).some(
    (item) =>
      item.userId === user.id ||
      (user.phone && item.phone && item.phone.replace(/\s/g, "") === user.phone.replace(/\s/g, "")),
  );
}

export async function createExclusiveSession(userId: string, token: string, userAgent?: string) {
  const store = await readAuthStore();
  store.sessions = store.sessions.filter((session) => session.userId !== userId);
  const session: AuthSession = {
    id: createId("sess"),
    userId,
    tokenHash: hashToken(token),
    createdAt: new Date().toISOString(),
    userAgent,
  };
  store.sessions.push(session);
  await writeAuthStore(store);
  return session;
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

export async function deleteSessionByToken(token: string) {
  const store = await readAuthStore();
  const tokenHash = hashToken(token);
  store.sessions = store.sessions.filter((item) => item.tokenHash !== tokenHash);
  await writeAuthStore(store);
}

export async function deleteSessionsForUser(userId: string) {
  const store = await readAuthStore();
  store.sessions = store.sessions.filter((item) => item.userId !== userId);
  await writeAuthStore(store);
}
