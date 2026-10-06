import Link from "next/link";
import { PedagogicalTutorPanel } from "@/components/curriculum/PedagogicalTutorPanel";
import { SolverCurriculumBanner } from "@/components/curriculum/SolverCurriculumBanner";
import { SolverChat, type SolverSample } from "@/components/solver/SolverChat";
import { SolverHeader } from "@/components/solver/SolverHeader";
import { MathServer } from "@/components/ui/MathServer";
import { AiTutorBadge } from "@/components/v2/AiTutorBadge";
import { TutorOrb } from "@/components/v2/TutorOrb";
import { getSession } from "@/lib/auth/server";
import { rich } from "@/lib/i18n/rich";
import { getI18n } from "@/lib/i18n/server";
import { SAMPLE_QUESTIONS } from "@/lib/solver/demoSolver";
import "@/styles/solver.css";

export const dynamic = "force-dynamic";

/** Solver — chat with Dr. Mohamed · Munzer's assistant, the AI tutor (redesign-v2 A). Samples are server-rendered KaTeX. */
export default async function MathSolverPage({ searchParams }: { searchParams: Promise<{ q?: string; photo?: string }> }) {
  const [user, { m }, params] = await Promise.all([getSession(), getI18n(), searchParams]);
  const staff = user?.role === "teacher";
  const s = m.solver;
  const samples: SolverSample[] = SAMPLE_QUESTIONS.map((sample) => ({ ...sample, math: <MathServer tex={sample.tex} /> }));
  const initialQuestion = typeof params.q === "string" ? params.q.slice(0, 500) : "";
  return (
    <main className="shell mm-solver v2-solver">
      <SolverHeader m={m} />
      <SolverCurriculumBanner />
      <section className="v2-solver-intro glass-lite" aria-label={m.persona.label}>
        <p className="v2-ai-head">
          <TutorOrb mini /> {m.persona.label} <AiTutorBadge label={m.persona.ai} />
        </p>
        <div className="v2-bub ai">
          <p>{s.greeting}</p>
          {user ? null : <p className="v2-muted v2-small">{s.guestNote}</p>}
          <p className="v2-muted v2-small">{s.retakeNote}</p>
          <p className="v2-muted v2-small">{s.aiNote}</p>
        </div>
      </section>
      <SolverChat samples={samples} initialQuestion={initialQuestion} focusPhoto={params.photo === "1"} />
      <PedagogicalTutorPanel />
      <p className="v2-muted mm-solver-more">
        {rich(s.more, {
          board: <Link href="/lessons/interactive">{s.moreBoard}</Link>,
          live: <Link href="/live">{s.moreLive}</Link>,
        })}
      </p>
      {staff ? (
        <p className="v2-muted mm-solver-more" dir="ltr" lang="en">
          {s.staffLinks}: <Link href="/studio/voice-solver">Voice-to-Math</Link> · <Link href="/admin/video-generator">HeyGen avatar clips</Link>
        </p>
      ) : null}
    </main>
  );
}
