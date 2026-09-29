/**
 * Soft paywall copy for the exams hub (browse stays open; simulator/API still use userHasAiAccess).
 * Layout `/exams` already calls requireAiAccess — see docs/PAYWALL_ACCESS.md.
 */

export const EXAM_PAYWALL_HOOK = {
  /** Soft copy shown on the hub; never blocks browsing papers list copy. */
  hintEn: "Full AI barème grading needs an active AI / SAT plan from Prof. Munzer Haddara.",
  hintAr: "تصحيح السلّم بالذكاء يحتاج اشتراك AI / SAT من الأستاذ منذر حداره.",
  subscribeHref: "/subscribe",
  redeemHref: "/redeem?need=ai",
  /** Soft flag — hard gate is requireAiAccess on layout + API userHasAiAccess. */
  enforcePaywall: true as const,
} as const;
