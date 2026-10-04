/**
 * One entry point for redeeming a printed code: live-hour top-up codes (billing.json) first, then
 * scratch / activation cards (store.json). The whole redeem runs under ONE withDocumentLock over
 * auth.json + billing.json + store.json: in-process mutex, and on Postgres a single transaction with
 * pg_advisory_xact_lock + SELECT … FOR UPDATE on each document. Claiming the card, granting the
 * entitlement / credits and the ledger row therefore commit together (or roll back together), and two
 * concurrent redeems of one card — on one instance or several — can never both succeed.
 * Notifications (WhatsApp) are sent by the caller AFTER the lock is released.
 */
import { withDocumentLock } from "@/lib/dataDir";
import { AUTH_DOCUMENT_KEY, findUserById, setUserEntitlement, type PublicUser } from "@/lib/auth/store";
import { BILLING_DOCUMENT_KEY, recordActivation, redeemTopUp } from "@/lib/billing/store";
import { STORE_DOCUMENT_KEY, redeemCard } from "@/lib/store";

export const REDEEM_DOCUMENT_KEYS = [AUTH_DOCUMENT_KEY, BILLING_DOCUMENT_KEY, STORE_DOCUMENT_KEY];

export type RedeemOutcome =
  | { ok: true; kind: "topup"; hours: number; liveCredits: number; code: string }
  | { ok: true; kind: "card"; planId: string; user: PublicUser; code: string }
  | { ok: false; error: string; errorEn: string; status: number };

export async function redeemCode(input: { code: string; userId: string; name: string; phone?: string }): Promise<RedeemOutcome> {
  const code = input.code.trim();
  if (!code) return { ok: false, error: "أدخل رمز البطاقة", errorEn: "Enter a card code.", status: 400 };
  return withDocumentLock(REDEEM_DOCUMENT_KEYS, async () => {
    const topup = await redeemTopUp(code, input.userId, input.name);
    if (topup.ok) return { ok: true as const, kind: "topup" as const, hours: topup.hours, liveCredits: topup.liveCredits, code: topup.code };
    if (topup.reason !== "unknown") return { ok: false as const, error: topup.error, errorEn: topup.errorEn, status: 400 };

    // Check the account BEFORE claiming, so the file backend (no rollback) never burns a card for nobody.
    if (!(await findUserById(input.userId))) {
      return { ok: false as const, error: "الحساب غير موجود", errorEn: "Account not found.", status: 404 };
    }
    const card = await redeemCard(code, input.name, input.phone || undefined, input.userId);
    if (!card.ok) {
      const errorEn = card.reason === "used" ? "This card was already used." : card.reason === "expired" ? "This card has expired." : "Unknown card code.";
      return { ok: false as const, error: card.error, errorEn, status: 400 };
    }
    const user = await setUserEntitlement(input.userId, card.planId);
    // Unreachable after the check above; throwing rolls the claim back on Postgres.
    if (!user) throw new Error("redeem: account disappeared while locked");
    await recordActivation(input.userId, card.planId, card.code);
    return { ok: true as const, kind: "card" as const, planId: card.planId, user, code: card.code };
  });
}
