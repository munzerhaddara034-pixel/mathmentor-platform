import Link from "next/link";
import { getLiveSession } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/paths";
import { LogoutButton } from "./LogoutButton";
import { NotificationBell } from "./NotificationBell";

export async function Nav() {
  const live = await getLiveSession();
  const staff = live.ok && isStaffRole(live.user.role);

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
      <nav className="links">
        {staff ? (
          <>
            <Link href="/studio/script">السكربت</Link>
            <Link href="/studio/voice-solver">الصوت</Link>
            <Link href="/admin/video-generator">الفيديو</Link>
          </>
        ) : null}
        <Link href="/lessons/interactive">السبورة</Link>
        <Link href="/math-solver">الحلّال</Link>
        <Link href="/live">مباشر</Link>
        <Link href="/exams">المحاكاة</Link>
        <Link href="/practice">الاختبارات</Link>
        {staff ? <Link href="/bank">بنك الأستاذ</Link> : null}
        <Link href="/classroom">الصف</Link>
        <Link href="/resources">المرفقات</Link>
        <Link href="/leaderboard">الصدارة</Link>
        <Link href="/wallet">المحفظة</Link>
        <Link href="/profile">الملف</Link>
        <Link href="/redeem">تفعيل</Link>
        <Link href="/subscribe">الاشتراك</Link>
        {staff ? (
          <>
            <Link href="/admin">الإدارة</Link>
            <Link href="/admin/exams">تصحيح</Link>
            <Link href="/dashboard">لوحة الأستاذ</Link>
            <Link href="/assistant">الموظف</Link>
            <Link href="/professor">الأستاذ</Link>
          </>
        ) : null}
        <Link href="/student">دردشة الطالب</Link>
        {live.ok ? (
          <span className="nav-user">
            <NotificationBell />
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
