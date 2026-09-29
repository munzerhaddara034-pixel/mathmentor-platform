/** Browser-side session helpers (no server secrets). */

export type ClientSessionUser = {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: string;
  entitlementPlanId?: string;
  subscriptionType: string | null;
  liveCredits: number;
  aiExpiresAt: string | null;
};

export type ClientSessionPayload = {
  ok: boolean;
  reason?: string;
  user?: ClientSessionUser;
  subscribed?: boolean;
  aiAccess?: boolean;
  liveAccess?: boolean;
  subscriptionType?: string | null;
  liveCredits?: number;
  aiExpiresAt?: string | null;
  canTeach?: boolean;
  error?: string;
  errorAr?: string;
};

/** Fetch current session + entitlements (credentials included). */
export async function fetchClientSession(): Promise<ClientSessionPayload> {
  try {
    const response = await fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" });
    const payload = (await response.json()) as ClientSessionPayload;
    return payload;
  } catch {
    return { ok: false, error: "Network error.", errorAr: "خطأ في الشبكة." };
  }
}

/**
 * After redeem / subscribe, call this then `router.refresh()` so RSC layouts
 * and client guards see the new AI / live entitlements without logout.
 */
export async function refreshClientEntitlements(): Promise<ClientSessionPayload> {
  return fetchClientSession();
}
