"use client";

import type { PaymentMethod } from "@/lib/pricing/plans";
import { paymentMethodLabel } from "@/lib/pricing/transfers";
import { useI18n } from "@/components/i18n/I18nProvider";
import { fmt } from "@/lib/i18n/format";
import { billingMessages } from "@/lib/i18n/ns/billing";

export type ManualTransferCheckoutProps = {
  method: PaymentMethod;
  amount: number;
  currency?: string;
  display?: string;
  displayAr?: string;
  title?: string;
  titleAr?: string;
  beneficiaryAr: string;
  beneficiaryEn: string;
  phone?: string;
  linesEn: string[];
  linesAr: string[];
  showTransferredButton?: boolean;
  transferredBusy?: boolean;
  transferredDisabled?: boolean;
  onTransferred?: () => void;
  transferredLabel?: string;
  claimed?: boolean;
  className?: string;
};

/**
 * Manual transfer instructions for Whish / Western Union / OMT. Shows the locale's variant only:
 * ar → Arabic fields, en/fr → English fields (instruction lines are authored in ar + en).
 */
export function ManualTransferCheckout({
  method,
  amount,
  currency = "USD",
  display,
  displayAr,
  title,
  titleAr,
  beneficiaryAr,
  beneficiaryEn,
  phone,
  linesEn,
  linesAr,
  showTransferredButton = false,
  transferredBusy = false,
  transferredDisabled = false,
  onTransferred,
  transferredLabel,
  claimed = false,
  className = "",
}: ManualTransferCheckoutProps) {
  const { locale } = useI18n();
  const t = billingMessages[locale].checkout;
  const isAr = locale === "ar";
  const labels = paymentMethodLabel(method);
  const amountText = (isAr ? displayAr : display) || `$${amount} ${currency}`;
  const heading = (isAr ? titleAr : title) || fmt(t.payVia, { method: isAr ? labels.ar : labels.en });
  const lines = isAr ? linesAr : linesEn;

  return (
    <div className={`card whish-checkout ${className}`.trim()} style={{ marginTop: 12 }}>
      <p className="eyebrow">
        {labels.en} · {isAr ? beneficiaryAr : beneficiaryEn}
      </p>
      <h3 style={{ marginTop: 4 }}>{heading}</h3>
      <p style={{ fontSize: "1.1rem", marginTop: 8 }}>
        <strong>{fmt(t.amount, { amount: amountText })}</strong>
      </p>
      <p>
        <strong>{t.beneficiary}</strong> {isAr ? beneficiaryAr : beneficiaryEn}
        {phone ? (
          <>
            {" "}
            — <span dir="ltr">{phone}</span>
          </>
        ) : null}
      </p>
      <ul className="muted" style={{ paddingInlineStart: 18 }}>
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {claimed ? <p className="success">{t.claimed}</p> : null}
      {showTransferredButton && onTransferred ? (
        <button
          className="btn dark"
          type="button"
          disabled={transferredBusy || transferredDisabled || claimed}
          onClick={onTransferred}
          style={{ marginTop: 8 }}
        >
          {transferredBusy ? "…" : (transferredLabel ?? t.transferred)}
        </button>
      ) : null}
    </div>
  );
}
