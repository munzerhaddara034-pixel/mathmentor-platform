"use client";

import { useState } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  minLength?: number;
};

export function PasswordField({ value, onChange, autoComplete, minLength }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="mm-field">
      <span>كلمة المرور</span>
      <span className="mm-password">
        <input
          type={visible ? "text" : "password"}
          dir="ltr"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          minLength={minLength}
          autoComplete={autoComplete}
        />
        <button type="button" onClick={() => setVisible((v) => !v)} aria-pressed={visible}>
          {visible ? "إخفاء" : "إظهار"}
        </button>
      </span>
    </label>
  );
}
