/**
 * Manual Whish Money transfer helpers.
 *
 * Munzer does not use Whish merchant API keys. Students transfer to the Whish
 * wallet number below; orders/bookings stay `pending_payment` until marked paid.
 * Optional WHISH_* merchant env vars are documented only for a future API path.
 *
 * All money (subscriptions + live sessions) goes through Whish only.
 * Dual live pricing:
 * - member (platform) — logged-in with AI_TIER | LIVE_TIER | BOTH → $15
 * - external — guest or no active plan → $25
 */

export type WhishCurrency = "USD" | "LBP";

export type PricingTier = "member" | "external";

export type LiveSessionPrice = {
  usd?: number;
  lbp?: number;
  amount: number;
  currency: WhishCurrency;
  display: string;
  displayAr: string;
  configured: boolean;
  tier: PricingTier;
};

export type WhishTransferInstructions = {
  phone: string;
  nameAr: string;
  nameEn: string;
  price: LiveSessionPrice;
  linesEn: string[];
  linesAr: string[];
};

function trimEnv(name: string) {
  return process.env[name]?.trim() || "";
}

function parsePositiveAmount(raw: string, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : fallback;
}

function formatUsd(amount: number) {
  return amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2);
}

/** Manual transfer flow is always on unless explicitly disabled. */
export function whishEnabled() {
  const flag = trimEnv("WHISH_ENABLED");
  if (!flag) return true;
  return !["0", "false", "off", "no"].includes(flag.toLowerCase());
}

export function whishTransferPhone() {
  return (
    trimEnv("WHISH_TRANSFER_PHONE") ||
    trimEnv("TEACHER_WHATSAPP") ||
    "96170772968"
  );
}

export function whishTransferNameAr() {
  return trimEnv("WHISH_TRANSFER_NAME") || "منذر أحمد حداره";
}

export function whishTransferNameEn() {
  return "Munzer Ahmad Haddara";
}

/** Member / platform price (default 15). Reads LIVE_SESSION_PRICE_USD each call. */
export function memberSessionAmountUsd() {
  return parsePositiveAmount(
    trimEnv("LIVE_SESSION_PRICE_USD") || trimEnv("NEXT_PUBLIC_LIVE_SESSION_PRICE_USD"),
    15,
  );
}

/** External / guest price (default 25). */
export function externalSessionAmountUsd() {
  return parsePositiveAmount(
    trimEnv("LIVE_SESSION_PRICE_EXTERNAL_USD") ||
      trimEnv("NEXT_PUBLIC_LIVE_SESSION_PRICE_EXTERNAL_USD"),
    25,
  );
}

/**
 * Price for a live session by audience.
 * `kind` "member" → LIVE_SESSION_PRICE_USD (default 15)
 * `kind` "external" → LIVE_SESSION_PRICE_EXTERNAL_USD (default 25)
 */
export function liveSessionPriceFor(kind: PricingTier = "member"): LiveSessionPrice {
  const lbpRaw = trimEnv("LIVE_SESSION_PRICE_LBP");
  const lbp = lbpRaw ? Number(lbpRaw) : undefined;
  const lbpOk = typeof lbp === "number" && Number.isFinite(lbp) && lbp > 0;

  const usd = kind === "external" ? externalSessionAmountUsd() : memberSessionAmountUsd();
  const tierLabelEn = kind === "member" ? "platform member" : "outside platform";
  const tierLabelAr = kind === "member" ? "مشترك المنصة" : "خارج المنصة";
  const usdPart = `$${formatUsd(usd)} USD`;
  const parts = [usdPart];
  if (lbpOk) parts.push(`${Math.round(lbp!).toLocaleString("en-US")} LBP`);
  const base = parts.join(" · ");

  return {
    usd,
    lbp: lbpOk ? lbp : undefined,
    amount: usd,
    currency: "USD",
    display: `${base} (${tierLabelEn})`,
    displayAr: `${base} (${tierLabelAr})`,
    configured: true,
    tier: kind,
  };
}

/** Member/platform price — backward-compatible alias for liveSessionPriceFor("member"). */
export function liveSessionPrice(): LiveSessionPrice {
  return liveSessionPriceFor("member");
}

export function dualLiveSessionPrices() {
  const member = liveSessionPriceFor("member");
  const external = liveSessionPriceFor("external");
  return {
    member,
    external,
    bannerEn: `Platform member $${formatUsd(member.amount)} · Outside platform $${formatUsd(external.amount)}`,
    bannerAr: `مشترك المنصة $${formatUsd(member.amount)} · خارج المنصة $${formatUsd(external.amount)}`,
  };
}

/** Arbitrary USD amount for subscriptions (or custom) Whish checkout. */
export function priceFromUsd(
  amount: number,
  opts?: { labelEn?: string; labelAr?: string; tier?: PricingTier },
): LiveSessionPrice {
  const usd = typeof amount === "number" && Number.isFinite(amount) && amount > 0 ? amount : 0;
  const labelEn = opts?.labelEn ? ` (${opts.labelEn})` : "";
  const labelAr = opts?.labelAr ? ` (${opts.labelAr})` : "";
  const base = `$${formatUsd(usd)} USD`;
  return {
    usd,
    amount: usd,
    currency: "USD",
    display: `${base}${labelEn}`,
    displayAr: `${base}${labelAr}`,
    configured: usd > 0,
    tier: opts?.tier ?? "member",
  };
}

export function whishTransferInstructions(kind: PricingTier = "member"): WhishTransferInstructions {
  return whishTransferInstructionsForAmount(liveSessionPriceFor(kind).amount, {
    labelEn: kind === "member" ? "platform member live" : "outside platform live",
    labelAr: kind === "member" ? "حصة مشترك المنصة" : "حصة خارج المنصة",
    tier: kind,
  });
}

/** Transfer instructions for any exact USD amount (subscriptions + live). */
export function whishTransferInstructionsForAmount(
  amountUsd: number,
  opts?: { labelEn?: string; labelAr?: string; tier?: PricingTier; context?: "live" | "subscription" },
): WhishTransferInstructions {
  const phone = whishTransferPhone();
  const nameAr = whishTransferNameAr();
  const nameEn = whishTransferNameEn();
  const price = priceFromUsd(amountUsd, opts);
  const amountLine = price.configured ? price.display : "amount confirmed by the teacher";
  const amountLineAr = price.configured ? price.displayAr : "المبلغ يحدده الأستاذ";
  const context = opts?.context ?? "live";
  const afterEn =
    context === "subscription"
      ? "After transfer, tap “I've transferred” (or wait for the teacher to confirm). Your plan activates after confirmation."
      : "After transfer, tap “I've transferred” on your booking (or wait for the teacher to confirm).";
  const afterAr =
    context === "subscription"
      ? "بعد التحويل اضغط «لقد حوّلت» (أو انتظر تأكيد الأستاذ). يُفعَّل الاشتراك بعد التأكيد."
      : "بعد التحويل اضغط «لقد حوّلت» على حجزك (أو انتظر تأكيد الأستاذ).";
  const holdEn =
    context === "subscription"
      ? "Your subscription order is pending payment until confirmed."
      : "Your slot is held as pending payment until confirmed.";
  const holdAr =
    context === "subscription"
      ? "طلب الاشتراك بانتظار الدفع حتى التأكيد."
      : "الموعد محجوز بحالة بانتظار الدفع حتى التأكيد.";

  return {
    phone,
    nameAr,
    nameEn,
    price,
    linesEn: [
      `Transfer via Whish Money to ${phone}`,
      `Recipient name: ${nameEn} / ${nameAr}`,
      `Amount: ${amountLine}`,
      afterEn,
      holdEn,
    ],
    linesAr: [
      `حوّل عبر تطبيق Whish Money إلى الرقم ${phone}`,
      `اسم المستلم: ${nameAr}`,
      `المبلغ: ${amountLineAr}`,
      afterAr,
      holdAr,
    ],
  };
}
