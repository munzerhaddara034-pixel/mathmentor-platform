"use client";

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
  title = "Pay via Whish Money",
  titleAr = "الدفع عبر Whish Money",
  showTransferredButton = false,
  transferredBusy = false,
  transferredDisabled = false,
  onTransferred,
  transferredLabel = "لقد حوّلت / I've transferred",
  claimed = false,
  className = "",
}: WhishCheckoutProps) {
  const amountEn = display || `$${amount} ${currency}`;
  const amountAr = displayAr || `$${amount} ${currency}`;

  return (
    <div className={`card whish-checkout ${className}`.trim()} style={{ marginTop: 12 }}>
      <p className="eyebrow">Whish Money · منذر أحمد حداره</p>
      <h3 style={{ marginTop: 4 }}>{titleAr}</h3>
      <p className="muted">{title}</p>
      <p dir="rtl" style={{ fontSize: "1.1rem", marginTop: 8 }}>
        <strong>المبلغ: {amountAr}</strong>
      </p>
      <p>
        <strong>Amount: {amountEn}</strong>
      </p>
      <p dir="rtl">
        <strong>حوّل عبر Whish إلى:</strong> {transfer.phone} — <strong>{transfer.nameAr}</strong>
      </p>
      <p>
        <strong>Transfer via Whish to:</strong> {transfer.phone} — {transfer.nameEn}
      </p>
      <ul className="muted" dir="rtl" style={{ paddingInlineStart: 18 }}>
        {transfer.linesAr.map((line) => (
          <li key={`ar-${line}`}>{line}</li>
        ))}
      </ul>
      <ul className="muted" style={{ paddingInlineStart: 18 }}>
        {transfer.linesEn.map((line) => (
          <li key={`en-${line}`}>{line}</li>
        ))}
      </ul>
      {claimed ? (
        <p className="success" dir="rtl">
          تم تسجيل التحويل — بانتظار تأكيد الأستاذ.
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
