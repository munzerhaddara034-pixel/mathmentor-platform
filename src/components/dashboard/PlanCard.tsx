import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Ltr } from "@/components/ui/Ltr";
import type { OverviewPlan } from "@/lib/dashboard/overview";
import { formatBeirut } from "@/lib/format/dates";

const PLAN_TITLE: Record<string, string> = {
  AI_TIER: "الحلّال والدروس",
  LIVE_TIER: "الحصص المباشرة",
  BOTH: "الحلّال والدروس + الحصص المباشرة",
  EXPIRED: "انتهى اشتراكك",
};

export function PlanCard({ plan }: { plan: OverviewPlan | null }) {
  if (!plan || !plan.subscriptionType) {
    return (
      <section className="mm-plan" aria-label="اشتراكك">
        <span className="mm-plan-chip muted">لا يوجد اشتراك فعّال</span>
        <h2>افتح كل الدروس والحلّال</h2>
        <p className="mm-plan-note">اشترك أو استخدم رمز تفعيل للوصول الكامل.</p>
        <div className="mm-plan-actions">
          <Link href="/subscribe" className="btn">
            اعرض الاشتراكات
          </Link>
          <Link href="/redeem" className="ghost-btn">
            لديّ رمز تفعيل
          </Link>
        </div>
      </section>
    );
  }
  const aiOpen = plan.aiStatus === "active";
  const until = plan.aiExpiresAt ? formatBeirut(plan.aiExpiresAt, { day: "numeric", month: "long", year: "numeric" }) : "";
  return (
    <section className="mm-plan" aria-label="اشتراكك">
      <div className="mm-plan-head">
        <span className={`mm-plan-chip ${aiOpen ? "on" : "muted"}`}>{aiOpen ? "اشتراكك فعّال" : "الحلّال مغلق"}</span>
        {aiOpen && until ? <span className="mm-plan-until">حتى {until}</span> : null}
      </div>
      <h2>{PLAN_TITLE[plan.subscriptionType] ?? "اشتراكك"}</h2>
      <div className="mm-plan-stats">
        <div>
          <strong>
            <Ltr>{plan.liveCredits}</Ltr>
          </strong>
          <span>حصص مباشرة متبقية</span>
        </div>
        <div>
          <strong>{aiOpen ? "مفتوح" : "مغلق"}</strong>
          <span>الحلّال والدروس</span>
        </div>
      </div>
      {plan.liveCredits > 0 ? (
        <Link href="/live" className="btn mm-plan-cta">
          <Icon name="calendar" size={18} /> احجز حصتك التالية
        </Link>
      ) : (
        <Link href="/subscribe" className="btn mm-plan-cta">
          جدّد أو طوّر اشتراكك
        </Link>
      )}
    </section>
  );
}
