"use client";

import Link from "next/link";
import { useEffect } from "react";
import type { SessionUser } from "@/lib/auth/types";
import { OPEN_ASSISTANT_EVENT } from "@/components/ChatWidget";
import { Icon } from "@/components/ui/Icon";
import { MenuLinks } from "./MenuLinks";
import { MenuSettings } from "./MenuSettings";
import type { NavModel } from "./navConfig";

/** Full-height mobile menu (grouped), opened from the header menu button. */
export function MobileSheet({
  open,
  model,
  user,
  pathname,
  onClose,
  onLogout,
}: {
  open: boolean;
  model: NavModel;
  user: SessionUser | null;
  pathname: string;
  onClose: () => void;
  onLogout: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("mm-sheet-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("mm-sheet-open");
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="mm-sheet" role="dialog" aria-modal="true" aria-label="القائمة">
      <button type="button" className="mm-sheet-scrim" aria-label="إغلاق القائمة" onClick={onClose} />
      <div className="mm-sheet-panel">
        <div className="mm-sheet-head">
          <strong>القائمة</strong>
          <button type="button" className="mm-icon-btn" onClick={onClose} aria-label="إغلاق">
            <Icon name="close" />
          </button>
        </div>
        <button
          type="button"
          className="btn dark mm-sheet-assistant"
          onClick={() => {
            onClose();
            window.dispatchEvent(new Event(OPEN_ASSISTANT_EVENT));
          }}
        >
          <Icon name="chat" size={20} /> اسأل مساعد الأستاذ منذر
        </button>
        <p className="mm-sheet-group">التعلّم</p>
        <MenuLinks items={model.primary} pathname={pathname} onNavigate={onClose} />
        {model.more.length ? (
          <>
            <p className="mm-sheet-group">المزيد</p>
            <MenuLinks items={model.more} pathname={pathname} onNavigate={onClose} />
          </>
        ) : null}
        {user && model.account.length ? (
          <>
            <p className="mm-sheet-group">حسابي</p>
            <MenuLinks items={model.account} pathname={pathname} onNavigate={onClose} />
          </>
        ) : null}
        <p className="mm-sheet-group">الإعدادات</p>
        <MenuSettings />
        <div className="mm-sheet-foot">
          {user ? (
            <button type="button" className="ghost-btn ink" onClick={onLogout}>
              تسجيل الخروج
            </button>
          ) : (
            <>
              <Link href="/signup" className="btn dark" onClick={onClose}>
                حساب جديد
              </Link>
              <Link href="/login" className="ghost-btn ink" onClick={onClose}>
                تسجيل الدخول
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
