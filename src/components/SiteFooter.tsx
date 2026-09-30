import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>
        <strong>منذر حداره</strong> · <bdi dir="ltr">MathMentor</bdi> · رياضيات الشهادة المتوسطة والثانوية العامة في لبنان
      </span>
      <nav aria-label="روابط التذييل">
        <Link href="/subscribe">الاشتراك</Link>
        <Link href="/live">الحصص المباشرة</Link>
        <Link href="/lessons">الدروس</Link>
      </nav>
    </footer>
  );
}
