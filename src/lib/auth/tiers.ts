export const SUBSCRIPTION_TYPES = ["AI_TIER", "LIVE_TIER", "BOTH", "EXPIRED"] as const;
export type SubscriptionType = (typeof SUBSCRIPTION_TYPES)[number];

export type SubscriptionAccess = {
  subscriptionType: SubscriptionType | null;
  liveCredits: number;
  aiAccess: boolean;
  liveAccess: boolean;
  subscribed: boolean;
};

const AI_PLAN_IDS = new Set(["ai", "g7-9", "g11-12", "sat", "all"]);
const LIVE_PLAN_IDS = new Set(["live"]);
const BOTH_PLAN_IDS = new Set(["both"]);

export function isSubscriptionType(value: unknown): value is SubscriptionType {
  return typeof value === "string" && (SUBSCRIPTION_TYPES as readonly string[]).includes(value);
}

export function planIdToSubscriptionType(planId?: string | null): SubscriptionType | null {
  if (!planId) return null;
  const id = planId.trim().toLowerCase();
  if (BOTH_PLAN_IDS.has(id)) return "BOTH";
  if (LIVE_PLAN_IDS.has(id)) return "LIVE_TIER";
  if (AI_PLAN_IDS.has(id)) return "AI_TIER";
  return "AI_TIER";
}

export function liveCreditsForPlan(planId?: string | null): number {
  if (!planId) return 0;
  const id = planId.trim().toLowerCase();
  if (id === "both") return 8;
  if (id === "live") return 4;
  return 0;
}

export function mergeSubscription(
  current: SubscriptionType | null | undefined,
  incoming: SubscriptionType | null,
): SubscriptionType | null {
  if (!incoming || incoming === "EXPIRED") return current ?? incoming;
  if (!current || current === "EXPIRED") return incoming;
  if (current === incoming) return current;
  if (current === "BOTH" || incoming === "BOTH") return "BOTH";
  if (
    (current === "AI_TIER" && incoming === "LIVE_TIER") ||
    (current === "LIVE_TIER" && incoming === "AI_TIER")
  ) {
    return "BOTH";
  }
  return incoming;
}

export function accessFromSubscription(
  role: string | undefined,
  subscriptionType: SubscriptionType | null | undefined,
  liveCredits = 0,
): SubscriptionAccess {
  if (role === "teacher" || role === "admin") {
    return {
      subscriptionType: subscriptionType && subscriptionType !== "EXPIRED" ? subscriptionType : "BOTH",
      liveCredits: Math.max(liveCredits, 99),
      aiAccess: true,
      liveAccess: true,
      subscribed: true,
    };
  }
  const type = subscriptionType && subscriptionType !== "EXPIRED" ? subscriptionType : null;
  const aiAccess = type === "AI_TIER" || type === "BOTH";
  const liveAccess = type === "LIVE_TIER" || type === "BOTH";
  return {
    subscriptionType: type,
    liveCredits: Math.max(0, liveCredits),
    aiAccess,
    liveAccess,
    subscribed: aiAccess,
  };
}

export function subscriptionLabel(type: SubscriptionType | null | undefined) {
  if (type === "AI_TIER") return { en: "AI lessons + solver", ar: "دروس وحلّال الذكاء" };
  if (type === "LIVE_TIER") return { en: "Live 1-on-1", ar: "حصص مباشرة" };
  if (type === "BOTH") return { en: "AI + Live", ar: "ذكاء + مباشرة" };
  if (type === "EXPIRED") return { en: "Expired", ar: "منتهٍ" };
  return { en: "None", ar: "بدون اشتراك" };
}
