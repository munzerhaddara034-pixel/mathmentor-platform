"use client";

import { canAccessExamCertificate, canAccessLesson, canAccessTrack } from "@/lib/access";
import { academyLessons } from "@/lib/academyLessons";
import { RedeemButton } from "@/components/RedeemModal";
import { useWatchAccess } from "@/components/SecurePlayerShell";
import Link from "next/link";
import type { ReactNode } from "react";

export function PremiumExamGate({
  certificate,
  track,
  lessonId,
  children,
}: {
  certificate?: string;
  track?: string;
  lessonId?: string;
  children: ReactNode;
}) {
  const { loading, user, entitlements } = useWatchAccess();
  if (loading) {
    return (
      <main className="shell" dir="rtl">
        <p className="muted">جارٍ التحقق من الاشتراك…</p>
      </main>
    );
  }
  if (user?.role === "teacher") return <>{children}</>;

  const lesson = lessonId ? academyLessons.find((item) => item.id === lessonId) : undefined;
  const lessonOk = lesson ? canAccessLesson(lesson, entitlements, user?.role) : true;
  const examOk = certificate ? canAccessExamCertificate(certificate, entitlements, user?.role) : true;
  const trackOk = track ? canAccessTrack(track, entitlements, user?.role) : true;
  const allowed = lessonOk && examOk && trackOk;

  if (allowed) return <>{children}</>;

  return (
    <main className="shell player-gate" dir="rtl">
      <p className="eyebrow">امتحان مدفوع</p>
      <h1>هذا البنك مقفل</h1>
      <p className="muted">فعّل كود الصف أو الفرع على حساب الطالب لفتح نماذج الامتحان والمسابقات.</p>
      <div className="row">
        {user?.role === "student" ? <RedeemButton /> : <Link className="btn dark" href="/login?next=/exams">تسجيل الدخول</Link>}
        <Link className="btn" href="/exams">
          الكتالوج
        </Link>
      </div>
    </main>
  );
}
