"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { roleLabel, type SessionUser } from "@/lib/auth/types";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";
import { CurriculumSwitcher } from "./curriculum/CurriculumSwitcher";

type NavLink = { href: string; label: string };

/** Links shared by every signed-in or guest visitor (AI board, solver, live, exam simulator). */
const LEARNING_LINKS: NavLink[] = [
  { href: "/lessons", label: "الدروس" },
  { href: "/lessons/interactive", label: "السبورة" },
  { href: "/math-solver", label: "الحلّال" },
  { href: "/live", label: "مباشر" },
  { href: "/exams", label: "المحاكاة" },
  { href: "/practice", label: "الاختبارات" },
];

function linksFor(user: SessionUser | null): NavLink[] {
  if (!user) {
    return [
      { href: "/", label: "الرئيسية" },
      ...LEARNING_LINKS,
      { href: "/classroom", label: "الصف" },
      { href: "/subscribe", label: "الاشتراك" },
    ];
  }
  if (user.role === "teacher") {
    return [
      { href: "/dashboard", label: "لوحة التحكم" },
      { href: "/professor", label: "الأستاذ" },
      { href: "/assistant", label: "الموظف" },
      { href: "/bank", label: "بنك الأستاذ" },
      { href: "/admin", label: "الإدارة" },
      { href: "/admin/agent-hub", label: "الوكيل" },
      { href: "/admin/team", label: "الفريق" },
      { href: "/admin/b2b-manager", label: "الشراكات" },
      { href: "/admin/exams", label: "تصحيح" },
      { href: "/studio/script", label: "السكربت" },
      { href: "/studio/voice-solver", label: "الصوت" },
      { href: "/admin/video-generator", label: "الفيديو" },
      ...LEARNING_LINKS,
    ];
  }
  if (user.role === "parent") {
    return [
      { href: "/dashboard", label: "لوحة ولي الأمر" },
      ...LEARNING_LINKS,
      { href: "/wallet", label: "المحفظة" },
      { href: "/profile", label: "ملفي" },
    ];
  }
  return [
    { href: "/dashboard", label: "لوحة الطالب" },
    ...LEARNING_LINKS,
    { href: "/classroom", label: "الصف" },
    { href: "/resources", label: "المرفقات" },
    { href: "/leaderboard", label: "الصدارة" },
    { href: "/student", label: "دردشة" },
    { href: "/wallet", label: "المحفظة" },
    { href: "/redeem", label: "تفعيل" },
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
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    setUser(null);
    setOpen(false);
    window.location.assign("/login");
  };

  return (
    <header className="nav">
      <Link href="/" className="brand" dir="ltr">
        <img className="brand-logo" src="/brand/mathmentor-logo.svg" alt="" width={40} height={40} />
        <span className="brand-text">
          MathMentor
          <span className="brand-kicker" lang="ar" dir="rtl">
            أكاديمية منذر حداره
          </span>
        </span>
      </Link>
      <button type="button" className="nav-burger" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        القائمة
      </button>
      <nav className={`links ${open ? "open" : ""}`}>
        <CurriculumSwitcher />
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={pathname === link.href ? "active" : undefined}
            onClick={() => setOpen(false)}
          >
            {link.label}
          </Link>
        ))}
        <ThemeToggle />
        {user ? (
          <>
            <NotificationBell />
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
