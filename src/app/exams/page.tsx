import { OfficialSatSection } from "@/components/exams/OfficialSatSection";
import { AiEmployeeOfficialCommand } from "@/components/exams/AiEmployeeOfficialCommand";
import { ExamCurriculumHooks } from "@/components/curriculum/ExamCurriculumHooks";
import { TRACK_LABELS } from "@/lib/exams";
import type { ExamTrack } from "@/lib/exams/types";
import {
  examHubFor,
  LEBANESE_EXAM_TRACKS,
  type PlannedExamCard,
} from "@/lib/exams/curriculumHub";
import { EXAM_PAYWALL_HOOK } from "@/lib/exams/accessHook";
import { getCurriculum, isCurriculumId } from "@/lib/curriculum/catalogs";
import { parseCurriculumId } from "@/lib/curriculum/persistence";
import type { CurriculumId } from "@/lib/curriculum/types";
import { getLiveSession } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/paths";
import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

const LEBANESE_CHIP_ORDER: ExamTrack[] = ["brevet", "terminale-gs", "terminale-ls", "terminale-se"];

function resolveCurriculumId(
  param: string | undefined,
  cookieRaw: string | undefined,
  trackFilter: ExamTrack | undefined,
): CurriculumId {
  if (param && isCurriculumId(param)) return param;
  if (trackFilter === "sat") return "sat";
  if (trackFilter && LEBANESE_EXAM_TRACKS.includes(trackFilter)) return "lebanese";
  return parseCurriculumId(cookieRaw);
}

function PlannedCards({ cards, phaseNote }: { cards: PlannedExamCard[]; phaseNote: string }) {
  if (!cards.length) return null;
  return (
    <section style={{ marginBottom: 28 }}>
      <h2>Sample / planned · عيّنات ومخطّط</h2>
      <p className="muted">{phaseNote}</p>
      <div className="grid two">
        {cards.map((card) => (
          <article className="card mm-planned-exam-card" key={card.id}>
            <span className={`badge ${card.phase === "planned" ? "pending" : "approved"}`}>
              {card.phase === "planned" ? "Planned · مخطّط" : "Sample · عيّنة"}
            </span>
            <h3>{card.titleEn}</h3>
            <p className="muted" dir="rtl" lang="ar">
              {card.titleAr}
            </p>
            <p className="muted">{card.blurbEn}</p>
            <p className="muted" dir="rtl" lang="ar">
              {card.blurbAr}
            </p>
            {card.sampleLatex ? (
              <p className="muted">
                <code>{card.sampleLatex}</code>
              </p>
            ) : null}
            <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
              <Link className="btn" href="/math-solver">
                Open pedagogical tutor
              </Link>
              <span className="badge">{card.trackLabelEn}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default async function ExamsHubPage({
  searchParams,
}: {
  searchParams: Promise<{ track?: string; curriculum?: string }>;
}) {
  const { track: trackParam, curriculum: curriculumParam } = await searchParams;
  const trackFilter =
    trackParam &&
    (["sat", "brevet", "terminale-gs", "terminale-ls", "terminale-se"] as ExamTrack[]).includes(
      trackParam as ExamTrack,
    )
      ? (trackParam as ExamTrack)
      : undefined;

  const jar = await cookies();
  const cookieCurriculum = jar.get("mm_curriculum")?.value;
  const curriculumId = resolveCurriculumId(curriculumParam, cookieCurriculum, trackFilter);
  const hub = examHubFor(curriculumId, trackFilter);
  const curriculum = getCurriculum(curriculumId);

  const satPapers = hub.papers.filter((paper) => paper.track === "sat");
  const otherPapers = hub.papers.filter((paper) => paper.track !== "sat");
  const live = await getLiveSession();
  const staff = live.ok && isStaffRole(live.user.role);

  const chipTracks: ExamTrack[] =
    curriculumId === "sat"
      ? ["sat"]
      : curriculumId === "lebanese"
        ? LEBANESE_CHIP_ORDER
        : [];

  return (
    <main className="shell mm-mobile-stack">
      <p className="eyebrow">Official &amp; curriculum exam simulations</p>
      <h1>Exam hub · محاكاة الامتحان</h1>
      <p className="muted">
        Curriculum: <strong>{curriculum.labelEn}</strong> / <span dir="rtl">{curriculum.labelAr}</span> · Instructor:
        Prof. Munzer Haddara / الأستاذ منذر أحمد حداره. Live timer, formula drawer,{" "}
        <strong>official Barème / سلّم</strong>, AI grading, PDF report, and Generate similar (على نسقه). Use the header{" "}
        <strong>Curriculum</strong> switcher (cookie <code>mm_curriculum</code>) to filter this hub.
      </p>

      <p className="muted mm-exam-paywall-hook" role="note">
        {EXAM_PAYWALL_HOOK.hintEn}{" "}
        <Link href={EXAM_PAYWALL_HOOK.subscribeHref}>Subscribe</Link>
        {" · "}
        <Link href={EXAM_PAYWALL_HOOK.redeemHref}>Redeem</Link>
        <span dir="rtl" lang="ar">
          {" "}
          — {EXAM_PAYWALL_HOOK.hintAr}
        </span>
      </p>

      <Suspense fallback={null}>
        <ExamCurriculumHooks />
      </Suspense>

      {chipTracks.length > 0 ? (
        <div className="row" style={{ flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          <Link
            className={`btn${!trackFilter ? " dark" : ""}`}
            href={curriculumId === "sat" ? "/exams?track=sat" : "/exams"}
          >
            {curriculumId === "sat" ? "SAT" : "All Lebanese"}
          </Link>
          {chipTracks.map((track) => (
            <Link
              key={track}
              className={`btn${trackFilter === track ? " dark" : ""}`}
              href={`/exams?track=${track}`}
            >
              {TRACK_LABELS[track].en}
            </Link>
          ))}
        </div>
      ) : null}

      {hub.showSatOfficial || trackFilter === "sat" ? (
        <>
          <OfficialSatSection />
          {staff ? <AiEmployeeOfficialCommand /> : null}
        </>
      ) : null}

      {satPapers.length > 0 ? (
        <section style={{ marginBottom: 28 }}>
          <h2>تدريب المنصة · Platform SAT practice</h2>
          <p className="muted">
            Original MathMentor demo papers (not College Board). Digital SAT–style Algebra, Advanced Math,
            Problem-Solving/Data, Geometry/Trig. MCQ + SPR. Plan <code>sat</code> ($45/mo) unlocks via AI access.
          </p>
          <div className="grid two">
            {satPapers.map((paper) => (
              <article className="card" key={paper.id}>
                <span className="badge">تدريب المنصة · Platform</span>
                <h3>{paper.title}</h3>
                <p className="muted" dir="rtl">
                  {paper.titleAr}
                </p>
                <p className="muted">
                  {paper.durationMinutes} min · {paper.totalMarks} pts · {paper.sessionLabel}
                </p>
                <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                  <Link className="btn dark" href={`/exams/simulator?paper=${paper.id}`}>
                    Start SAT simulation
                  </Link>
                  <Link className="btn" href={`/exams/simulator?paper=${paper.id}#gensim`}>
                    Generate similar
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {otherPapers.length > 0 ? (
        <section style={{ marginBottom: 28 }}>
          <h2>
            {trackFilter && trackFilter !== "sat"
              ? TRACK_LABELS[trackFilter].en
              : "Lebanese official · رسمي لبناني"}
          </h2>
          <p className="muted">
            Demo Brevet + Terminale papers with visible official Barème beside each question. Aligned to CRDP-style
            pedagogy (not a verbatim ministry scan).
          </p>
          <div className="grid two">
            {otherPapers.map((paper) => (
              <article className="card" key={paper.id}>
                <span className="badge">{TRACK_LABELS[paper.track].en}</span>
                <h3>{paper.title}</h3>
                <p dir="rtl">{paper.titleAr}</p>
                <p className="muted">
                  {paper.durationMinutes} min · {paper.totalMarks} pts · Barème on each sub · {paper.sessionLabel}
                </p>
                <Link className="btn dark" href={`/exams/simulator?paper=${paper.id}`}>
                  Start simulation · باريم ظاهر
                </Link>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <PlannedCards
        cards={hub.planned}
        phaseNote={`${curriculum.labelEn} content phase: ${curriculum.contentPhase}. Original sample prompts only — we do not host copyrighted past papers.`}
      />

      {hub.papers.length === 0 && hub.planned.length === 0 ? (
        <p className="muted">No papers for this filter.</p>
      ) : null}
    </main>
  );
}
