import Link from "next/link";
import { LessonCard } from "@/components/lessons/LessonCard";
import { Icon } from "@/components/ui/Icon";
import { featuredWatchCards } from "@/lib/videoLessons";
import "@/styles/lessons.css";

export const metadata = { title: "الدروس · منذر حداره · MathMentor" };

export default function LessonsIndexPage() {
  const cards = featuredWatchCards();
  return (
    <main className="shell mm-lessons">
      <header className="mm-lessons-head">
        <p className="eyebrow">مكتبة الدروس</p>
        <h1>الدروس المصوّرة</h1>
        <p className="muted">
          الأستاذ منذر حداره يشرح أمامك على اللوح. الواجهة بالعربية، والشرح المصوّر بالإنكليزية أو الفرنسية حسب لغة
          صفّك، وتنتقل بين اللغتين بنقرة واحدة.
        </p>
      </header>

      <Link href="/lessons/interactive" className="mm-card mm-lessons-feature">
        <span className="mm-tile-icon tone-gold" aria-hidden="true">
          <Icon name="spark" size={24} />
        </span>
        <span>
          <strong>السبورة الذكية التفاعلية</strong>
          <span>درس تفاعلي: شرح صوتي، رسوم بيانية، وأسئلة سريعة أثناء المشاهدة.</span>
        </span>
        <Icon name="arrow" size={20} />
      </Link>

      <section aria-labelledby="mm-lessons-list">
        <h2 id="mm-lessons-list" className="mm-dash-h2">
          دروس مختارة
        </h2>
        {cards.length ? (
          <div className="mm-lessons-grid">
            {cards.map((card) => (
              <LessonCard key={card.href} card={card} />
            ))}
          </div>
        ) : (
          <p className="muted">لا دروس منشورة حالياً. عُد قريباً.</p>
        )}
      </section>
    </main>
  );
}
