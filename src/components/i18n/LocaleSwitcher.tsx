"use client";

import { useCallback, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { LOCALE_COOKIE, LOCALE_LABEL, LOCALE_SHORT, LOCALES, dirFor, type Locale } from "@/lib/i18n/config";
import { useDismiss } from "@/components/nav/useDismiss";
import { useI18n } from "./I18nProvider";

export type SaveLocaleResult = { ok: true; savedToProfile: boolean } | { ok: false };

/** Cookie (server-readable) + localStorage mirror, applied immediately to <html lang dir>. */
export function writeLocaleCookie(next: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  try {
    localStorage.setItem(LOCALE_COOKIE, next);
  } catch {
    /* private mode */
  }
  document.documentElement.lang = next;
  document.documentElement.dir = dirFor(next);
}

/** Persists server-side too (cookie + the signed-in account's profile when it has one). */
export async function saveLocale(next: Locale): Promise<SaveLocaleResult> {
  writeLocaleCookie(next);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch("/api/me/locale", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ locale: next }),
      signal: controller.signal,
    });
    const payload = (await response.json()) as { ok?: boolean; savedToProfile?: boolean };
    return response.ok && payload.ok ? { ok: true, savedToProfile: Boolean(payload.savedToProfile) } : { ok: false };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

/** Switch now: save (best effort — the cookie is already written), then reload so SSR renders the new language. */
export async function setLocale(next: Locale) {
  await saveLocale(next);
  window.location.reload();
}

/**
 * `menu`: globe button showing the current language + popover (top bar, visible before and after login).
 * `inline`: three segmented buttons (mobile menu / settings).
 */
export function LocaleSwitcher({ variant = "menu" }: { variant?: "menu" | "inline" }) {
  const { locale, m } = useI18n();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Locale | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(box, open, close);

  const choose = (next: Locale) => {
    setOpen(false);
    if (next === locale || pending) return;
    setPending(next);
    void setLocale(next);
  };

  if (variant === "inline") {
    return (
      <div className="mm-locale-inline" role="group" aria-label={m.locale.label} aria-busy={pending ? true : undefined}>
        {LOCALES.map((code) => (
          <button key={code} type="button" lang={code} aria-pressed={code === (pending ?? locale)} disabled={Boolean(pending)} onClick={() => choose(code)}>
            {LOCALE_LABEL[code]}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="mm-dropdown mm-locale" ref={box}>
      <button
        type="button"
        className="mm-icon-btn mm-locale-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${m.locale.change} (${LOCALE_LABEL[locale]})`}
        title={m.locale.change}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="globe" size={18} />
        <span className="mm-locale-full" lang={locale}>
          {LOCALE_LABEL[locale]}
        </span>
        <span className="mm-locale-short" lang={locale}>
          {LOCALE_SHORT[locale]}
        </span>
      </button>
      {open ? (
        <div className="mm-dropdown-panel mm-align-end mm-locale-panel" role="menu">
          {LOCALES.map((code) => (
            <button
              key={code}
              type="button"
              role="menuitemradio"
              aria-checked={code === locale}
              className={code === locale ? "active" : undefined}
              onClick={() => choose(code)}
            >
              <bdi lang={code}>{LOCALE_LABEL[code]}</bdi>
              {code === locale ? <Icon name="check" size={16} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
