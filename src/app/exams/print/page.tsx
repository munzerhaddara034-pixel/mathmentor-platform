"use client";

import { ExamPaperSheet } from "@/components/ExamPaperSheet";
import { assembleExam } from "@/lib/examCatalog";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo } from "react";
import Link from "next/link";

function PrintInner() {
  const search = useSearchParams();
  const packId = search.get("pack") ?? "";
  const mode = search.get("mode") === "solutions" ? "solutions" : "paper";
  const autoprint = search.get("print") === "1";
  const assembled = useMemo(() => (packId ? assembleExam(packId) : null), [packId]);

  useEffect(() => {
    if (!assembled) return;
    let cancelled = false;
    const run = async () => {
      try {
        await window.MathJax?.typesetPromise?.();
      } catch {
        /* MathJax optional */
      }
      if (!cancelled && autoprint) window.print();
    };
    const timer = window.setTimeout(() => void run(), 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [assembled, autoprint, mode]);

  if (!assembled) {
    return (
      <main className="shell" dir="rtl">
        <h1>لا ورقة للطباعة</h1>
        <Link className="btn" href="/exams">
          العودة
        </Link>
      </main>
    );
  }

  const downloadPdf = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("print", "1");
    window.history.replaceState({}, "", url);
    void window.MathJax?.typesetPromise?.().finally(() => window.print());
  };

  return (
    <main className="shell exam-print-page" dir="rtl">
      <div className="exam-print-actions">
        <p className="muted">اختر «حفظ كملف PDF» في نافذة الطباعة لتحميل ورقة نظيفة.</p>
        <div className="row">
          <button className="btn dark" type="button" onClick={downloadPdf}>
            تحميل / طباعة PDF
          </button>
          <Link className="btn" href={`/exams/play?pack=${encodeURIComponent(packId)}`}>
            فتح المشغّل
          </Link>
          <Link className="btn" href="/exams">
            الكتالوج
          </Link>
        </div>
      </div>
      <ExamPaperSheet pack={assembled.pack} questions={assembled.questions} mode={mode} />
    </main>
  );
}

export default function ExamPrintPage() {
  return (
    <Suspense fallback={<main className="shell">جارٍ تجهيز الورقة…</main>}>
      <PrintInner />
    </Suspense>
  );
}
