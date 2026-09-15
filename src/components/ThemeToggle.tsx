"use client";

import { useEffect, useState, type MouseEvent } from "react";

function readStoredTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  try {
    const stored = localStorage.getItem("mm-theme");
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    /* ignore */
  }
  const match = document.cookie.match(/(?:^|; )mm-theme=(dark|light)/);
  if (match?.[1] === "dark" || match?.[1] === "light") return match[1];
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
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
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const current = readStoredTheme();
    applyTheme(current);
    setTheme(current);
  }, []);

  const toggle = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const next = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  };

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={theme === "dark" ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن"}
      title={theme === "dark" ? "وضع فاتح" : "وضع داكن"}
    >
      {theme === "dark" ? "☀ فاتح" : "☾ داكن"}
    </button>
  );
}
