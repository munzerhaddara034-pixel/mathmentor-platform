import Link from "next/link";
import { getLiveSession } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/paths";
import { LogoutButton } from "./LogoutButton";

export async function Nav() {
  const live = await getLiveSession();
  const staff = live.ok && isStaffRole(live.user.role);

  return (
    <header className="nav">
      <Link href="/" className="brand">
        <span className="mark">M</span>
        <span>
          Munzer Haddara
          <div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>
            MATH ACADEMY
          </div>
        </span>
      </Link>
      <nav className="links">
        {staff ? (
          <>
            <Link href="/studio/script">السكربت</Link>
            <Link href="/admin/video-generator">الفيديو</Link>
          </>
        ) : null}
        <Link href="/lessons/interactive">السبورة</Link>
        <Link href="/practice">الاختبارات</Link>
        {staff ? <Link href="/bank">بنك الأستاذ</Link> : null}
        <Link href="/classroom">الصف</Link>
        <Link href="/resources">المرفقات</Link>
        <Link href="/leaderboard">الصدارة</Link>
        <Link href="/redeem">تفعيل</Link>
        <Link href="/subscribe">الاشتراك</Link>
        {staff ? (
          <>
            <Link href="/dashboard">لوحة الأستاذ</Link>
            <Link href="/assistant">الموظف</Link>
            <Link href="/professor">الأستاذ</Link>
          </>
        ) : null}
        <Link href="/student">دردشة الطالب</Link>
        {live.ok ? (
          <span className="nav-user">
            {live.user.name}
            <LogoutButton />
          </span>
        ) : (
          <Link href="/login">دخول</Link>
        )}
      </nav>
    </header>
  );
}
