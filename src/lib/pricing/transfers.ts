/**
 * Manual transfer instructions for Whish, Western Union, and OMT.
 * Beneficiary: منذر أحمد حداره / Munzer Ahmad Haddara.
 * No auto-API — students transfer manually, then mark transferred.
 */

import {
  whishTransferInstructionsForAmount,
  whishTransferNameAr,
  whishTransferNameEn,
  whishTransferPhone,
  type WhishTransferInstructions,
} from "@/lib/whish/client";
import type { PaymentMethod } from "@/lib/pricing/plans";

export type ManualTransferInstructions = {
  method: PaymentMethod;
  titleEn: string;
  titleAr: string;
  beneficiaryAr: string;
  beneficiaryEn: string;
  amountUsd: number;
  linesEn: string[];
  linesAr: string[];
  /** Whish wallet phone when method is whish */
  phone?: string;
  /** Optional city / country notes from env */
  extras: Record<string, string>;
};

function env(name: string): string {
  return process.env[name]?.trim() || "";
}

export function westernUnionBeneficiary() {
  return {
    nameAr: env("WU_BENEFICIARY_NAME_AR") || whishTransferNameAr() || "منذر أحمد حداره",
    nameEn: env("WU_BENEFICIARY_NAME_EN") || whishTransferNameEn() || "Munzer Ahmad Haddara",
    country: env("WU_BENEFICIARY_COUNTRY") || "Lebanon",
    city: env("WU_BENEFICIARY_CITY") || "Beirut",
    phone: env("WU_BENEFICIARY_PHONE") || whishTransferPhone(),
  };
}

export function omtBeneficiary() {
  return {
    nameAr: env("OMT_BENEFICIARY_NAME_AR") || whishTransferNameAr() || "منذر أحمد حداره",
    nameEn: env("OMT_BENEFICIARY_NAME_EN") || whishTransferNameEn() || "Munzer Ahmad Haddara",
    phone: env("OMT_BENEFICIARY_PHONE") || whishTransferPhone(),
    locationHint: env("OMT_LOCATION_HINT") || "أي فرع OMT في لبنان / Any OMT branch in Lebanon",
  };
}

export function buildWhishCheckoutTransfer(
  amountUsd: number,
  opts?: { labelEn?: string; labelAr?: string },
): WhishTransferInstructions {
  return whishTransferInstructionsForAmount(amountUsd, {
    labelEn: opts?.labelEn,
    labelAr: opts?.labelAr,
    context: "subscription",
  });
}

export function buildManualTransferInstructions(
  method: PaymentMethod,
  amountUsd: number,
  opts?: { labelEn?: string; labelAr?: string },
): ManualTransferInstructions {
  const labelEn = opts?.labelEn || "subscription";
  const labelAr = opts?.labelAr || "اشتراك";
  const amountLine = `$${amountUsd} USD`;

  if (method === "whish") {
    const whish = buildWhishCheckoutTransfer(amountUsd, opts);
    return {
      method: "whish",
      titleEn: "Pay via Whish Money",
      titleAr: "الدفع عبر Whish Money",
      beneficiaryAr: whish.nameAr,
      beneficiaryEn: whish.nameEn,
      amountUsd,
      phone: whish.phone,
      linesEn: whish.linesEn,
      linesAr: whish.linesAr,
      extras: {},
    };
  }

  if (method === "western_union") {
    const wu = westernUnionBeneficiary();
    return {
      method: "western_union",
      titleEn: "Pay via Western Union",
      titleAr: "الدفع عبر Western Union",
      beneficiaryAr: wu.nameAr,
      beneficiaryEn: wu.nameEn,
      amountUsd,
      phone: wu.phone,
      extras: { country: wu.country, city: wu.city },
      linesEn: [
        `Send a Western Union money transfer for ${amountLine} (${labelEn}).`,
        `Beneficiary: ${wu.nameEn} / ${wu.nameAr}`,
        `Country: ${wu.country} · City: ${wu.city}`,
        wu.phone ? `Beneficiary phone (if asked): ${wu.phone}` : "Use beneficiary name exactly as written.",
        "Keep the MTCN receipt. After transfer, tap “I've transferred”.",
        "Activation awaits teacher confirmation of the transfer.",
      ],
      linesAr: [
        `أرسل تحويلاً عبر Western Union بقيمة ${amountLine} (${labelAr}).`,
        `المستفيد: ${wu.nameAr}`,
        `البلد: ${wu.country} · المدينة: ${wu.city}`,
        wu.phone ? `هاتف المستفيد (إن طُلب): ${wu.phone}` : "اكتب اسم المستفيد كما هو حرفياً.",
        "احتفظ برقم MTCN والإيصال. بعد التحويل اضغط «لقد حوّلت».",
        "يُفعَّل الاشتراك بعد تأكيد الأستاذ للتحويل.",
      ],
    };
  }

  const omt = omtBeneficiary();
  return {
    method: "omt",
    titleEn: "Pay via OMT",
    titleAr: "الدفع عبر OMT",
    beneficiaryAr: omt.nameAr,
    beneficiaryEn: omt.nameEn,
    amountUsd,
    phone: omt.phone,
    extras: { locationHint: omt.locationHint },
    linesEn: [
      `Transfer ${amountLine} via OMT (${labelEn}).`,
      `Beneficiary: ${omt.nameEn} / ${omt.nameAr}`,
      omt.phone ? `Beneficiary phone: ${omt.phone}` : "Ask the agent for Munzer Ahmad Haddara.",
      omt.locationHint,
      "Keep the OMT receipt / reference. After transfer, tap “I've transferred”.",
      "Your plan activates after Prof. Munzer Haddara confirms payment.",
    ],
    linesAr: [
      `حوّل ${amountLine} عبر OMT (${labelAr}).`,
      `المستفيد: ${omt.nameAr}`,
      omt.phone ? `هاتف المستفيد: ${omt.phone}` : "اطلب من الوكيل التحويل باسم منذر أحمد حداره.",
      omt.locationHint,
      "احتفظ بإيصال OMT / رقم المرجع. بعد التحويل اضغط «لقد حوّلت».",
      "يُفعَّل الاشتراك بعد تأكيد الأستاذ منذر حداره.",
    ],
  };
}

export function paymentMethodLabel(method: PaymentMethod): { en: string; ar: string } {
  if (method === "whish") return { en: "Whish Money", ar: "Whish Money" };
  if (method === "western_union") return { en: "Western Union", ar: "Western Union" };
  return { en: "OMT", ar: "OMT" };
}

/** Map manual instructions into WhishCheckout-compatible transfer shape. */
export function toCheckoutTransfer(instructions: ManualTransferInstructions): {
  phone: string;
  nameAr: string;
  nameEn: string;
  linesEn: string[];
  linesAr: string[];
} {
  return {
    phone: instructions.phone || "—",
    nameAr: instructions.beneficiaryAr,
    nameEn: instructions.beneficiaryEn,
    linesEn: instructions.linesEn,
    linesAr: instructions.linesAr,
  };
}
