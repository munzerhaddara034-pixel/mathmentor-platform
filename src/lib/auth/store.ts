import { createId } from "../ids";
import { readJsonFile, updateJsonFile, withStoreLock } from "../dataDir";
import { isAdminEmail } from "./adminAllowlist";
import {
  checkVerificationToken,
  isEmailVerified,
  isPlausibleVerificationToken,
  newVerificationToken,
  shouldResendVerification,
  type EmailVerificationState,
} from "./emailVerification";
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
  /**
   * E-mail verification. `undefined` = account created before verification existed (grandfathered,
   * treated as verified). `null` = signup pending confirmation. ISO string = verified at.
   */
  emailVerifiedAt?: string | null;
  emailVerification?: EmailVerificationState | null;
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
  emailVerified: boolean;
  /**
   * The phone the user actually saved, or null. `phone` above keeps a display fallback for
   * watermarks; notifications (WhatsApp) must use this field so they never go to the fallback number.
   */
  contactPhone: string | null;
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
    emailVerified: isEmailVerified(migrated),
    contactPhone: migrated.phone?.trim() || null,
  };
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

/** No demo/seed accounts: an empty store stays empty until someone signs up. */
async function readAuthStoreUnlocked(): Promise<AuthStoreData> {
  const parsed = await readJsonFile<Partial<AuthStoreData> | null>(AUTH_FILE, null, { persistFallback: false });
  const store = normalizeAuthStore(parsed ?? {});
  return { users: store.users.map(migrateUser), sessions: store.sessions, revokedTokens: store.revokedTokens };
}

function serializeAuthStore(store: AuthStoreData): AuthStoreData {
  return {
    users: store.users,
    sessions: store.sessions,
    revokedTokens: pruneRevoked(store.revokedTokens),
  };
}

async function readAuthStore(): Promise<AuthStoreData> {
  return withStoreLock(AUTH_FILE, readAuthStoreUnlocked);
}

/**
 * Locked read-modify-write of auth.json. In-process it is serialised by the store lock; on Postgres
 * `updateJsonFile` also row-locks the document (SELECT … FOR UPDATE), so several instances can no
 * longer overwrite each other's changes.
 */
async function mutateAuth<T>(fn: (store: AuthStoreData) => Promise<T> | T): Promise<T> {
  let result!: T;
  await updateJsonFile<Partial<AuthStoreData> | null>(AUTH_FILE, null, async (raw) => {
    const store = normalizeAuthStore(raw ?? {});
    const migrated: AuthStoreData = { users: store.users.map(migrateUser), sessions: store.sessions, revokedTokens: store.revokedTokens };
    result = await fn(migrated);
    return serializeAuthStore(migrated);
  });
  return result;
}

/** The auth store document key (mm_documents.key on Postgres). */
export const AUTH_DOCUMENT_KEY = AUTH_FILE;

/**
 * Pure: apply a confirmed payment to the raw auth.json document. Merges the tier, adds the plan's
 * live credits once, and sets the AI expiry to `expiresAt` for AI_TIER / BOTH plans.
 * Returns the next document and the user's public view (undefined when the user is unknown).
 */
export function applyPaidEntitlementToAuthDoc(
  raw: unknown,
  userId: string,
  planId: string,
  expiresAt: Date,
): { doc: AuthStoreData; user?: PublicUser; previousAiExpiresAt: string | null } {
  const store = normalizeAuthStore((raw && typeof raw === "object" ? raw : {}) as Partial<AuthStoreData>);
  const users = store.users.map(migrateUser);
  const doc: AuthStoreData = { users, sessions: store.sessions, revokedTokens: store.revokedTokens };
  const user = users.find((item) => item.id === userId);
  if (!user) return { doc: serializeAuthStore(doc), previousAiExpiresAt: null };
  const previousAiExpiresAt = user.aiExpiresAt ?? null;
  const incoming = planIdToSubscriptionType(planId);
  user.entitlementPlanId = planId;
  user.subscriptionType = mergeSubscription(user.subscriptionType ?? null, incoming);
  user.liveCredits = (user.liveCredits ?? 0) + liveCreditsForPlan(planId);
  if (incoming === "AI_TIER" || incoming === "BOTH") user.aiExpiresAt = expiresAt.toISOString();
  return { doc: serializeAuthStore(doc), user: toPublic(user), previousAiExpiresAt };
}

/** Pure: current AI expiry of one user in a raw auth.json document (for the confirm dialog / maths). */
export function aiExpiryFromAuthDoc(raw: unknown, userId: string): string | null {
  const store = normalizeAuthStore((raw && typeof raw === "object" ? raw : {}) as Partial<AuthStoreData>);
  const user = store.users.find((item) => item.id === userId);
  return user ? migrateUser(user).aiExpiresAt ?? null : null;
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

export async function setUserEntitlement(
  userId: string,
  planId: string,
  opts?: { days?: number },
) {
  return mutateAuth((store) => {
    const user = store.users.find((item) => item.id === userId);
    if (!user) return undefined;
    const incoming = planIdToSubscriptionType(planId);
    user.entitlementPlanId = planId;
    user.subscriptionType = mergeSubscription(user.subscriptionType ?? null, incoming);
    const extraCredits = liveCreditsForPlan(planId);
    user.liveCredits = (user.liveCredits ?? 0) + extraCredits;
    if (incoming === "AI_TIER" || incoming === "BOTH") {
      user.aiExpiresAt = extendAiExpiry(user.aiExpiresAt, opts?.days ?? AI_ACCESS_DAYS);
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

/**
 * Mirror an account that authenticated against the profile DB (`/signup`, SQLite or Postgres)
 * into this session store, so one exclusive-session cookie covers both.
 * Existing users (matched by email) are returned unchanged — no password or role overwrite.
 */
export async function ensureUserForProfile(input: {
  email: string;
  name: string;
  role: AuthRole;
  passwordHash: string;
  phone?: string;
  /** New self-signups pass true: the account stays locked until the e-mail link is clicked. */
  requireEmailVerification?: boolean;
}): Promise<AuthUser> {
  const email = input.email.trim().toLowerCase();
  return mutateAuth((store) => {
    const existing = store.users.find((user) => user.email === email);
    if (existing) return existing;
    const created: AuthUser = migrateUser({
      id: createId("user"),
      email,
      name: input.name.trim() || email,
      phone: input.phone,
      role: input.role,
      passwordHash: input.passwordHash,
      subscriptionType: null,
      liveCredits: 0,
      aiExpiresAt: null,
      createdAt: new Date().toISOString(),
      ...(input.requireEmailVerification ? { emailVerifiedAt: null, emailVerification: null } : {}),
    });
    store.users.push(created);
    return created;
  });
}

/**
 * ADMIN_EMAILS allowlist: an existing account whose email is listed is (re)granted the admin
 * (staff: teacher + admin) role on login. Accounts that are not listed are never changed here.
 */
export async function ensureAdminRoleForAllowlistedEmail(userId: string): Promise<AuthUser | undefined> {
  return mutateAuth((store) => {
    const user = store.users.find((item) => item.id === userId);
    if (!user) return undefined;
    // Admin rights only activate once the allowlisted address has proven ownership.
    if (isAdminEmail(user.email) && isEmailVerified(user) && user.role !== "admin") {
      user.role = "admin";
      Object.assign(user, migrateUser(user));
    }
    return user;
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
  // Defense in depth: an unverified account never has a usable session.
  if (!isEmailVerified(user)) return undefined;
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

/**
 * Issue (or re-issue) an e-mail verification token for a pending account.
 * Returns the raw token (only ever sent by e-mail) or null when the account is already verified,
 * missing, or a link was sent less than the resend gap ago (unless `force`).
 */
export async function issueEmailVerification(
  userId: string,
  opts: { force?: boolean; now?: number } = {},
): Promise<{ token: string; user: AuthUser } | null> {
  return mutateAuth((store) => {
    const user = store.users.find((item) => item.id === userId);
    if (!user || isEmailVerified(user)) return null;
    if (!opts.force && !shouldResendVerification(user.emailVerification, opts.now)) return null;
    const { token, state } = newVerificationToken(opts.now);
    user.emailVerification = state;
    return { token, user };
  });
}

export type VerifyEmailOutcome =
  | { ok: true; user: AuthUser; alreadyVerified: boolean }
  | { ok: false; reason: "invalid" | "expired" };

/**
 * Redeem a verification token for one account. Called from login only after the password has
 * been checked, so the account that gets verified is one whose password the link-holder knows
 * (an e-mail squatter cannot get their password verified with the real owner's link).
 * Activates admin rights when the address is on ADMIN_EMAILS.
 */
export async function verifyEmailForUser(userId: string, token: string, now = Date.now()): Promise<VerifyEmailOutcome> {
  if (!isPlausibleVerificationToken(token)) return { ok: false, reason: "invalid" };
  return mutateAuth((store) => {
    const user = store.users.find((item) => item.id === userId);
    if (!user) return { ok: false as const, reason: "invalid" as const };
    if (isEmailVerified(user)) return { ok: true as const, user, alreadyVerified: true };
    const check = checkVerificationToken(user.emailVerification, token, now);
    if (!check.ok) return { ok: false as const, reason: check.reason === "expired" ? ("expired" as const) : ("invalid" as const) };
    user.emailVerifiedAt = new Date(now).toISOString();
    user.emailVerification = null;
    if (isAdminEmail(user.email) && user.role !== "admin") {
      user.role = "admin";
      Object.assign(user, migrateUser(user));
    }
    return { ok: true as const, user, alreadyVerified: false };
  });
}

/**
 * Signup again with an address whose account was never verified: the new password/name replace
 * the pending ones (the squatter never proved ownership). Verified accounts are never touched.
 */
export async function replacePendingSignup(
  userId: string,
  patch: { name: string; passwordHash: string; role: AuthRole },
): Promise<AuthUser | undefined> {
  return mutateAuth((store) => {
    const user = store.users.find((item) => item.id === userId);
    if (!user || isEmailVerified(user)) return undefined;
    user.name = patch.name.trim() || user.name;
    user.passwordHash = patch.passwordHash;
    user.role = patch.role === "admin" || patch.role === "teacher" ? "student" : patch.role;
    user.emailVerification = null;
    return user;
  });
}

/** Legacy accounts (created before e-mail verification) have no emailVerifiedAt field. */
export function isLegacyAccount(user: Pick<AuthUser, "emailVerifiedAt">) {
  return user.emailVerifiedAt === undefined;
}

export { isEmailVerified } from "./emailVerification";
