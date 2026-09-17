import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">A clearer way to master mathematics</p>
        <h1>
          Confidence is built
          <br />
          <span className="accent">one proof at a time.</span>
        </h1>
        <p>
          صف كامل: الأستاذ منذر يكتب على اللوح والتلاميذ يتابعون. مساعد الذكاء الاصطناعي يعد رسائل المدارس والاشتراك،
          ولا يرسل شيئاً قبل موافقة الأستاذ.
        </p>
        <div className="row">
          <Link href="/classroom" className="btn">
            Classroom studio
          </Link>
          <Link href="/math-solver" className="ghost-btn">
            حلّال الرياضيات
          </Link>
          <Link href="/lessons/interactive" className="ghost-btn">
            السبورة الذكية
          </Link>
          <Link href="/live" className="ghost-btn">
            حصة مباشرة
          </Link>
          <Link href="/studio/script" className="ghost-btn">
            مولّد السكربت
          </Link>
          <Link href="/admin/video-generator" className="ghost-btn">
            مولّد الفيديو
          </Link>
          <Link href="/practice" className="ghost-btn">
            بنك الأسئلة
          </Link>
          <Link href="/exams" className="ghost-btn">
            محاكاة رسمية
          </Link>
          <Link href="/wallet" className="ghost-btn">
            المحفظة
          </Link>
          <Link href="/subscribe" className="ghost-btn">
            Subscription
          </Link>
          <Link href="/assistant" className="ghost-btn">
            AI employee
          </Link>
        </div>
      </section>
      <section className="grid three">
        <article className="card">
          <p className="eyebrow">1</p>
          <h3>صفوف كل المستويات</h3>
          <p className="muted">فيديوهات صف 7 و8 و9 و11 و12 وSAT: الأستاذ يكتب، والتلاميذ ينظرون إلى اللوح.</p>
        </article>
        <article className="card">
          <p className="eyebrow">2</p>
          <h3>مساعد يدير المنصة</h3>
          <p className="muted">يعد رسائل المدارس والطلاب وطريقة الاشتراك، ثم ينتظر موافقة الأستاذ منذر.</p>
        </article>
        <article className="card">
          <p className="eyebrow">3</p>
          <h3>لا إرسال بلا اعتماد</h3>
          <p className="muted">لا درس جديد ولا رسالة لولي أمر أو مدرسة تخرج قبل قرار الأستاذ.</p>
        </article>
      </section>
    </main>
  );
}
