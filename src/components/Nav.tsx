"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { roleLabel, type SessionUser } from "@/lib/auth/types";
import { ThemeToggle } from "./ThemeToggle";

function linksFor(user: SessionUser | null) {
  if (!user) {
    return [
      { href: "/", label: "الرئيسية" },
      { href: "/lessons", label: "الدروس" },
      { href: "/exams", label: "الامتحانات" },
      { href: "/classroom", label: "الصف" },
      { href: "/subscribe", label: "الاشتراك" },
      { href: "/redeem", label: "تفعيل كود" },
    ];
  }
  if (user.role === "teacher") {
    return [
      { href: "/dashboard", label: "لوحة التحكم" },
      { href: "/admin", label: "الإدارة" },
      { href: "/professor", label: "الأستاذ" },
      { href: "/assistant", label: "الموظف" },
      { href: "/bank", label: "بنك الأستاذ" },
      { href: "/lessons", label: "الدروس" },
      { href: "/exams", label: "الامتحانات" },
    ];
  }
  if (user.role === "parent") {
    return [
      { href: "/dashboard", label: "لوحة ولي الأمر" },
      { href: "/lessons", label: "الدروس" },
      { href: "/exams", label: "الامتحانات" },
      { href: "/profile", label: "ملفي" },
    ];
  }
  return [
    { href: "/dashboard", label: "لوحة الطالب" },
    { href: "/lessons", label: "الدروس" },
    { href: "/exams", label: "الامتحانات" },
    { href: "/classroom", label: "الصف" },
    { href: "/redeem", label: "تفعيل كود" },
    { href: "/student", label: "دردشة" },
    { href: "/profile", label: "ملفي" },
  ];
}

export function Nav({ initialUser }: { initialUser: SessionUser | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(initialUser);
  const links = linksFor(user);

  useEffect(() => {
    setUser(initialUser);
  }, [initialUser]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/me", { credentials: "include" })
      .then((response) => response.json())
      .then((payload: { user?: SessionUser | null }) => {
        if (!cancelled) setUser(payload.user ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setOpen(false);
    window.location.assign("/");
  };

  return (
    <header className="nav">
      <Link href="/" className="brand">
        <span className="mark">∑</span>
        <span>
          Math Mentor
          <div className="muted brand-sub">الأستاذ منذر حدارة</div>
        </span>
      </Link>
      <button type="button" className="nav-burger" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        القائمة
      </button>
      <nav className={`links ${open ? "open" : ""}`}>
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href)) ? "active" : undefined}
            onClick={() => setOpen(false)}
          >
            {link.label}
          </Link>
        ))}
        <ThemeToggle />
        {user ? (
          <>
            <Link href="/profile" className="nav-user" onClick={() => setOpen(false)}>
              <span className="role-badge">{roleLabel(user.role)}</span>
              <span>{user.name}</span>
            </Link>
            <button type="button" className="ghost-link" onClick={() => void logout()}>
              خروج
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="ghost-link" onClick={() => setOpen(false)}>
              دخول
            </Link>
            <Link href="/signup" className="btn nav-cta" onClick={() => setOpen(false)}>
              حساب جديد
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
