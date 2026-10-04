/**
 * Mock exam PDF for WhatsApp: reuses the exam "generate similar" engine (LLM when
 * configured, deterministic demo variants otherwise) and the branded Unicode PDF writer
 * (Latin-only builder as a fallback).
 */
import { buildSimplePdf } from "@/lib/exams/pdf";
import { generateSimilarQuestions } from "@/lib/exams/generateSimilar";
import { papersForTrack } from "@/lib/exams/papers";
import type { ExamTrack } from "@/lib/exams/types";
import { asciiForPdf, latexToReadable } from "@/lib/math/latexToReadable";
import { brandedPdfFilename, buildBrandedPdf, MATHMENTOR_BRAND, type PdfBlock } from "@/lib/pdf/brandedPdf";
import { MEDIA_SIGNATURE_AR } from "@/lib/whatsapp/media/errorsAr";

const TRACKS: readonly ExamTrack[] = ["brevet", "terminale-gs", "terminale-ls", "terminale-se", "sat"];

export function asExamTrack(value: string | undefined): ExamTrack {
  return TRACKS.find((t) => t === value) ?? "terminale-ls";
}

export type MockExamPdf = {
  bytes: Buffer;
  filename: string;
  captionAr: string;
  paperId: string;
  setId: string;
  questionCount: number;
  source: "demo" | "llm";
};

type GeneratedSet = Awaited<ReturnType<typeof generateSimilarQuestions>>["set"];

/** Prose with inline $…$ LaTeX → readable Unicode (the branded PDF fonts cover maths symbols). */
function readableProse(text: string | undefined): string {
  let out = (text || "").replace(/\$([^$]{1,400})\$/g, (_m, inner: string) => latexToReadable(inner));
  if (/\\[A-Za-z]|\^\{|_\{/.test(out)) out = latexToReadable(out);
  return out.trim();
}

/** Branded Unicode PDF blocks for a generated mock exam (questions, then the answer key). */
export function mockExamBlocks(track: ExamTrack, paperTitle: string, set: GeneratedSet): PdfBlock[] {
  const blocks: PdfBlock[] = [
    {
      kind: "subtitle",
      text: `${track} · ${paperTitle} · ${set.questions.length} questions · ${set.source === "llm" ? "AI-generated" : "curriculum variants"}`,
    },
  ];
  set.questions.forEach((q, index) => {
    blocks.push({ kind: "heading", text: `Question ${index + 1}  (${q.marks} pt)` });
    blocks.push({ kind: "paragraph", text: readableProse(q.prompt) });
    if (q.latex) blocks.push({ kind: "math", text: latexToReadable(q.latex) });
    for (const choice of q.choices ?? []) {
      blocks.push({ kind: "paragraph", indent: 14, text: `${choice.id}) ${choice.latex ? latexToReadable(choice.latex) : readableProse(choice.text)}` });
    }
  });
  blocks.push({ kind: "rule" }, { kind: "heading", text: "ANSWER KEY — مفتاح الحل" });
  set.questions.forEach((q, index) => {
    blocks.push({ kind: "paragraph", bold: true, text: `${index + 1}. ${readableProse(q.correctAnswer)}` });
    if (q.solution) blocks.push({ kind: "paragraph", indent: 14, muted: true, text: readableProse(q.solution).slice(0, 600) });
  });
  blocks.push({ kind: "rule" }, { kind: "paragraph", muted: true, text: MEDIA_SIGNATURE_AR });
  return blocks;
}

/** Latin-only (Helvetica) fallback when the embedded fonts cannot be loaded. */
function latinLines(track: ExamTrack, paperTitle: string, set: GeneratedSet): string[] {
  const lines: string[] = [
    `${MATHMENTOR_BRAND.headerLatin} - Mock exam prepared by Mohamed`,
    `Track: ${track}   Based on: ${asciiForPdf(paperTitle)}`,
    `Questions: ${set.questions.length}   Source: ${set.source === "llm" ? "AI-generated" : "curriculum variants"}`,
    "",
  ];
  set.questions.forEach((q, index) => {
    lines.push(`Question ${index + 1}  (${q.marks} pt)`);
    lines.push(`    ${asciiForPdf(q.prompt)}`);
    if (q.latex) lines.push(`    ${latexToReadable(q.latex, { ascii: true })}`);
    for (const choice of q.choices ?? []) {
      lines.push(`      ${choice.id}) ${choice.latex ? latexToReadable(choice.latex, { ascii: true }) : asciiForPdf(choice.text)}`);
    }
    lines.push("");
  });
  lines.push("", "ANSWER KEY");
  set.questions.forEach((q, index) => {
    lines.push(`${index + 1}. ${asciiForPdf(q.correctAnswer)}`);
    if (q.solution) lines.push(`    ${asciiForPdf(q.solution).slice(0, 600)}`);
  });
  return lines;
}

export async function buildMockExamPdf(input: { track?: string; count?: number; userId?: string }): Promise<MockExamPdf> {
  const track = asExamTrack(input.track);
  const paper = papersForTrack(track)[0];
  if (!paper) throw new Error(`No exam paper for track ${track}`);
  const { set } = await generateSimilarQuestions({
    paperId: paper.id,
    count: input.count ?? 6,
    userId: input.userId || "whatsapp-agent",
  });

  let bytes: Buffer;
  try {
    bytes = buildBrandedPdf({ title: `Mock exam — امتحان تجريبي (${track})`, blocks: mockExamBlocks(track, paper.title, set) });
  } catch (error) {
    console.error(
      `[whatsapp-agent] branded mock-exam PDF failed, using the Latin fallback: ${error instanceof Error ? error.message.slice(0, 200) : "error"}`,
    );
    bytes = buildSimplePdf(`${MATHMENTOR_BRAND.headerLatin} - Mock exam - ${track}`, latinLines(track, paper.title, set));
  }

  return {
    bytes,
    filename: brandedPdfFilename(`mock-exam-${track}`),
    captionAr: `📝 امتحان تجريبي (${paper.titleAr}) — ${set.questions.length} أسئلة مع مفتاح الحل. — محمد · ${MATHMENTOR_BRAND.headerAr}`,
    paperId: paper.id,
    setId: set.id,
    questionCount: set.questions.length,
    source: set.source,
  };
}
