/**
 * Mock exam PDF for WhatsApp: reuses the exam "generate similar" engine (LLM when
 * configured, deterministic demo variants otherwise) and the simple exam PDF builder.
 */
import { buildSimplePdf } from "@/lib/exams/pdf";
import { generateSimilarQuestions } from "@/lib/exams/generateSimilar";
import { papersForTrack } from "@/lib/exams/papers";
import type { ExamTrack } from "@/lib/exams/types";
import { asciiForPdf, latexToReadable } from "@/lib/math/latexToReadable";

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

export async function buildMockExamPdf(input: { track?: string; count?: number; userId?: string }): Promise<MockExamPdf> {
  const track = asExamTrack(input.track);
  const paper = papersForTrack(track)[0];
  if (!paper) throw new Error(`No exam paper for track ${track}`);
  const { set } = await generateSimilarQuestions({
    paperId: paper.id,
    count: input.count ?? 6,
    userId: input.userId || "whatsapp-agent",
  });

  const lines: string[] = [
    "Prof. Munzer Haddara / MathMentor - Mock exam prepared by Mohamed",
    `Track: ${track}   Based on: ${asciiForPdf(paper.title)}`,
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

  const stamp = new Date().toISOString().slice(0, 10);
  return {
    bytes: buildSimplePdf(`MathMentor mock exam - ${track}`, lines),
    filename: `MathMentor-mock-exam-${track}-${stamp}.pdf`,
    captionAr: `📝 امتحان تجريبي (${paper.titleAr}) — ${set.questions.length} أسئلة مع مفتاح الحل. — محمد · الأستاذ منذر حداره`,
    paperId: paper.id,
    setId: set.id,
    questionCount: set.questions.length,
    source: set.source,
  };
}
