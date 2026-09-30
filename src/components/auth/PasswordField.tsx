"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";

type Props = {
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  minLength?: number;
};

/**
 * Password input with an «إظهار / إخفاء» toggle.
 *
 * Layout: the input is always LTR (passwords are Latin), so its text and caret start at the
 * physical LEFT edge. The toggle is pinned to the physical left too (the RTL page's inline end),
 * and the input is padded on that same physical side (see `.mm-password` in auth.css). Physical
 * properties are used on purpose: logical ones resolve differently for the RTL wrapper and the
 * LTR input, which previously put the button on the left and the padding on the right, so the
 * button covered the start of the text and swallowed taps meant for the input.
 *
 * The toggle is outside the <label> (a label must only contain its own control) and does not steal
 * focus from the input, so the caret and the mobile keyboard stay put when it is pressed.
 */
export function PasswordField({ value, onChange, autoComplete, minLength }: Props) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);
  const [visible, setVisible] = useState(false);

  // Switching `type` can reset the caret in some browsers; restore it after the re-render.
  useEffect(() => {
    const input = inputRef.current;
    const selection = selectionRef.current;
    selectionRef.current = null;
    if (!input || !selection || document.activeElement !== input) return;
    input.setSelectionRange(selection.start, selection.end);
  }, [visible]);

  const { m } = useI18n();
  const a = m.auth;
  const toggle = () => {
    const input = inputRef.current;
    if (input && document.activeElement === input) {
      selectionRef.current = { start: input.selectionStart ?? value.length, end: input.selectionEnd ?? value.length };
    }
    setVisible((v) => !v);
  };

  return (
    <div className="mm-field mm-password-field">
      <label htmlFor={id}>{a.password}</label>
      <div className="mm-password">
        <input
          ref={inputRef}
          id={id}
          type={visible ? "text" : "password"}
          dir="ltr"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <button
          type="button"
          onMouseDown={(event) => {
            // Keep focus (and the on-screen keyboard) in the input when the toggle is pressed.
            if (document.activeElement === inputRef.current) event.preventDefault();
          }}
          onClick={toggle}
          aria-controls={id}
          aria-pressed={visible}
          aria-label={visible ? a.hidePassword : a.showPassword}
        >
          {visible ? a.hide : a.show}
        </button>
      </div>
    </div>
  );
}
