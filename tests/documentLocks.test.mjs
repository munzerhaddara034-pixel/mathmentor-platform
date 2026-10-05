// Round 2 / item 1: every JSON document store mutates under withDocumentLock. Runs on an injected
// in-memory backend with random async jitter (unlocked read-modify-write would lose updates) and with
// MM_STRICT_DOCUMENT_LOCKS=1, which makes ANY write outside withDocumentLock throw.
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

process.env.MM_STRICT_DOCUMENT_LOCKS = "1";
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

describe("document stores are locked read-modify-write", () => {
  const docs = new Map();
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const backend = {
    async getJSON(key) {
      await sleep(Math.random() * 2);
      return docs.has(key) ? structuredClone(docs.get(key)) : null;
    },
    async setJSON(key, value) {
      await sleep(Math.random() * 2);
      docs.set(key, structuredClone(value));
    },
  };
  let dataDir;
  const many = (n, fn) => Promise.all(Array.from({ length: n }, (_, i) => fn(i)));

  before(async () => {
    dataDir = await import("../src/lib/dataDir.ts");
    dataDir.setPersistentStoreOverride(backend);
  });
  after(() => {
    dataDir.setPersistentStoreOverride(null);
    delete process.env.MM_STRICT_DOCUMENT_LOCKS;
  });
  beforeEach(() => {
    docs.clear();
    docs.set("auth.json", {
      users: [{ id: "staff-1", email: "t@example.com", name: "T", role: "teacher", passwordHash: "x", createdAt: "2026-01-01T00:00:00.000Z" }],
      sessions: [],
      revokedTokens: [],
    });
  });

  test("strict mode: an unlocked write is refused; a locked one passes", async () => {
    await assert.rejects(dataDir.writeJsonFile("x.json", { a: 1 }), /unlocked write to x\.json/);
    await dataDir.withDocumentLock("x.json", () => dataDir.writeJsonFile("x.json", { a: 2 }));
    assert.deepEqual(docs.get("x.json"), { a: 2 });
  });

  test("first read of a missing doc never overwrites a concurrent locked writer (create-if-missing)", async () => {
    let release;
    const gate = new Promise((resolve) => (release = resolve));
    const writer = dataDir.withDocumentLock("seeded.json", async () => {
      await dataDir.writeJsonFile("seeded.json", { value: "writer" });
      await gate;
    });
    await sleep(5);
    const reader = dataDir.readJsonFile("seeded.json", { value: "seed" });
    release();
    await writer;
    assert.deepEqual(await reader, { value: "writer" });
    assert.deepEqual(docs.get("seeded.json"), { value: "writer" });
  });

  test("store.json (progress, chat, questions, settings…): 30 concurrent writers lose nothing", async () => {
    const store = await import("../src/lib/store.ts");
    await many(10, (i) => store.addProgress({ lessonId: `lesson-${i}`, completedAt: "2026-10-05T00:00:00.000Z" }));
    await many(10, (i) => store.addStudentChat({ id: `c${i}`, text: `hi ${i}` }));
    await many(10, (i) => store.addCustomQuestion({ id: `q${i}`, lessonId: "l", prompt: `p${i}`, options: ["a"], correctIndex: 0, steps: [] }));
    const saved = docs.get("store.json");
    assert.equal(saved.progress.length, 10);
    assert.equal(saved.studentChat.length, 10);
    assert.equal(saved.customQuestions.length, 10);
    await many(5, (i) => store.updateCustomQuestion(`q${i}`, { prompt: `edited ${i}` }));
    assert.equal(docs.get("store.json").customQuestions.filter((q) => q.prompt.startsWith("edited")).length, 5);
  });

  test("a malformed store.json is reset under the lock; a backend error is NOT turned into a reset", async () => {
    const store = await import("../src/lib/store.ts");
    docs.set("store.json", { library: "broken" });
    const fresh = await store.readStore();
    assert.ok(Array.isArray(fresh.library));
    await store.addProgress({ lessonId: "keep-me", completedAt: "2026-10-05T00:00:00.000Z" });
    const original = backend.getJSON;
    backend.getJSON = async () => {
      throw new Error("db down");
    };
    try {
      await assert.rejects(store.readStore(), /db down/);
    } finally {
      backend.getJSON = original;
    }
    assert.equal(docs.get("store.json").progress[0].lessonId, "keep-me", "data survives a read error");
  });

  test("billing ledger, notifications, gamification, exams, WhatsApp outbox, agent, voice, heygen, studio, b2b", async () => {
    const billing = await import("../src/lib/billing/store.ts");
    const notifications = await import("../src/lib/notifications/store.ts");
    const game = await import("../src/lib/gamification/store.ts");
    const exams = await import("../src/lib/exams/store.ts");
    const outbox = await import("../src/lib/whatsapp/store.ts");
    const agent = await import("../src/lib/agent/store.ts");
    const voice = await import("../src/lib/voiceMath/store.ts");
    const heygen = await import("../src/lib/studio/heygenJobs.ts");
    const studio = await import("../src/lib/studio/studioEventsStore.ts");
    const b2b = await import("../src/lib/b2b/whishOps.ts");

    await many(12, (i) => billing.addLedger({ userId: "u", kind: "topup", hoursDelta: 1, description: `d${i}`, descriptionAr: "x" }));
    assert.equal(docs.get("billing.json").ledger.length, 12);

    await many(12, (i) => notifications.pushNotification({ userId: "u", audience: "student", kind: "live_booked", title: `t${i}`, titleAr: "x", body: "b", bodyAr: "b" }));
    assert.equal(docs.get("notifications.json").notifications.length, 12);
    await notifications.markAllRead("u");
    assert.ok(docs.get("notifications.json").notifications.every((n) => n.read));

    await many(10, () => game.recordActivity({ userId: "g1", kind: "lesson" }));
    await many(5, () => game.getProfile("g2", "New"));
    const profiles = docs.get("gamification.json").profiles;
    assert.equal(profiles.filter((p) => p.userId === "g2").length, 1, "concurrent first reads create ONE profile");
    const g1 = profiles.find((p) => p.userId === "g1");
    const perLesson = (await game.recordActivity({ userId: "g3", kind: "lesson" })).gained;
    assert.equal(g1.xp, perLesson * 10, "no XP lost between concurrent activities");

    await many(8, (i) => exams.saveExamAttempt({ userId: "u", paperId: `p${i}` }));
    assert.equal(docs.get("exam-attempts.json").attempts.length, 8);
    await many(8, (i) => outbox.appendWhatsAppMessage({ to: "961", body: `m${i}` }));
    assert.equal(docs.get("whatsapp-outbox.json").messages.length, 8);
    await many(8, (i) => agent.saveHealth({ id: `h${i}`, createdAt: "2026-10-05T00:00:00.000Z" }));
    assert.equal(docs.get("agent-ops.json").health.length, 8);
    await many(6, (i) => voice.saveVoiceJob({ userId: "u", transcript: `v${i}` }));
    assert.equal(docs.get("voice-math.json").jobs.length, 6);
    await many(6, (i) => heygen.upsertHeyGenJob({ lessonId: `l${i}`, title: "t", script: "s", notes: "", mathExamples: "", status: "queued", demo: true }));
    assert.equal(docs.get("heygen-jobs.json").jobs.length, 6);
    await many(6, (i) => studio.saveStudioEvents(`lesson-${i}`, []));
    assert.equal(Object.keys(docs.get("studio-events.json").lessons).length, 6);
    await many(4, (i) => b2b.recordB2bWhishPayment({ referenceId: `R${i}`, planLabel: "p", amountUsd: 10, recordedByUserId: "staff-1", recordedByName: "T" }));
    assert.equal(docs.get("b2b-whish-payments.json").payments.length, 4);
  });

  test("live booking: 15 concurrent bookings of one 1-seat slot → exactly one", async () => {
    const live = await import("../src/lib/live/store.ts");
    const slot = await live.addSlot({ startsAt: new Date(Date.now() + 86_400_000).toISOString(), capacity: 1 });
    const results = await many(15, (i) =>
      live.bookSlot({ slotId: slot.id, studentId: `s${i}`, studentName: `S${i}`, studentEmail: "", studentPhone: "" }),
    );
    assert.equal(results.filter((r) => r.ok).length, 1);
    assert.ok(results.filter((r) => !r.ok).every((r) => r.error === "This slot is already booked."));
    const bookings = docs.get("live-sessions.json").bookings.filter((b) => b.slotId === slot.id);
    assert.equal(bookings.length, 1);
    // Concurrent patches of different fields both survive.
    await Promise.all([
      live.patchBooking(bookings[0].id, { teacherNote: "n" }),
      live.patchBooking(bookings[0].id, { reminderSentAt: "2026-10-05T00:00:00.000Z" }),
    ]);
    const saved = docs.get("live-sessions.json").bookings.find((b) => b.id === bookings[0].id);
    assert.equal(saved.teacherNote, "n");
    assert.equal(saved.reminderSentAt, "2026-10-05T00:00:00.000Z");
  });

  test("ids / client tokens use crypto, not Math.random", () => {
    assert.ok(!read("src/lib/auth/clientFingerprint.ts").includes("Math.random"));
    assert.ok(!read("src/components/live/MathWhiteboard.tsx").includes("Math.random"));
    assert.ok(!read("src/components/live/VoiceToBoardPanel.tsx").includes("Math.random"));
    for (const file of ["src/lib/store.ts", "src/lib/live/store.ts", "src/lib/billing/orders.ts", "src/lib/notifications/store.ts"]) {
      assert.ok(!/withStoreLock\(/.test(read(file)), `${file}: writers use withDocumentLock (PG-safe)`);
    }
  });
});
