"use client";

import type { PaymentMethod } from "@/lib/pricing/plans";
import { paymentMethodLabel } from "@/lib/pricing/transfers";

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

/** Manual transfer instructions for Whish / Western Union / OMT. */
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
  transferredLabel = "لقد حوّلت / I've transferred",
  claimed = false,
  className = "",
}: ManualTransferCheckoutProps) {
  const labels = paymentMethodLabel(method);
  const amountEn = display || `$${amount} ${currency}`;
  const amountAr = displayAr || `$${amount} ${currency}`;
  const headingEn = title || `Pay via ${labels.en}`;
  const headingAr = titleAr || `الدفع عبر ${labels.ar}`;

  return (
    <div className={`card whish-checkout ${className}`.trim()} style={{ marginTop: 12 }}>
      <p className="eyebrow">
        {labels.en} · منذر أحمد حداره
      </p>
      <h3 style={{ marginTop: 4 }}>{headingAr}</h3>
      <p className="muted">{headingEn}</p>
      <p dir="rtl" style={{ fontSize: "1.1rem", marginTop: 8 }}>
        <strong>المبلغ: {amountAr}</strong>
      </p>
      <p>
        <strong>Amount: {amountEn}</strong>
      </p>
      <p dir="rtl">
        <strong>المستفيد:</strong> {beneficiaryAr}
        {phone ? <> — {phone}</> : null}
      </p>
      <p>
        <strong>Beneficiary:</strong> {beneficiaryEn}
        {phone ? <> — {phone}</> : null}
      </p>
      <ul className="muted" dir="rtl" style={{ paddingInlineStart: 18 }}>
        {linesAr.map((line) => (
          <li key={`ar-${line}`}>{line}</li>
        ))}
      </ul>
      <ul className="muted" style={{ paddingInlineStart: 18 }}>
        {linesEn.map((line) => (
          <li key={`en-${line}`}>{line}</li>
        ))}
      </ul>
      {claimed ? (
        <p className="success" dir="rtl">
          تم تسجيل التحويل — بانتظار تأكيد الأستاذ منذر حداره.
        </p>
      ) : null}
      {showTransferredButton && onTransferred ? (
        <button
          className="btn dark"
          type="button"
          disabled={transferredBusy || transferredDisabled || claimed}
          onClick={onTransferred}
          style={{ marginTop: 8 }}
        >
          {transferredBusy ? "…" : transferredLabel}
        </button>
      ) : null}
    </div>
  );
}
