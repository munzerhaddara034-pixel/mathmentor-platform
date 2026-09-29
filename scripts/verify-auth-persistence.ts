/**
 * Adapter + session-reason checks (no Next server).
 * Run: npx tsx scripts/verify-auth-persistence.ts
 */
import { liveSessionFailureReason } from "../src/lib/auth/sessionReason";
import { readJsonFile, setPersistentStoreOverride, writeJsonFile } from "../src/lib/dataDir";
import {
  createExclusiveSession,
  findSessionByToken,
  wasTokenReplaced,
} from "../src/lib/auth/store";

type JsonBackend = {
  getJSON: (key: string) => Promise<unknown | null>;
  setJSON: (key: string, value: unknown) => Promise<void>;
};

function sharedMemoryBackend(map: Map<string, unknown>): JsonBackend {
  return {
    async getJSON(key) {
      return map.has(key) ? structuredClone(map.get(key)) : null;
    },
    async setJSON(key, value) {
      map.set(key, structuredClone(value));
    },
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  assert(
    liveSessionFailureReason({ hasCookie: false, sessionFound: false, tokenWasReplaced: false }) ===
      "unauthenticated",
    "missing cookie must be unauthenticated",
  );
  assert(
    liveSessionFailureReason({ hasCookie: true, sessionFound: false, tokenWasReplaced: false }) === "expired",
    "cookie + missing row without a kick marker must be expired, not replaced",
  );
  assert(
    liveSessionFailureReason({ hasCookie: true, sessionFound: false, tokenWasReplaced: true }) === "replaced",
    "explicit revoked token must be replaced",
  );
  assert(
    liveSessionFailureReason({ hasCookie: true, sessionFound: true, tokenWasReplaced: true }) === null,
    "live session wins even if a stale revocation exists",
  );

  const blobs = new Map<string, unknown>();
  setPersistentStoreOverride(sharedMemoryBackend(blobs));
  await writeJsonFile("auth.json", { users: [{ id: "u1" }], sessions: [{ id: "s1", tokenHash: "abc" }] });
  setPersistentStoreOverride(sharedMemoryBackend(blobs));
  const roundTrip = await readJsonFile<{ sessions: Array<{ id: string }> }>("auth.json", { sessions: [] });
  assert(roundTrip.sessions[0]?.id === "s1", "auth.json must survive a second simulated instance");

  setPersistentStoreOverride(sharedMemoryBackend(new Map()));
  const desktop = {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
    screen: "1920x1080",
    timezone: "Asia/Beirut",
    deviceClass: "desktop" as const,
  };

  const studentFirst = "student-token-one";
  await createExclusiveSession("user-demo-student", studentFirst, desktop.userAgent, {
    ...desktop,
    deviceId: "desk-a",
  });
  const studentSecond = "student-token-two";
  const kicked = await createExclusiveSession("user-demo-student", studentSecond, desktop.userAgent, {
    ...desktop,
    deviceId: "desk-b",
  });
  assert(kicked.replaced === true, "student same-class login must report replaced");
  assert(kicked.sharingExempt === false, "student must not be sharing-exempt");
  assert(!(await findSessionByToken(studentFirst)), "kicked student token must leave the live session list");
  assert(await wasTokenReplaced(studentFirst), "kicked student token must be recorded in revokedTokens");
  assert(await findSessionByToken(studentSecond), "new student session must be live");

  const teacherFirst = "teacher-token-one";
  await createExclusiveSession("user-demo-teacher", teacherFirst, desktop.userAgent, {
    ...desktop,
    deviceId: "teacher-desk-a",
  });
  const teacherSecond = "teacher-token-two";
  const staff = await createExclusiveSession("user-demo-teacher", teacherSecond, desktop.userAgent, {
    ...desktop,
    deviceId: "teacher-desk-b",
  });
  assert(staff.replaced === false, "teacher second desktop must not be a replacement");
  assert(staff.sharingExempt === true, "teacher must be sharing-exempt");
  assert(await findSessionByToken(teacherFirst), "teacher first session must stay live");
  assert(await findSessionByToken(teacherSecond), "teacher second session must stay live");
  assert(!(await wasTokenReplaced(teacherFirst)), "teacher tokens must not be marked replaced");

  setPersistentStoreOverride(null);
  console.log("verify-auth-persistence: ok");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
