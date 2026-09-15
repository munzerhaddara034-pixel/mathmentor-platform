"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { SessionUser } from "@/lib/auth/types";
import type { EntitlementRecord } from "@/lib/access";
import type { ProgressEntry } from "@/lib/types";
import { canAccessLesson } from "@/lib/access";
import { RedeemModal } from "@/components/RedeemModal";
import { academyLessons } from "@/lib/academyLessons";
import { watermarkText } from "@/lib/videoSecurity";

type AccessResponse = {
  user?: SessionUser;
  entitlements?: EntitlementRecord[];
  lessons?: { id: string; unlocked: boolean; enabled: boolean; arabicTitle: string; title: string }[];
  progress?: ProgressEntry[];
  error?: string;
};

export function useWatchAccess() {
  const pathname = usePathname();
  const [data, setData] = useState<AccessResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetch("/api/me/entitlements", { credentials: "include" })
      .then(async (response) => {
        if (response.status === 401) return { user: undefined };
        return (await response.json()) as AccessResponse;
      })
      .then((payload) => {
        if (!cancelled) {
          setData(payload);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData({});
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return { loading, data, user: data?.user ?? null, entitlements: data?.entitlements ?? [], progress: data?.progress ?? [] };
}

export function SecurePlayerShell({
  lessonId,
  children,
}: {
  lessonId: string;
  children: (identity: { watermark: string; user: SessionUser }) => ReactNode;
}) {
  const pathname = usePathname();
  const { loading, user, entitlements, data } = useWatchAccess();
  const [redeemOpen, setRedeemOpen] = useState(false);
  const lesson = academyLessons.find((item) => item.id === lessonId);
  const catalog = data?.lessons?.find((item) => item.id === lessonId);
  const enabled = catalog?.enabled ?? true;
  const unlocked = catalog?.unlocked ?? (lesson ? canAccessLesson(lesson, entitlements, user?.role) : false);

  if (loading) {
    return (
      <main className="shell" dir="rtl">
        <p className="muted">جارٍ التحقق من الجلسة…</p>
      </main>
    );
  }

  if (!user || (user.role !== "student" && user.role !== "teacher")) {
    return (
      <main className="shell player-gate" dir="rtl">
        <p className="eyebrow">مشاهدة محمية</p>
        <h1>يلزم تسجيل الدخول كطالب</h1>
        <p className="muted">
          علامة الفيديو المائية تعرض اسمك ورقم هاتفك أثناء التشغيل. الدخول كطالب مطلوب قبل تشغيل الدرس.
        </p>
        <div className="row">
          <Link className="btn dark" href={`/login?next=${encodeURIComponent(pathname)}`}>
            تسجيل الدخول
          </Link>
          <Link className="btn" href="/signup">
            حساب جديد
          </Link>
        </div>
      </main>
    );
  }

  if (!enabled && user.role !== "teacher") {
    return (
      <main className="shell" dir="rtl">
        <h1>هذا الدرس غير متاح حالياً</h1>
        <p className="muted">عطّله الأستاذ مؤقتاً. عد لاحقاً أو اختر درساً آخر.</p>
        <Link className="btn dark" href="/lessons">
          فهرس الدروس
        </Link>
      </main>
    );
  }

  if (!unlocked) {
    return (
      <main className="shell player-gate" dir="rtl">
        <p className="eyebrow">محتوى مدفوع</p>
        <h1>هذه الوحدة مقفلة</h1>
        <p className="muted">
          الفصل الأول من كل صف مجاني للمعاينة. لفتح {lesson?.arabicTitle || lesson?.title || "هذه الوحدة"} أدخل كود
          البطاقة المكوّن من 12 خانة.
        </p>
        <div className="row">
          <button className="btn dark" type="button" onClick={() => setRedeemOpen(true)}>
            تفعيل كود
          </button>
          <Link className="btn" href="/subscribe">
            الاشتراك
          </Link>
        </div>
        <RedeemModal
          open={redeemOpen}
          onClose={() => setRedeemOpen(false)}
          onRedeemed={() => window.location.reload()}
        />
      </main>
    );
  }

  if (user.role === "student" && !user.phone) {
    return (
      <main className="shell player-gate" dir="rtl">
        <p className="eyebrow">العلامة المائية</p>
        <h1>أضف رقم هاتفك قبل المشاهدة</h1>
        <p className="muted">لا نشغّل الفيديو بدون اسم ورقم ظاهرين على الشاشة.</p>
        <Link className="btn dark" href="/profile">
          الملف الشخصي
        </Link>
      </main>
    );
  }

  const watermark = watermarkText(user.name, user.phone || "76532421");
  return (
    <>
      {children({ watermark, user })}
    </>
  );
}
