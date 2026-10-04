// Scratch-card / top-up lockdown: admin-only creation + audit, crypto codes, atomic redeem, rate limits.
// Runs on an injected in-memory document backend (no files, no DATABASE_URL). The Postgres side
// (advisory + row locks across processes) is covered by tests/cardsPg.test.mjs.
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

const codes = await import("../src/lib/cards/codes.ts");
const { createRateLimiter, hitRedeemLimits, redeemRateLimits } = await import("../src/lib/security/rateLimit.ts");

test("card codes: node:crypto randomInt, unambiguous alphabet, 8 random chars, unique vs existing", () => {
  const source = read("src/lib/cards/codes.ts");
  assert.match(source, /import \{ randomInt \} from "node:crypto"/);
  assert.ok(!source.includes("Math.random"));
  const existing = ["MUNZER-AAAAAAAA"];
  const batch = codes.generateCardCodes("MUNZER", 200, existing);
  assert.equal(batch.length, 200);
  assert.equal(new Set(batch).size, 200, "no duplicates inside a batch");
  for (const code of batch) {
    assert.match(code, /^MUNZER-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
    assert.ok(!existing.includes(code));
  }
  assert.equal(codes.cleanCardPrefix("  munzer hrs!-", "X"), "MUNZERHRS");
  assert.equal(codes.cleanCardPrefix("", "MUNZER-HRS"), "MUNZER-HRS");
  assert.equal(codes.maskCardCode("MUNZER-ABCDEFGH"), "MUNZER-••••••GH");
  assert.equal(codes.maskCardCode("AB"), "••");
});

test("no Math.random left in card / code / id generation", () => {
  for (const file of ["src/lib/store.ts", "src/lib/billing/store.ts", "src/lib/ids.ts", "src/lib/cards/codes.ts", "src/lib/cards/redeem.ts"]) {
    assert.ok(!read(file).includes("Math.random"), `${file} must not use Math.random`);
  }
  assert.match(read("src/lib/ids.ts"), /crypto\.getRandomValues/);
});

test("creation routes: admin guard (not the teacher check), same-origin, audited; teachers see masked codes", () => {
  for (const [file, action] of [
    ["src/app/api/cards/route.ts", "cards.create"],
    ["src/app/api/billing/topup/route.ts", "topup.create"],
  ]) {
    const source = read(file);
    const post = source.slice(source.indexOf("export async function POST"));
    assert.match(post, /^export async function POST\(request: Request\) \{\n  const guard = await apiRequireAdmin\(\);\n  if \(guard\.error\) return guard\.error;\n  if \(!isSameOriginRequest/);
    assert.ok(!source.includes('requireRole(["teacher"])'), `${file} no longer uses the teacher check`);
    assert.ok(!/isStaffRole\(/.test(post), `${file} POST does not accept any staff role`);
    assert.ok(source.includes(`action: "${action}"`), `${file} audits ${action}`);
    assert.match(source, /maskCardCode/, "audit + teacher views carry masked codes only");
  }
  // Card minting happens only in these two places.
  const mint = (needle) =>
    ["src/app/api/cards/route.ts", "src/app/api/billing/topup/route.ts", "src/app/api/redeem/route.ts", "src/app/api/billing/redeem/route.ts"].filter((file) =>
      read(file).includes(needle),
    );
  assert.deepEqual(mint("createScratchCards("), ["src/app/api/cards/route.ts"]);
  assert.deepEqual(mint("createTopUpCodes("), ["src/app/api/billing/topup/route.ts"]);
  const guards = read("src/lib/auth/guards.ts");
  assert.match(guards, /guard\.live\.user\.role !== "admin" \|\| !guard\.live\.user\.emailVerified/, "apiRequireAdmin = verified admin only");
});

test("redeem routes: rate limit before any work, atomic redeem, contact phone only", () => {
  const redeem = read("src/app/api/redeem/route.ts");
  assert.ok(redeem.indexOf("hitRedeemLimits(") > 0 && redeem.indexOf("hitRedeemLimits(") < redeem.indexOf("redeemCode("));
  assert.ok(!redeem.includes("setUserEntitlement("), "entitlement is granted inside the locked redeemCode");
  assert.ok(redeem.includes("live.user.contactPhone"));
  const billing = read("src/app/api/billing/redeem/route.ts");
  assert.ok(billing.indexOf("hitRedeemLimits(") > 0 && billing.indexOf("hitRedeemLimits(") < billing.indexOf("redeemTopUp("));
  assert.match(read("src/lib/cards/redeem.ts"), /withDocumentLock\(REDEEM_DOCUMENT_KEYS/);
  assert.match(read("src/lib/billing/store.ts"), /withDocumentLock\(\[AUTH_DOCUMENT_KEY, FILE\]/);
  assert.match(read("src/lib/store.ts"), /export async function redeemCard[\s\S]*?withDocumentLock\(STORE_FILE/);
  const dataDir = read("src/lib/dataDir.ts");
  assert.match(dataDir, /pg_advisory_xact_lock/);
  assert.match(dataDir, /SELECT 1 FROM mm_documents WHERE key = \$1 FOR UPDATE/);
});

test("redeem rate limit: 10 per 15 min per account, 30 per IP, then 429 until the window ends", () => {
  const t0 = 1_000_000;
  for (let i = 0; i < 10; i += 1) assert.equal(hitRedeemLimits("rl-user", "203.0.113.9", t0).ok, true);
  const blocked = hitRedeemLimits("rl-user", "203.0.113.9", t0);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfterSec > 0 && blocked.retryAfterSec <= 15 * 60);
  assert.equal(hitRedeemLimits("rl-user", "203.0.113.9", t0 + 15 * 60_000 + 1).ok, true, "window resets");
  // Per IP: 30 attempts from one address, spread over many accounts.
  for (let i = 0; i < 29; i += 1) assert.equal(hitRedeemLimits(`ip-user-${i}`, "198.51.100.7", t0).ok, true);
  assert.equal(hitRedeemLimits("ip-user-x", "198.51.100.7", t0).ok, true);
  assert.equal(hitRedeemLimits("ip-user-y", "198.51.100.7", t0).ok, false, "31st attempt from the IP is refused");
  assert.ok(redeemRateLimits.user && createRateLimiter);
});

describe("atomic redeem + admin creation on the shared in-memory backend", () => {
  const docs = new Map();
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  // Async jitter on every read/write so unlocked read-modify-write would interleave and lose updates.
  const backend = {
    async getJSON(key) {
      await sleep(Math.random() * 3);
      return docs.has(key) ? structuredClone(docs.get(key)) : null;
    },
    async setJSON(key, value) {
      await sleep(Math.random() * 3);
      docs.set(key, structuredClone(value));
    },
  };
  let dataDir, store, billing, redeem, auth;
  const user = (id, over = {}) => ({
    id,
    email: `${id}@example.com`,
    name: `Student ${id}`,
    role: "student",
    passwordHash: "x",
    createdAt: "2026-01-01T00:00:00.000Z",
    subscriptionType: null,
    liveCredits: 0,
    aiExpiresAt: null,
    ...over,
  });

  before(async () => {
    dataDir = await import("../src/lib/dataDir.ts");
    store = await import("../src/lib/store.ts");
    billing = await import("../src/lib/billing/store.ts");
    redeem = await import("../src/lib/cards/redeem.ts");
    auth = await import("../src/lib/auth/store.ts");
    dataDir.setPersistentStoreOverride(backend);
  });
  after(() => dataDir.setPersistentStoreOverride(null));
  beforeEach(() => {
    docs.clear();
    docs.set("auth.json", {
      users: Array.from({ length: 12 }, (_, i) => user(`u${i}`)),
      sessions: [],
      revokedTokens: [],
    });
  });

  test("20 concurrent redeems of one scratch card: exactly one wins, one entitlement, one ledger row", async () => {
    const [card] = await store.createScratchCards({ planId: "ai-monthly", count: 1 });
    const attempts = await Promise.all(
      Array.from({ length: 20 }, (_, i) => redeem.redeemCode({ code: card.code.toLowerCase(), userId: `u${i % 12}`, name: `S${i}` })),
    );
    const wins = attempts.filter((item) => item.ok);
    assert.equal(wins.length, 1, JSON.stringify(attempts.map((a) => a.ok || a.errorEn)));
    assert.equal(wins[0].kind, "card");
    assert.ok(attempts.filter((item) => !item.ok).every((item) => item.errorEn === "This card was already used."));
    const saved = docs.get("store.json");
    assert.equal(saved.scratchCards.find((item) => item.code === card.code).used, true);
    assert.equal(saved.entitlements.length, 1);
    const ledger = docs.get("billing.json").ledger.filter((row) => row.code === card.code);
    assert.equal(ledger.length, 1);
    const winner = docs.get("auth.json").users.find((item) => item.id === saved.entitlements[0].userId);
    assert.equal(winner.entitlementPlanId, "ai-monthly");
  });

  test("top-up: one code redeemed concurrently is credited once; different codes for one user all add up", async () => {
    const [single] = await billing.createTopUpCodes({ liveHours: 3, count: 1 });
    const results = await Promise.all(Array.from({ length: 15 }, () => billing.redeemTopUp(single.code, "u1", "S1")));
    assert.equal(results.filter((item) => item.ok).length, 1);
    assert.equal(docs.get("auth.json").users.find((item) => item.id === "u1").liveCredits, 3);

    const many = await billing.createTopUpCodes({ liveHours: 2, count: 8 });
    const viaRoute = await Promise.all(many.map((item) => redeem.redeemCode({ code: item.code, userId: "u2", name: "S2" })));
    assert.ok(viaRoute.every((item) => item.ok && item.kind === "topup"));
    const u2 = docs.get("auth.json").users.find((item) => item.id === "u2");
    assert.equal(u2.liveCredits, 16, "no lost update between concurrent top-ups");
    assert.equal(u2.subscriptionType, "LIVE_TIER");
    assert.equal(docs.get("billing.json").ledger.filter((row) => row.userId === "u2").length, 8);
  });

  test("existing valid cards keep working; used / expired / unknown codes are refused", async () => {
    docs.set("store.json", {
      ...(docs.get("store.json") ?? {}),
      library: [],
      drafts: [],
      scratchCards: [
        { code: "OLD-CARD1", planId: "ai-monthly", used: false, createdAt: "2026-01-01T00:00:00.000Z" },
        { code: "OLD-USED", planId: "ai-monthly", used: true, createdAt: "2026-01-01T00:00:00.000Z" },
        { code: "OLD-EXPIRED", planId: "ai-monthly", used: false, createdAt: "2026-01-01T00:00:00.000Z", expiresAt: "2026-02-01T00:00:00.000Z" },
      ],
      entitlements: [],
    });
    const ok = await redeem.redeemCode({ code: " old-card1 ", userId: "u3", name: "S3" });
    assert.equal(ok.ok, true);
    assert.equal(ok.user.entitlementPlanId, "ai-monthly");
    assert.equal(ok.user.subscriptionType, "AI_TIER");
    assert.equal((await redeem.redeemCode({ code: "OLD-USED", userId: "u3", name: "S3" })).errorEn, "This card was already used.");
    assert.equal((await redeem.redeemCode({ code: "OLD-EXPIRED", userId: "u3", name: "S3" })).errorEn, "This card has expired.");
    assert.equal((await redeem.redeemCode({ code: "NOPE", userId: "u3", name: "S3" })).errorEn, "Unknown card code.");
    const missingUser = await redeem.redeemCode({ code: "OLD-EXPIRED-NOT", userId: "ghost", name: "G" });
    assert.equal(missingUser.ok, false);
  });

  test("an unknown account never burns a valid card", async () => {
    const [card] = await store.createScratchCards({ planId: "ai-monthly", count: 1 });
    const result = await redeem.redeemCode({ code: card.code, userId: "ghost", name: "G" });
    assert.equal(result.ok, false);
    assert.equal(result.status, 404);
    assert.equal(docs.get("store.json").scratchCards.find((item) => item.code === card.code).used, false);
  });

  test("concurrent bulk generation loses no cards; custom duplicates are refused; creation is audited", async () => {
    await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        store.createScratchCards(
          { planId: "ai-monthly", count: 5, code: "batch" },
          { audit: (cards) => ({ action: "cards.create", actor: { id: "admin-1", role: "admin" }, details: { n: i, codes: cards.map((c) => codes.maskCardCode(c.code)) } }) },
        ),
      ),
    );
    const cards = docs.get("store.json").scratchCards;
    assert.equal(cards.length, 30);
    assert.equal(new Set(cards.map((card) => card.code)).size, 30);
    assert.ok(cards.every((card) => /^BATCH-[2-9A-HJKMNP-Z]{8}$/.test(card.code)));
    const audit = docs.get("audit-log.json").entries.filter((entry) => entry.action === "cards.create");
    assert.equal(audit.length, 6);
    assert.ok(audit.every((entry) => entry.details.codes.every((code) => code.includes("••"))), "audit never stores full codes");

    await store.createScratchCards({ planId: "ai-monthly", count: 1, code: "vip-2026" });
    await assert.rejects(store.createScratchCards({ planId: "ai-monthly", count: 1, code: "VIP-2026" }), codes.DuplicateCardCodeError);
    await billing.createTopUpCodes({ liveHours: 1, count: 1, code: "HRS-ONE" });
    await assert.rejects(billing.createTopUpCodes({ liveHours: 1, count: 1, code: "hrs-one" }), codes.DuplicateCardCodeError);
  });

  test("withDocumentLock is re-entrant (locked callers can read the same store without deadlock)", async () => {
    const value = await dataDir.withDocumentLock(["auth.json", "billing.json"], async () => {
      const inner = await dataDir.withDocumentLock("auth.json", async () => (await auth.findUserById("u4"))?.id);
      await auth.adjustLiveCredits("u4", 2);
      return inner;
    });
    assert.equal(value, "u4");
    assert.equal(docs.get("auth.json").users.find((item) => item.id === "u4").liveCredits, 2);
  });
});
