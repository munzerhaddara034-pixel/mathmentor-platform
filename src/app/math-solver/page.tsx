import { MathSolverForm } from "@/components/solver/MathSolverForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function MathSolverPage() {
  return (
    <main className="shell">
      <p className="eyebrow">AI Math Solver · Prof. Munzer Haddara</p>
      <h1>حلّال الرياضيات</h1>
      <p className="muted">
        Text, LaTeX, or a photo of the notebook. The engine writes a Lebanese official-curriculum solution (D_f first,
        then limits/asymptotes, then f' and the table of variations, then C_f), a HeyGen avatar script with a Key Idea
        before any calculation, and a time-synced math canvas. Instructor:{" "}
        <strong>Prof. Munzer Haddara / الأستاذ منذر حداره</strong>.
      </p>
      <div className="card solver-card">
        <MathSolverForm />
      </div>
      <p className="muted" style={{ marginTop: 16 }}>
        After solving, open the split player or generate a talking-avatar clip.{" "}
        <Link href="/lessons/interactive">Classroom board</Link>
        {" · "}
        <Link href="/live">Book a live hour</Link>
      </p>
    </main>
  );
}
