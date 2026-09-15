import { academyLessons } from "@/lib/academyLessons";
import { ProtectedDocument } from "@/components/ProtectedDocument";
import { watermarkText } from "@/lib/videoSecurity";
import { notFound } from "next/navigation";

export default async function PrintResourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lesson = academyLessons.find((item) => item.id === id);
  if (!lesson) notFound();
  return (
    <ProtectedDocument watermark={watermarkText("عرض للطالب")}>
      <main className="shell print-sheet" dir="rtl">
        <p className="eyebrow">عرض محمي · ليست نسخة كتاب أهلية</p>
        <h1>
          {lesson.gradeLabel} · {lesson.title}
        </h1>
        <p className="muted">للعرض على المنصة. الطباعة تحمل العلامة المائية. التحميل المباشر للملف غير متاح.</p>
        <section className="paper">
          <h2>الفكرة</h2>
          <p>{lesson.idea}</p>
          <h2>القاعدة</h2>
          <pre>{lesson.board}</pre>
          <h2>مثال محلول خطوة بخطوة</h2>
          <ol>
            <li>المعطى: {lesson.example}</li>
            <li>تطبيق القاعدة أعلاه.</li>
            <li>النتيجة: {lesson.exampleBoard}</li>
            <li>تحقق بالتعويض إن أمكن.</li>
          </ol>
        </section>
      </main>
    </ProtectedDocument>
  );
}
