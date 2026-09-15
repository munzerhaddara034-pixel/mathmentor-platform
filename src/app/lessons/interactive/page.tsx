import { InteractiveLessonPlayer } from "@/components/studio/InteractiveLessonPlayer";
import { officialExamFourPhaseLesson } from "@/lib/studio/seedLesson";
import Link from "next/link";

export default function InteractiveLessonDemoPage() {
  return (
    <main className="shell">
      <p className="eyebrow">Classroom studio · demo</p>
      <p className="muted">
        Official exam pattern: <code>f(x)=(x-1)e^x</code>. English default, live French toggle. Editor:{" "}
        <Link href="/studio/script">/studio/script</Link>
        {" · "}
        <Link href="/studio/player?lesson=leb-term-func-01">3-scene seed</Link>
        {" · "}
        <Link href="/studio/player?lesson=complex">Complex numbers</Link>
      </p>
      <InteractiveLessonPlayer timeline={officialExamFourPhaseLesson} initialLanguage="en" />
    </main>
  );
}
