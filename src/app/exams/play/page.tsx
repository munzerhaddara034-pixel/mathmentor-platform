"use client";

import { QuizEngine } from "@/components/QuizEngine";
import { PremiumExamGate } from "@/components/PremiumExamGate";
import { assembleExam, type AssembledExam } from "@/lib/examCatalog";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import Link from "next/link";

function PlayInner() {
  const search = useSearchParams();
  const packId = search.get("pack") ?? "";
  const bankId = search.get("bank") ?? "";
  const mode = search.get("mode") === "free" ? "free" : "contest";
  const resolvedId = packId || (bankId ? `bank-${bankId}-${mode}` : "");
  const assembled = useMemo<AssembledExam | null>(() => (resolvedId ? assembleExam(resolvedId) : null), [resolvedId]);
  const [name, setName] = useState("طالب");

  if (!assembled) {
    return (
      <main className="shell" dir="rtl">
        <h1>النموذج غير موجود</h1>
        <p className="muted">تحقق من رابط الحزمة أو عد إلى الكتالوج.</p>
        <Link className="btn dark" href="/exams">
          بنك الامتحانات
        </Link>
      </main>
    );
  }

  const { pack, questions } = assembled;
  const timed = pack.durationMinutes > 0;

  return (
    <PremiumExamGate certificate={pack.certificate}>
    <main className="shell exam-play" dir="rtl">
      <p className="eyebrow">{pack.certificate} · {pack.styleTag}</p>
      <h1>{pack.arabicTitle}</h1>
      <p className="muted">{pack.disclaimer}</p>
      <p className="muted">
        {timed ? `${pack.durationMinutes} دقيقة` : "تدريب حر"} · {pack.totalPoints} علامة · {questions.length} سؤالاً · النجاح من{" "}
        {pack.passScore}%
      </p>
      <label>
        اسمك للصدارة
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
        <QuizEngine
          key={pack.id}
          questions={questions}
        timed={timed}
        durationMinutes={pack.durationMinutes || 15}
        passScore={pack.passScore}
        studentName={name}
        lessonId={`exam:${pack.id}`}
        parts={pack.parts}
        pack={pack}
        printHref={`/exams/print?pack=${encodeURIComponent(pack.id)}&mode=paper`}
      />
    </main>
    </PremiumExamGate>
  );
}

export default function ExamPlayPage() {
  return (
    <Suspense fallback={<main className="shell">جارٍ تجهيز الامتحان…</main>}>
      <PlayInner />
    </Suspense>
  );
}
