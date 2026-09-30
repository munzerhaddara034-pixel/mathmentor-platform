import Link from "next/link";
import { PedagogicalTutorPanel } from "@/components/curriculum/PedagogicalTutorPanel";
import { SolverCurriculumBanner } from "@/components/curriculum/SolverCurriculumBanner";
import { MathSolverForm } from "@/components/solver/MathSolverForm";
import { getSession } from "@/lib/auth/server";
import "@/styles/solver.css";

export const dynamic = "force-dynamic";

export default async function MathSolverPage() {
  const user = await getSession();
  const staff = user?.role === "teacher";
  return (
    <main className="shell mm-mobile-stack mm-solver">
      <header className="mm-solver-head">
        <p className="eyebrow">حلّال المسائل · الأستاذ منذر حداره</p>
        <h1>حلّ مسألة</h1>
        <p className="muted">
          صوّر المسألة من دفترك أو اكتبها، واحصل على حل مرتّب خطوة بخطوة وفق تسلسل الامتحان الرسمي اللبناني.
        </p>
        <SolverCurriculumBanner />
      </header>
      <div className="card solver-card">
        <MathSolverForm />
      </div>
      <PedagogicalTutorPanel />
      <p className="muted mm-solver-more">
        بعد الحل يمكنك متابعة الشرح على <Link href="/lessons/interactive">السبورة التفاعلية</Link> أو{" "}
        <Link href="/live">حجز حصة مباشرة</Link> مع الأستاذ منذر.
      </p>
      {staff ? (
        <p className="muted mm-solver-more" dir="ltr" lang="en">
          Staff: <Link href="/studio/voice-solver">Voice-to-Math</Link> ·{" "}
          <Link href="/admin/video-generator">HeyGen avatar clips</Link>
        </p>
      ) : null}
    </main>
  );
}
