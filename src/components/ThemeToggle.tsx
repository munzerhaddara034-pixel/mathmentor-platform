"use client";

import { useEffect, useState } from "react";

function currentTheme() {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export function applyTheme(theme: "light" | "dark") {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("mm-theme", theme);
  } catch {
    /* ignore private mode */
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    setTheme(currentTheme());
  }, []);

  const toggle = () => {
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
      {theme === "dark" ? "فاتح" : "داكن"}
    </button>
  );
}
