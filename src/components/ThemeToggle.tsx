"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/components/i18n/I18nProvider";

/** redesign-v2 A is dark-first: dark unless the visitor picked light. */
function readStoredTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "dark";
  try {
    const stored = localStorage.getItem("mm-theme");
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    /* ignore */
  }
  const match = document.cookie.match(/(?:^|; )mm-theme=(dark|light)/);
  if (match?.[1] === "dark" || match?.[1] === "light") return match[1];
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

export function applyTheme(theme: "light" | "dark") {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.classList.toggle("theme-dark", theme === "dark");
  root.classList.toggle("theme-light", theme === "light");
  try {
    localStorage.setItem("mm-theme", theme);
  } catch {
    /* ignore private mode */
  }
  document.cookie = `mm-theme=${theme}; path=/; max-age=31536000; samesite=lax`;
  window.dispatchEvent(new CustomEvent<ThemeName>(THEME_EVENT, { detail: theme }));
}

type ThemeName = "light" | "dark";
const THEME_EVENT = "mm-theme-change";

/** `compact`: 44px icon button for the top bar; default: labelled pill inside menus. */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { m } = useI18n();
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    setTheme(readStoredTheme());
    // Several toggles can be mounted (top bar + menu); keep their icons in sync.
    const onChange = (event: Event) => {
      const next = (event as CustomEvent<ThemeName>).detail;
      if (next === "light" || next === "dark") setTheme(next);
    };
    window.addEventListener(THEME_EVENT, onChange);
    return () => window.removeEventListener(THEME_EVENT, onChange);
  }, []);

  const toggle = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const next = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  };

  const label = theme === "dark" ? m.theme.toLight : m.theme.toDark;
  if (compact) {
    return (
      <button type="button" className="mm-icon-btn mm-theme-icon" onClick={toggle} aria-label={label} title={label}>
        <Icon name={theme === "dark" ? "sun" : "moon"} size={20} />
      </button>
    );
  }
  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label={label} title={label}>
      <Icon name={theme === "dark" ? "sun" : "moon"} size={18} /> {theme === "dark" ? m.theme.light : m.theme.dark}
    </button>
  );
}
