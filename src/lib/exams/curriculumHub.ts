/**
 * Map global curriculum → exam hub cards (live papers vs sample/planned stubs).
 * Do not invent copyrighted full papers for GCC / IB / Cambridge / AP.
 */

import { getCurriculum } from "@/lib/curriculum/catalogs";
import type {
  CurriculumDefinition,
  CurriculumId,
  CurriculumSampleTopic,
} from "@/lib/curriculum/types";
import type { ExamTrack, OfficialPaper } from "./types";
import { OFFICIAL_PAPERS, TRACK_LABELS } from "./papers";

export const LEBANESE_EXAM_TRACKS: ExamTrack[] = [
  "brevet",
  "terminale-gs",
  "terminale-ls",
  "terminale-se",
];

export type PlannedExamCard = {
  id: string;
  titleEn: string;
  titleAr: string;
  phase: "sample" | "planned";
  blurbEn: string;
  blurbAr: string;
  /** Optional tutor deep-link prompt. */
  sampleLatex?: string;
  trackLabelEn: string;
  trackLabelAr: string;
};

export type ExamHubSlice = {
  curriculumId: CurriculumId;
  curriculum: CurriculumDefinition;
  /** Live simulator papers for this curriculum. */
  papers: OfficialPaper[];
  /** Sample / planned placeholders (never copyrighted full papers). */
  planned: PlannedExamCard[];
  /** Track chips to show under Lebanese / SAT. */
  trackChips: ExamTrack[];
  showSatOfficial: boolean;
};

function sampleToCard(
  curriculum: CurriculumDefinition,
  sample: CurriculumSampleTopic,
  index: number,
): PlannedExamCard {
  return {
    id: `planned-${curriculum.id}-${sample.id}`,
    titleEn: sample.titleEn,
    titleAr: sample.titleAr,
    phase: curriculum.contentPhase === "planned" ? "planned" : "sample",
    blurbEn: sample.objectiveEn,
    blurbAr: sample.objectiveAr,
    sampleLatex: sample.sampleLatex,
    trackLabelEn: curriculum.labelEn,
    trackLabelAr: curriculum.labelAr,
  };
}

function archiveFallbackCards(curriculum: CurriculumDefinition): PlannedExamCard[] {
  if (curriculum.samples.length > 0) {
    return curriculum.samples.map((sample, index) => sampleToCard(curriculum, sample, index));
  }
  return curriculum.examArchives.map((archive) => ({
    id: `planned-${curriculum.id}-${archive.id}`,
    titleEn: archive.labelEn,
    titleAr: archive.labelAr,
    phase: curriculum.contentPhase === "planned" ? "planned" : "sample",
    blurbEn: `${curriculum.labelEn} full papers ship in a later phase. Original practice only — no copyrighted past papers.`,
    blurbAr: `أوراق ${curriculum.labelAr} الكاملة في مرحلة لاحقة. تدريب أصلي فقط — دون نسخ أوراق محمية.`,
    trackLabelEn: curriculum.labelEn,
    trackLabelAr: curriculum.labelAr,
  }));
}

/** Lebanese primary hub: all Brevet + Terminale demo papers (not a single track). */
export function lebanesePapers(): OfficialPaper[] {
  return OFFICIAL_PAPERS.filter((paper) => LEBANESE_EXAM_TRACKS.includes(paper.track));
}

export function satPapers(): OfficialPaper[] {
  return OFFICIAL_PAPERS.filter((paper) => paper.track === "sat");
}

export function papersMatchingTrack(track: ExamTrack | undefined): OfficialPaper[] {
  if (!track) return OFFICIAL_PAPERS;
  return OFFICIAL_PAPERS.filter((paper) => paper.track === track);
}

/**
 * Build the hub slice for a curriculum id.
 * Optional `track` narrows Lebanese / SAT chips without inventing other tracks.
 */
export function examHubFor(
  curriculumId: CurriculumId,
  track?: ExamTrack,
): ExamHubSlice {
  const curriculum = getCurriculum(curriculumId);

  if (curriculumId === "sat") {
    const papers = track && track !== "sat" ? [] : satPapers();
    return {
      curriculumId,
      curriculum,
      papers: track === undefined || track === "sat" ? satPapers() : papers,
      planned: [],
      trackChips: ["sat"],
      showSatOfficial: true,
    };
  }

  if (curriculumId === "lebanese") {
    const base = lebanesePapers();
    const papers =
      track && LEBANESE_EXAM_TRACKS.includes(track)
        ? base.filter((paper) => paper.track === track)
        : base;
    return {
      curriculumId,
      curriculum,
      papers,
      planned: [],
      trackChips: LEBANESE_EXAM_TRACKS,
      showSatOfficial: false,
    };
  }

  // GCC / IB / Cambridge / AP — sample or planned cards only
  return {
    curriculumId,
    curriculum,
    papers: [],
    planned: archiveFallbackCards(curriculum),
    trackChips: [],
    showSatOfficial: false,
  };
}

/** Query helper for ExamCurriculumHooks — Lebanese clears track; SAT sets sat; others use curriculum=. */
export function examsUrlForCurriculum(curriculumId: CurriculumId): string {
  if (curriculumId === "lebanese") return "/exams";
  if (curriculumId === "sat") return "/exams?track=sat";
  return `/exams?curriculum=${encodeURIComponent(curriculumId)}`;
}

export function trackLabel(track: ExamTrack): { en: string; ar: string } {
  return TRACK_LABELS[track];
}
