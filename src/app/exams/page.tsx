import { TRACK_LABELS, publicPapers } from "@/lib/exams";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function ExamsHubPage() {
  const papers = publicPapers();
  return (
    <main className="shell">
      <p className="eyebrow">Lebanese official simulation</p>
      <h1>محاكاة الامتحان الرسمي</h1>
      <p className="muted">
        Brevet and Terminale GS / LS / SE — Part I / Part II, live timer, formula drawer, AI barème, downloadable PDF.
        Instructor: Prof. Munzer Haddara / الأستاذ منذر حداره.
      </p>
      <div className="grid two">
        {papers.map((paper) => (
          <article className="card" key={paper.id}>
            <span className="badge">{TRACK_LABELS[paper.track].en}</span>
            <h2>{paper.title}</h2>
            <p dir="rtl">{paper.titleAr}</p>
            <p className="muted">
              {paper.durationMinutes} min · {paper.totalMarks} pts · {paper.sessionLabel}
            </p>
            <Link className="btn dark" href={`/exams/simulator?paper=${paper.id}`}>
              Start simulation
            </Link>
          </article>
        ))}
      </div>
    </main>
  );
}
