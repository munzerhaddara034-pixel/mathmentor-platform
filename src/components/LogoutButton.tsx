"use client";

import { useI18n } from "@/components/i18n/I18nProvider";

export function LogoutButton() {
  const { m } = useI18n();
  return (
    <button
      className="ghost"
      type="button"
      onClick={() => {
        void fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).finally(() => {
          window.location.href = "/login";
        });
      }}
    >
      {m.common.logout}
    </button>
  );
}
