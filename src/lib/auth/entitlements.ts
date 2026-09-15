import { randomBytes } from "node:crypto";
import {
  DEMO_PROMO_CODES,
  PLAN_TRACKS,
  PROMO_CODE_LENGTH,
  isValidPromoCode,
  normalizePromoCode,
  type EntitlementRecord,
  type PromoCodeRecord,
  type ScopeKind,
} from "@/lib/access";
import { academyLessons } from "@/lib/academyLessons";
import { createId } from "@/lib/ids";
import { getAuthDb } from "./db";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

type PromoRow = {
  code: string;
  scope_kind: string;
  scope_id: string;
  created_at: string;
  expires_at: string | null;
  batch_id: string | null;
  note: string | null;
  redeemed_by: string | null;
  redeemed_at: string | null;
  redeemed_name: string | null;
  redeemed_phone: string | null;
};

type EntitlementRow = {
  id: string;
  user_id: string;
  scope_kind: string;
  scope_id: string;
  source_code: string | null;
  unlocked_at: string;
};

type OverrideRow = {
  key: string;
  kind: string;
  enabled: number;
  title: string | null;
  arabic_title: string | null;
  video_url: string | null;
  video_url_fr: string | null;
  notes: string | null;
  updated_at: string;
};

export type ContentOverride = {
  key: string;
  kind: "lesson" | "bank" | "exam-cert";
  enabled: boolean;
  title?: string;
  arabicTitle?: string;
  videoUrl?: string;
  videoUrlFr?: string;
  notes?: string;
  updatedAt: string;
};

function asScopeKind(value: string): ScopeKind {
  if (value === "track" || value === "lesson") return value;
  return "plan";
}

function toPromo(row: PromoRow): PromoCodeRecord {
  return {
    code: row.code,
    scopeKind: asScopeKind(row.scope_kind),
    scopeId: row.scope_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at ?? undefined,
    batchId: row.batch_id ?? undefined,
    note: row.note ?? undefined,
    used: Boolean(row.redeemed_by),
    redeemedBy: row.redeemed_by ?? undefined,
    redeemedAt: row.redeemed_at ?? undefined,
    redeemedName: row.redeemed_name ?? undefined,
    redeemedPhone: row.redeemed_phone ?? undefined,
  };
}

function generateCode() {
  const bytes = randomBytes(PROMO_CODE_LENGTH);
  let out = "";
  for (let i = 0; i < PROMO_CODE_LENGTH; i += 1) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

export function listPromoCodes(): PromoCodeRecord[] {
  const rows = getAuthDb()
    .prepare(
      `SELECT * FROM promo_codes
       ORDER BY CASE WHEN redeemed_at IS NULL THEN 0 ELSE 1 END, created_at DESC`,
    )
    .all() as PromoRow[];
  return rows.map(toPromo);
}

export function promoStats() {
  const row = getAuthDb()
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN redeemed_by IS NULL THEN 1 ELSE 0 END) AS unused,
         SUM(CASE WHEN redeemed_by IS NOT NULL THEN 1 ELSE 0 END) AS used
       FROM promo_codes`,
    )
    .get() as { total: number; unused: number; used: number };
  return {
    total: Number(row.total ?? 0),
    unused: Number(row.unused ?? 0),
    used: Number(row.used ?? 0),
  };
}

export function createPromoCodes(input: {
  scopeKind: ScopeKind;
  scopeId: string;
  count?: number;
  expiresAt?: string;
  note?: string;
  code?: string;
}) {
  const db = getAuthDb();
  const count = Math.min(Math.max(input.count ?? 1, 1), 100);
  const batchId = createId("batch");
  const now = new Date().toISOString();
  const insert = db.prepare(
    `INSERT INTO promo_codes
      (code, scope_kind, scope_id, created_at, expires_at, batch_id, note, redeemed_by, redeemed_at, redeemed_name, redeemed_phone)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL)`,
  );
  const created: PromoCodeRecord[] = [];
  for (let i = 0; i < count; i += 1) {
    const requested =
      count === 1 && input.code?.trim() ? normalizePromoCode(input.code) : generateCode();
    if (!isValidPromoCode(requested)) {
      throw new Error("الكود يجب أن يكون 12 حرفاً أو رقماً");
    }
    let code = requested;
    let attempts = 0;
    while (attempts < 8) {
      try {
        insert.run(
          code,
          input.scopeKind,
          input.scopeId,
          now,
          input.expiresAt || null,
          batchId,
          input.note || null,
        );
        created.push({
          code,
          scopeKind: input.scopeKind,
          scopeId: input.scopeId,
          createdAt: now,
          expiresAt: input.expiresAt || undefined,
          batchId,
          note: input.note,
          used: false,
        });
        break;
      } catch {
        if (count === 1 && input.code?.trim()) {
          throw new Error("هذا الكود موجود مسبقاً");
        }
        code = generateCode();
        attempts += 1;
      }
    }
  }
  return created;
}

export function listEntitlements(userId: string): EntitlementRecord[] {
  const rows = getAuthDb()
    .prepare("SELECT * FROM user_entitlements WHERE user_id = ? ORDER BY unlocked_at DESC")
    .all(userId) as EntitlementRow[];
  return rows.map((row) => ({
    scopeKind: asScopeKind(row.scope_kind),
    scopeId: row.scope_id,
    sourceCode: row.source_code ?? undefined,
    unlockedAt: row.unlocked_at,
  }));
}

export function redeemPromoCode(input: {
  code: string;
  userId: string;
  name: string;
  phone?: string | null;
}) {
  const code = normalizePromoCode(input.code);
  if (!isValidPromoCode(code)) {
    return { ok: false as const, error: "أدخل كوداً من 12 حرفاً أو رقماً" };
  }
  const db = getAuthDb();
  const row = db.prepare("SELECT * FROM promo_codes WHERE code = ?").get(code) as PromoRow | undefined;
  if (!row) return { ok: false as const, error: "رمز غير صحيح" };
  if (row.redeemed_by) return { ok: false as const, error: "هذه البطاقة مستخدمة" };
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false as const, error: "انتهت صلاحية هذا الكود" };
  }
  const now = new Date().toISOString();
  db.exec("BEGIN");
  try {
    db.prepare(
      `UPDATE promo_codes
       SET redeemed_by = ?, redeemed_at = ?, redeemed_name = ?, redeemed_phone = ?
       WHERE code = ? AND redeemed_by IS NULL`,
    ).run(input.userId, now, input.name, input.phone ?? null, code);
    db.prepare(
      `INSERT OR IGNORE INTO user_entitlements (id, user_id, scope_kind, scope_id, source_code, unlocked_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(createId("ent"), input.userId, row.scope_kind, row.scope_id, code, now);
    const tracks =
      row.scope_kind === "plan"
        ? PLAN_TRACKS[row.scope_id] ?? []
        : row.scope_kind === "track"
          ? [row.scope_id]
          : [];
    const enroll = db.prepare(
      `INSERT OR IGNORE INTO enrollments (id, user_id, track, progress, created_at) VALUES (?, ?, ?, 0, ?)`,
    );
    for (const track of tracks) {
      enroll.run(createId("enr"), input.userId, track, now);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return {
    ok: true as const,
    scopeKind: asScopeKind(row.scope_kind),
    scopeId: row.scope_id,
    entitlements: listEntitlements(input.userId),
  };
}

export function listContentOverrides(): ContentOverride[] {
  const rows = getAuthDb().prepare("SELECT * FROM content_overrides").all() as OverrideRow[];
  return rows.map((row) => ({
    key: row.key,
    kind: (row.kind as ContentOverride["kind"]) || "lesson",
    enabled: row.enabled !== 0,
    title: row.title ?? undefined,
    arabicTitle: row.arabic_title ?? undefined,
    videoUrl: row.video_url ?? undefined,
    videoUrlFr: row.video_url_fr ?? undefined,
    notes: row.notes ?? undefined,
    updatedAt: row.updated_at,
  }));
}

export function upsertContentOverride(input: {
  key: string;
  kind: ContentOverride["kind"];
  enabled?: boolean;
  title?: string | null;
  arabicTitle?: string | null;
  videoUrl?: string | null;
  videoUrlFr?: string | null;
  notes?: string | null;
}) {
  const current = listContentOverrides().find((item) => item.key === input.key);
  const enabled = input.enabled ?? current?.enabled ?? true;
  const title = input.title === undefined ? current?.title ?? null : input.title;
  const arabicTitle = input.arabicTitle === undefined ? current?.arabicTitle ?? null : input.arabicTitle;
  const videoUrl = input.videoUrl === undefined ? current?.videoUrl ?? null : input.videoUrl;
  const videoUrlFr = input.videoUrlFr === undefined ? current?.videoUrlFr ?? null : input.videoUrlFr;
  const notes = input.notes === undefined ? current?.notes ?? null : input.notes;
  const now = new Date().toISOString();
  getAuthDb()
    .prepare(
      `INSERT INTO content_overrides (key, kind, enabled, title, arabic_title, video_url, video_url_fr, notes, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         kind = excluded.kind,
         enabled = excluded.enabled,
         title = excluded.title,
         arabic_title = excluded.arabic_title,
         video_url = excluded.video_url,
         video_url_fr = excluded.video_url_fr,
         notes = excluded.notes,
         updated_at = excluded.updated_at`,
    )
    .run(
      input.key,
      input.kind,
      enabled ? 1 : 0,
      title,
      arabicTitle,
      videoUrl,
      videoUrlFr,
      notes,
      now,
    );
  return listContentOverrides().find((item) => item.key === input.key)!;
}

export function isContentEnabled(kind: ContentOverride["kind"], id: string) {
  const row = listContentOverrides().find((item) => item.key === `${kind}:${id}`);
  return row ? row.enabled : true;
}

export function publishedLessons() {
  const overrides = new Map(listContentOverrides().filter((item) => item.kind === "lesson").map((item) => [item.key, item]));
  return academyLessons.map((lesson) => {
    const override = overrides.get(`lesson:${lesson.id}`);
    return {
      ...lesson,
      title: override?.title || lesson.title,
      arabicTitle: override?.arabicTitle || lesson.arabicTitle,
      videoUrl: override?.videoUrl || lesson.videoUrl,
      videoUrlFr: override?.videoUrlFr || lesson.videoUrlFr,
      enabled: override ? override.enabled : true,
    };
  });
}

export function ensureDemoPromoCodes() {
  const db = getAuthDb();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO promo_codes
      (code, scope_kind, scope_id, created_at, expires_at, batch_id, note, redeemed_by, redeemed_at, redeemed_name, redeemed_phone)
     VALUES (?, ?, ?, ?, NULL, 'demo-seed', ?, NULL, NULL, NULL, NULL)`,
  );
  const now = new Date().toISOString();
  for (const item of DEMO_PROMO_CODES) {
    insert.run(item.code, item.scopeKind, item.scopeId, now, item.note);
  }
}
