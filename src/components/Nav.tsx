import Link from "next/link";

export function Nav() {
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
        <Link href="/practice">الاختبارات</Link>
        <Link href="/bank">بنك الأستاذ</Link>
        <Link href="/classroom">الصف</Link>
        <Link href="/resources">المرفقات</Link>
        <Link href="/leaderboard">الصدارة</Link>
        <Link href="/redeem">تفعيل</Link>
        <Link href="/subscribe">الاشتراك</Link>
        <Link href="/dashboard">لوحة الأستاذ</Link>
        <Link href="/student">دردشة الطالب</Link>
        <Link href="/assistant">الموظف</Link>
        <Link href="/professor">الأستاذ</Link>
      </nav>
    </header>
  );
}
