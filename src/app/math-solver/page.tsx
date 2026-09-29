import { MathSolverForm } from "@/components/solver/MathSolverForm";
import { PedagogicalTutorPanel } from "@/components/curriculum/PedagogicalTutorPanel";
import { SolverCurriculumBanner } from "@/components/curriculum/SolverCurriculumBanner";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function MathSolverPage() {
  return (
    <main className="shell mm-mobile-stack">
      <p className="eyebrow">AI Math Solver · Prof. Munzer Haddara</p>
      <h1>حلّال الرياضيات</h1>
      <SolverCurriculumBanner />
      <p className="muted">
        Text, LaTeX, or a photo of the notebook. The engine writes a curriculum-aware solution (Lebanese official
        sequence by default: D_f → limits/asymptotes → f&apos; / variation table → C_f), a HeyGen avatar script, and a
        time-synced math canvas. Instructor: <strong>Prof. Munzer Haddara / الأستاذ منذر حداره</strong>.
      </p>
      <div className="card solver-card">
        <MathSolverForm />
      </div>
      <PedagogicalTutorPanel />
      <p className="muted" style={{ marginTop: 16 }}>
        After solving, open the split player or generate a talking-avatar clip.{" "}
        <Link href="/lessons/interactive">Classroom board</Link>
        {" · "}
        <Link href="/studio/voice-solver">Voice-to-Math (teachers)</Link>
        {" · "}
        <Link href="/live">Book a live hour</Link>
      </p>
    </main>
  );
}
