/**
 * Public (non-staff) projections of records that used to be returned whole by open endpoints.
 * Pure, type-only imports — unit-tested in tests/publicViews.test.mjs.
 */
import type { QuizQuestion } from "@/lib/types";
import type { HeyGenJobRecord } from "@/lib/studio/heygenJobs";

export type PublicQuizQuestion = Omit<QuizQuestion, "correctIndex" | "steps">;

/** Questions without the answer key or the worked solution. */
export function publicQuestion(question: QuizQuestion): PublicQuizQuestion {
  const { id, lessonId, difficulty, kind, prompt, latex, imageUrl, options } = question;
  const out: PublicQuizQuestion = { id, lessonId, difficulty, prompt, options: [...(options ?? [])] };
  if (kind !== undefined) out.kind = kind;
  if (latex !== undefined) out.latex = latex;
  if (imageUrl !== undefined) out.imageUrl = imageUrl;
  return out;
}

export type PublicHeyGenJob = Pick<
  HeyGenJobRecord,
  "id" | "lessonId" | "title" | "status" | "studentEnabled" | "demo" | "createdAt" | "updatedAt"
> & { videoUrl?: string; thumbnailUrl?: string };

/**
 * What a signed-in student's player needs: no script / notes / provider ids / error text.
 * Media URLs only once the job is published to students.
 */
export function publicHeyGenJob(job: HeyGenJobRecord): PublicHeyGenJob {
  const out: PublicHeyGenJob = {
    id: job.id,
    lessonId: job.lessonId,
    title: job.title,
    status: job.status,
    studentEnabled: job.studentEnabled,
    demo: job.demo,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
  if (job.studentEnabled) {
    if (job.videoUrl) out.videoUrl = job.videoUrl;
    if (job.thumbnailUrl) out.thumbnailUrl = job.thumbnailUrl;
  }
  return out;
}
