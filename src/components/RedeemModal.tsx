"use client";

import { DEMO_PROMO_CODES, PROMO_CODE_LENGTH, isValidPromoCode, normalizePromoCode, scopeLabel } from "@/lib/access";
import { useState } from "react";

export function RedeemModal({
  open,
  onClose,
  onRedeemed,
}: {
  open: boolean;
  onClose: () => void;
  onRedeemed?: (planName: string) => void;
}) {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const normalized = normalizePromoCode(code);
  const valid = isValidPromoCode(normalized);

  if (!open) return null;

  const submit = async () => {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ code: normalized }),
    });
    const data = (await response.json()) as { ok?: boolean; error?: string; planName?: string; message?: string };
    setBusy(false);
    setOk(Boolean(data.ok));
    setMessage(data.message ?? data.error ?? "فشل التفعيل");
    if (data.ok && data.planName) onRedeemed?.(data.planName);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="redeem-title">
      <div className="card modal-card activate-card" dir="rtl">
        <div className="modal-head">
          <div>
            <p className="eyebrow">تفعيل الاشتراك</p>
            <h2 id="redeem-title">أدخل كود البطاقة</h2>
          </div>
          <button type="button" className="ghost-link" onClick={onClose}>
            إغلاق
          </button>
        </div>
        <p className="muted">كود من {PROMO_CODE_LENGTH} حرفاً أو رقماً. يُفك على حسابك فقط وليس مخزناً مشتركاً.</p>
        <label>
          رمز البطاقة / البرومو
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            maxLength={16}
            placeholder="MMUNLOCKALL1"
            autoComplete="off"
            dir="ltr"
          />
        </label>
        <p className={`code-meter ${valid ? "ok" : ""}`}>
          {normalized.length}/{PROMO_CODE_LENGTH}
          {normalized && !valid ? " — يجب أن يكون 12 حرفاً أو رقماً" : ""}
        </p>
        <button className="btn dark" type="button" disabled={busy || !valid} onClick={() => void submit()}>
          تفعيل على حسابي
        </button>
        {message ? <p className={ok ? "success" : "error"}>{message}</p> : null}
        {ok ? (
          <p className="welcome-banner">يمكنك الآن فتح الدروس والامتحانات المضمنة في هذه البطاقة.</p>
        ) : (
          <p className="muted" style={{ marginTop: 12 }}>
            أكواد التجربة: {DEMO_PROMO_CODES.map((item) => `${item.code} (${scopeLabel(item.scopeKind, item.scopeId)})`).join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}

export function RedeemButton({ label = "تفعيل كود" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn dark" type="button" onClick={() => setOpen(true)}>
        {label}
      </button>
      <RedeemModal
        open={open}
        onClose={() => setOpen(false)}
        onRedeemed={() => {
          window.setTimeout(() => window.location.reload(), 700);
        }}
      />
    </>
  );
}
