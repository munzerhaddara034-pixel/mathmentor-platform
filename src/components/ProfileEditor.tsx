"use client";

import { useState } from "react";
import type { SessionUser } from "@/lib/auth/types";

export function ProfileEditor({ user }: { user: SessionUser }) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/me/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone }),
    });
    const payload = (await response.json()) as { error?: string };
    setBusy(false);
    setMessage(payload.error ?? "تم حفظ الاسم والرقم للعلامة المائية");
  };

  return (
    <div className="auth-form" style={{ marginTop: 16 }}>
      <label>
        الاسم الظاهر على الفيديو
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label>
        رقم الهاتف (العلامة المائية)
        <input value={phone} onChange={(event) => setPhone(event.target.value)} dir="ltr" placeholder="76532421" />
      </label>
      <button className="btn dark" type="button" disabled={busy} onClick={() => void save()}>
        حفظ
      </button>
      {message ? <p className="success">{message}</p> : null}
    </div>
  );
}
