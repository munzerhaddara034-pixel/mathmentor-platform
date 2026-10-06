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
import type { Locale } from "@/lib/i18n/config";
import { fmt } from "@/lib/i18n/format";
import { examsMessages, type ExamsMessages } from "@/lib/i18n/ns/exams";
import { rich } from "@/lib/i18n/rich";
import { getI18n } from "@/lib/i18n/server";
import { formatUsdBand, getRegionalPlan } from "@/lib/pricing/plans";

const SAT_DIGITAL_PLAN = getRegionalPlan("admissions_us", "digitalCore");
const satDigitalPrice = formatUsdBand(SAT_DIGITAL_PLAN.usdMonthlyMin, SAT_DIGITAL_PLAN.usdMonthlyMax);

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

function PlannedCards({
  cards,
  phaseNote,
  locale,
  t,
}: {
  cards: PlannedExamCard[];
  phaseNote: string;
  locale: Locale;
  t: ExamsMessages["hub"];
}) {
  if (!cards.length) return null;
  const isAr = locale === "ar";
  return (
    <section style={{ marginBottom: 28 }}>
      <h2>{t.planned}</h2>
      <p className="muted">{phaseNote}</p>
      <div className="grid two">
        {cards.map((card) => (
          <article className="card mm-planned-exam-card" key={card.id}>
            <span className={`badge ${card.phase === "planned" ? "pending" : "approved"}`}>
              {card.phase === "planned" ? t.plannedBadge : t.sampleBadge}
            </span>
            <h3>{isAr ? card.titleAr || card.titleEn : card.titleEn}</h3>
            <p className="muted">{isAr ? card.blurbAr || card.blurbEn : card.blurbEn}</p>
            {card.sampleLatex ? (
              <p className="muted">
                <code dir="ltr">{card.sampleLatex}</code>
              </p>
            ) : null}
            <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
              <Link className="btn" href="/math-solver">
                {t.openTutor}
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

  const { locale } = await getI18n();
  const t = examsMessages[locale].hub;
  const isAr = locale === "ar";
  const trackLabel = (track: ExamTrack) => (isAr ? TRACK_LABELS[track].ar : TRACK_LABELS[track].en);
  const paperTitle = (paper: { title: string; titleAr?: string }) =>
    isAr ? paper.titleAr || paper.title : paper.title;
  const curriculumLabel = isAr ? curriculum.labelAr : curriculum.labelEn;

  const chipTracks: ExamTrack[] =
    curriculumId === "sat"
      ? ["sat"]
      : curriculumId === "lebanese"
        ? LEBANESE_CHIP_ORDER
        : [];

  return (
    <main className="shell mm-mobile-stack">
      <p className="eyebrow">{t.eyebrow}</p>
      <h1>{t.title}</h1>
      <p className="muted">
        {rich(t.lead, {
          curriculum: <strong>{curriculumLabel}</strong>,
          bareme: <strong>{t.bareme}</strong>,
          switcher: <strong>{t.switcher}</strong>,
        })}
      </p>

      <p className="muted mm-exam-paywall-hook" role="note">
        {isAr ? EXAM_PAYWALL_HOOK.hintAr : EXAM_PAYWALL_HOOK.hintEn}{" "}
        <Link href={EXAM_PAYWALL_HOOK.subscribeHref}>{t.subscribe}</Link>
        {" · "}
        <Link href={EXAM_PAYWALL_HOOK.redeemHref}>{t.redeem}</Link>
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
            {curriculumId === "sat" ? "SAT" : t.allLebanese}
          </Link>
          {chipTracks.map((track) => (
            <Link
              key={track}
              className={`btn${trackFilter === track ? " dark" : ""}`}
              href={`/exams?track=${track}`}
            >
              {trackLabel(track)}
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
          <h2>{t.platformSat}</h2>
          <p className="muted">{rich(t.platformSatLead, { plan: <code dir="ltr">sat</code>, price: <span dir="ltr">{satDigitalPrice}</span> })}</p>
          <div className="grid two">
            {satPapers.map((paper) => (
              <article className="card" key={paper.id}>
                <span className="badge">{t.platform}</span>
                <h3>{paperTitle(paper)}</h3>
                <p className="muted">
                  {fmt(t.paperMeta, { min: paper.durationMinutes, pts: paper.totalMarks, session: paper.sessionLabel })}
                </p>
                <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                  <Link className="btn dark" href={`/exams/simulator?paper=${paper.id}`}>
                    {t.startSat}
                  </Link>
                  <Link className="btn" href={`/exams/simulator?paper=${paper.id}#gensim`}>
                    {t.generateSimilar}
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
              ? trackLabel(trackFilter)
              : t.lebanese}
          </h2>
          <p className="muted">{t.lebaneseLead}</p>
          <div className="grid two">
            {otherPapers.map((paper) => (
              <article className="card" key={paper.id}>
                <span className="badge">{trackLabel(paper.track)}</span>
                <h3>{paperTitle(paper)}</h3>
                <p className="muted">
                  {fmt(t.paperMetaBareme, {
                    min: paper.durationMinutes,
                    pts: paper.totalMarks,
                    session: paper.sessionLabel,
                  })}
                </p>
                <Link className="btn dark" href={`/exams/simulator?paper=${paper.id}`}>
                  {t.start}
                </Link>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <PlannedCards
        cards={hub.planned}
        phaseNote={fmt(t.phaseNote, { curriculum: curriculumLabel, phase: curriculum.contentPhase })}
        locale={locale}
        t={t}
      />

      {hub.papers.length === 0 && hub.planned.length === 0 ? (
        <p className="muted">{t.none}</p>
      ) : null}
    </main>
  );
}
