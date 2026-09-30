"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import { fmt } from "@/lib/i18n/format";
import { billingMessages } from "@/lib/i18n/ns/billing";

export type WhishCheckoutTransfer = {
  phone: string;
  nameAr: string;
  nameEn: string;
  linesEn: string[];
  linesAr: string[];
};

export type WhishCheckoutProps = {
  amount: number;
  currency?: string;
  display?: string;
  displayAr?: string;
  transfer: WhishCheckoutTransfer;
  /** Optional title override */
  title?: string;
  titleAr?: string;
  /** Show “I've transferred” */
  showTransferredButton?: boolean;
  transferredBusy?: boolean;
  transferredDisabled?: boolean;
  onTransferred?: () => void;
  transferredLabel?: string;
  claimed?: boolean;
  className?: string;
};

/** Shared Whish Money manual-transfer instructions + I've transferred CTA. */
export function WhishCheckout({
  amount,
  currency = "USD",
  display,
  displayAr,
  transfer,
  title,
  titleAr,
  showTransferredButton = false,
  transferredBusy = false,
  transferredDisabled = false,
  onTransferred,
  transferredLabel,
  claimed = false,
  className = "",
}: WhishCheckoutProps) {
  const { locale } = useI18n();
  const t = billingMessages[locale].checkout;
  const isAr = locale === "ar";
  const amountText = (isAr ? displayAr : display) || `$${amount} ${currency}`;
  const heading = (isAr ? titleAr : title) || fmt(t.payVia, { method: "Whish Money" });
  const name = isAr ? transfer.nameAr : transfer.nameEn;

  return (
    <div className={`card whish-checkout ${className}`.trim()} style={{ marginTop: 12 }}>
      <p className="eyebrow">Whish Money · {name}</p>
      <h3 style={{ marginTop: 4 }}>{heading}</h3>
      <p style={{ fontSize: "1.1rem", marginTop: 8 }}>
        <strong>{fmt(t.amount, { amount: amountText })}</strong>
      </p>
      <p>
        <strong>{t.transferTo}</strong> <span dir="ltr">{transfer.phone}</span> — <strong>{name}</strong>
      </p>
      <ul className="muted" style={{ paddingInlineStart: 18 }}>
        {(isAr ? transfer.linesAr : transfer.linesEn).map((line) => (
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
