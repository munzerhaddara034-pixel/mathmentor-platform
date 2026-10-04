/**
 * Live-hour top-up codes. Generating codes is ADMIN-ONLY (verified admin via apiRequireAdmin),
 * same-origin, rate-limited and audited (mm_audit_log, same transaction as the codes).
 * Teachers keep a read-only list with the codes masked.
 */
import { NextResponse } from "next/server";
import { apiRequireAdmin, apiRequireStaff } from "@/lib/auth/guards";
import { createTopUpCodes, listTopUpCodes } from "@/lib/billing/store";
import { DuplicateCardCodeError, maskCardCode } from "@/lib/cards/codes";
import { actorOf, forbiddenOriginResponse, isVerifiedAdmin } from "@/lib/payments/http";
import { cardAdminRateLimits, clientIpFrom, tooManyRequestsBody } from "@/lib/security/rateLimit";
import { isSameOriginRequest } from "@/lib/security/origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await apiRequireStaff();
  if (guard.error) return guard.error;
  const codes = await listTopUpCodes();
  const admin = isVerifiedAdmin(guard.live.user);
  return NextResponse.json({
    codes: admin ? codes : codes.map((item) => ({ ...item, code: maskCardCode(item.code) })),
    codesMasked: !admin,
  });
}

export async function POST(request: Request) {
  const guard = await apiRequireAdmin();
  if (guard.error) return guard.error;
  if (!isSameOriginRequest(request.headers)) return forbiddenOriginResponse();
  const admin = guard.live.user;
  const hit = cardAdminRateLimits.create.hit(admin.id);
  if (!hit.ok) return NextResponse.json(tooManyRequestsBody(hit.retryAfterSec), { status: 429 });

  const body = (await request.json().catch(() => ({}))) as {
    prefix?: unknown;
    code?: unknown;
    liveHours?: unknown;
    count?: unknown;
    note?: unknown;
    expiresAt?: unknown;
  };
  const hours = Number(body.liveHours ?? 2);
  if (!Number.isFinite(hours) || hours < 1 || hours > 200) {
    return NextResponse.json({ error: "liveHours must be between 1 and 200." }, { status: 400 });
  }
  const ip = clientIpFrom(request.headers);
  try {
    const created = await createTopUpCodes(
      {
        prefix: typeof body.prefix === "string" ? body.prefix.slice(0, 40) : undefined,
        code: typeof body.code === "string" ? body.code.slice(0, 40) : undefined,
        liveHours: hours,
        count: typeof body.count === "number" ? body.count : Number(body.count) || 1,
        note: typeof body.note === "string" ? body.note.slice(0, 300) : undefined,
        expiresAt: typeof body.expiresAt === "string" && body.expiresAt ? body.expiresAt.slice(0, 40) : undefined,
        createdBy: admin.id,
      },
      {
        audit: (codes) => ({
          action: "topup.create",
          actor: actorOf(admin),
          target: codes[0] ? maskCardCode(codes[0].code) : null,
          ip,
          details: {
            liveHours: codes[0]?.liveHours ?? hours,
            count: codes.length,
            expiresAt: codes[0]?.expiresAt ?? null,
            codes: codes.map((item) => maskCardCode(item.code)),
          },
        }),
      },
    );
    return NextResponse.json({ ok: true, created });
  } catch (error) {
    if (error instanceof DuplicateCardCodeError) {
      return NextResponse.json({ error: "This code already exists.", errorAr: "هذا الكود موجود مسبقاً" }, { status: 409 });
    }
    throw error;
  }
}
