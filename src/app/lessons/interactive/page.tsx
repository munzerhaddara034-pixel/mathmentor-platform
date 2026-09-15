import { InteractiveLessonPlayer } from "@/components/studio/InteractiveLessonPlayer";
import { exponentialFunctionsLesson } from "@/lib/studio/sampleLessons";
import Link from "next/link";

export default function InteractiveLessonDemoPage() {
  return (
    <main className="shell">
      <p className="eyebrow">Classroom studio · demo</p>
      <p className="muted" dir="rtl">
        درس عيّنة للدوال الأسية متزامن مع السبورة. مولّد السكربت للمعلّم:{" "}
        <Link href="/studio/script">/studio/script</Link>
        {" · "}
        <Link href="/studio/player?lesson=complex">الأعداد المركبة</Link>
      </p>
      <InteractiveLessonPlayer timeline={exponentialFunctionsLesson} />
    </main>
  );
}
