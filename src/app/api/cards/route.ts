/**
 * Scratch / activation cards. Creating (or bulk-generating) cards is ADMIN-ONLY (verified admin via
 * apiRequireAdmin — teachers are staff but cannot mint cards), same-origin, rate-limited and written to
 * mm_audit_log in the same transaction as the cards. Teachers still see the list, with codes masked.
 * Redeeming existing cards is unchanged (/api/redeem).
 */
import { NextResponse } from "next/server";
import { apiRequireAdmin, apiRequireStaff } from "@/lib/auth/guards";
import { actorOf, forbiddenOriginResponse, isVerifiedAdmin } from "@/lib/payments/http";
import { DuplicateCardCodeError, maskCardCode } from "@/lib/cards/codes";
import { cardAdminRateLimits, clientIpFrom, tooManyRequestsBody } from "@/lib/security/rateLimit";
import { isSameOriginRequest } from "@/lib/security/origin";
import { createScratchCards, readStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await apiRequireStaff();
  if (guard.error) return guard.error;
  const store = await readStore();
  const admin = isVerifiedAdmin(guard.live.user);
  // Unused codes are bearer credentials: only an admin sees them in full.
  const cards = admin ? store.scratchCards : store.scratchCards.map((card) => ({ ...card, code: maskCardCode(card.code) }));
  return NextResponse.json({ cards, entitlements: store.entitlements, codesMasked: !admin });
}

export async function POST(request: Request) {
  const guard = await apiRequireAdmin();
  if (guard.error) return guard.error;
  if (!isSameOriginRequest(request.headers)) return forbiddenOriginResponse();
  const admin = guard.live.user;
  const hit = cardAdminRateLimits.create.hit(admin.id);
  if (!hit.ok) return NextResponse.json(tooManyRequestsBody(hit.retryAfterSec), { status: 429 });

  const body = (await request.json().catch(() => ({}))) as {
    code?: unknown;
    planId?: unknown;
    count?: unknown;
    note?: unknown;
    expiresAt?: unknown;
  };
  const planId = typeof body.planId === "string" ? body.planId.trim() : "";
  if (!planId) return NextResponse.json({ error: "اختر الدورة أو الصف" }, { status: 400 });
  const ip = clientIpFrom(request.headers);
  try {
    const created = await createScratchCards(
      {
        code: typeof body.code === "string" ? body.code.slice(0, 40) : undefined,
        planId: planId.slice(0, 80),
        count: typeof body.count === "number" ? body.count : Number(body.count) || 1,
        note: typeof body.note === "string" ? body.note.slice(0, 300) : undefined,
        expiresAt: typeof body.expiresAt === "string" && body.expiresAt ? body.expiresAt.slice(0, 40) : undefined,
      },
      {
        audit: (cards) => ({
          action: "cards.create",
          actor: actorOf(admin),
          target: cards[0]?.batchId ?? null,
          ip,
          details: {
            planId,
            count: cards.length,
            batchId: cards[0]?.batchId ?? null,
            expiresAt: cards[0]?.expiresAt ?? null,
            codes: cards.map((card) => maskCardCode(card.code)),
          },
        }),
      },
    );
    return NextResponse.json({ created });
  } catch (error) {
    if (error instanceof DuplicateCardCodeError) {
      return NextResponse.json({ error: "هذا الكود موجود مسبقاً", errorEn: "This code already exists." }, { status: 409 });
    }
    throw error;
  }
}
