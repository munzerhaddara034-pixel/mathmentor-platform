import Link from "next/link";
import { getSession } from "@/lib/auth/server";

export default async function HomePage() {
  const user = await getSession();
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Math Mentor</p>
        <h1>
          ثقة في الرياضيات
          <br />
          <span className="accent">تُبنى درساً بعد درس.</span>
        </h1>
        <p>
          منصة الأستاذ منذر حدارة لطلاب الثانوية والشهادة المتوسطة في لبنان: صف يكتب على اللوح، بنوك بمستوى الامتحان،
          ومساعد ذكي يراجع الأستاذ قبل أي رسالة تخرج.
        </p>
        <div className="row">
          {user ? (
            <Link href="/dashboard" className="btn">
              لوحة التحكم
            </Link>
          ) : (
            <>
              <Link href="/signup" className="btn">
                ابدأ كطالب
              </Link>
              <Link href="/login" className="ghost-btn">
                تسجيل الدخول
              </Link>
            </>
          )}
          <Link href="/lessons" className="ghost-btn">
            شاهد الدروس
          </Link>
          <Link href="/exams" className="ghost-btn">
            بنك الامتحانات
          </Link>
        </div>
      </section>
      <section className="grid three">
        <article className="card">
          <p className="eyebrow">1</p>
          <h3>صفوف كل المستويات</h3>
          <p className="muted">فيديوهات الصف 7 و8 و9 و11 و12 وSAT: الأستاذ يكتب، والتلاميذ ينظرون إلى اللوح.</p>
        </article>
        <article className="card">
          <p className="eyebrow">2</p>
          <h3>مسارات الشهادة</h3>
          <p className="muted">علوم الحياة، اجتماع واقتصاد، علوم عامة، والشهادة المتوسطة — تدريب بأسلوب النماذج اللبنانية.</p>
        </article>
        <article className="card">
          <p className="eyebrow">3</p>
          <h3>مساعد الأستاذ منذر</h3>
          <p className="muted">دردشة عائمة في كل صفحة للشرح والاشتراك والدعم، بالعربية أولاً.</p>
        </article>
      </section>
    </main>
  );
}
