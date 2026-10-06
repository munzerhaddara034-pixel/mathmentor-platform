/** Pure notification texts (owner alert, owner e-mail, student result). Unit-tested. */
import type { PaymentRecord } from "./types";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const methodLabel = (method: PaymentRecord["method"]) => (method === "omt" ? "OMT" : "Whish");

export function formatUsd(amount: number): string {
  return `${amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2)} USD`;
}

export function beirutTime(isoValue: string | null | undefined): string {
  if (!isoValue) return "—";
  return `${new Date(isoValue).toLocaleString("en-GB", { timeZone: "Asia/Beirut", dateStyle: "medium", timeStyle: "short" })} (Beirut)`;
}

export function beirutDay(isoValue: string | null | undefined): string {
  if (!isoValue) return "—";
  return new Date(isoValue).toLocaleDateString("en-GB", { timeZone: "Asia/Beirut", dateStyle: "medium" });
}

/** "gcc (location: gcc, ip: lebanon)" — region names + sources only. */
export function regionLine(p: Pick<PaymentRecord, "pricingRegion" | "regionSources">): string {
  const sources = Object.entries(p.regionSources ?? {}).map(([source, region]) => `${source}: ${region}`);
  return `${p.pricingRegion ?? "—"}${sources.length ? ` (${sources.join(", ")})` : ""}`;
}

function detailLines(p: PaymentRecord, flags: string[]): Array<[string, string]> {
  return [
    ["Student", p.payerName],
    ["Email", p.payerEmail || "—"],
    ["Phone", p.payerPhone || "—"],
    ["Plan", `${p.plan} (${p.period})`],
    ["Amount", `${formatUsd(p.amount)} (expected ${formatUsd(p.expectedAmountUsd)})`],
    ["Region", regionLine(p)],
    ["Method", methodLabel(p.method)],
    ["Reference", p.reference],
    ["Transfer date", p.transferDate],
    ["Submitted", beirutTime(p.submittedAt)],
    ["Receipt", p.receiptUrl ? "attached" : "none"],
    ["Flags", flags.length ? flags.join(", ") : "none"],
    ["Payment id", p.id],
  ];
}

export function paymentFlags(p: PaymentRecord, extra?: { duplicateReceipt?: boolean }): string[] {
  const flags: string[] = [];
  if (Math.abs(p.amount - p.expectedAmountUsd) >= 0.01) flags.push("AMOUNT MISMATCH");
  if (extra?.duplicateReceipt) flags.push("RECEIPT IMAGE USED BEFORE");
  if (p.regionMismatch) flags.push("REGION SIGNALS DISAGREE (charged the most expensive)");
  return flags;
}

export function ownerAlertText(p: PaymentRecord, adminLink: string, flags: string[] = paymentFlags(p)): { body: string; bodyAr: string } {
  const lines = detailLines(p, flags).map(([label, value]) => `${label}: ${value}`);
  const body = `MathMentor · Payment pending review\n${lines.join("\n")}\nReview: ${adminLink}\nNothing is activated until you press Confirm.`;
  const bodyAr = `MathMentor · دفعة بانتظار المراجعة\nالطالب: ${p.payerName}\nالمبلغ: ${formatUsd(p.amount)} عبر ${methodLabel(p.method)}\nالمرجع: ${p.reference}\nراجِع: ${adminLink}\nلا يُفعَّل أي اشتراك قبل ضغط «تأكيد».`;
  return { body, bodyAr };
}

export function ownerEmail(p: PaymentRecord, adminLink: string, flags: string[] = paymentFlags(p)): { subject: string; text: string; html: string } {
  const rows = detailLines(p, flags);
  const subject = `[MathMentor] Payment pending · ${p.payerName} · ${formatUsd(p.amount)} · ${methodLabel(p.method)} #${p.reference}`.slice(0, 240);
  const text = `${rows.map(([label, value]) => `${label}: ${value}`).join("\n")}\n\nReview: ${adminLink}\nThe subscription is NOT activated until you confirm.`;
  const html = `<h2>Payment pending review</h2><table cellpadding="4">${rows
    .map(([label, value]) => `<tr><th align="left">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`)
    .join("")}</table><p><a href="${escapeHtml(adminLink)}">Open /admin/payments</a></p><p>The subscription is NOT activated until you confirm.</p>`;
  return { subject, text, html };
}

export function studentResultText(p: PaymentRecord): { title: string; titleAr: string; body: string; bodyAr: string; subject: string } {
  if (p.status === "confirmed") {
    const until = beirutDay(p.periodEnd);
    return {
      subject: "[MathMentor] Payment confirmed — subscription active",
      title: "Payment confirmed",
      titleAr: "تم تأكيد الدفع",
      body: `Prof. Munzer Haddara confirmed your ${methodLabel(p.method)} payment (${formatUsd(p.amount)}, ref ${p.reference}). Your plan ${p.plan} is active until ${until}.`,
      bodyAr: `أكّد الأستاذ منذر حداره دفعتك عبر ${methodLabel(p.method)} (${formatUsd(p.amount)}، المرجع ${p.reference}). باقتك ${p.plan} فعّالة حتى ${until}.`,
    };
  }
  return {
    subject: "[MathMentor] Payment not received",
    title: "Payment not received",
    titleAr: "لم يتم استلام الدفعة",
    body: `We could not find your ${methodLabel(p.method)} payment (ref ${p.reference}). Note: ${p.note ?? "—"}. You can submit again from /wallet/pay.`,
    bodyAr: `لم نجد دفعتك عبر ${methodLabel(p.method)} (المرجع ${p.reference}). ملاحظة: ${p.note ?? "—"}. يمكنك الإرسال من جديد من /wallet/pay.`,
  };
}
