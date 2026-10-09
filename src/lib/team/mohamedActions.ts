/** Parses محمد's action block and runs secretary, WhatsApp, and explanation-video actions. */
import { saveAppointment, saveReminder } from "@/lib/agent/store";
import type { ActionReminderPriority } from "@/lib/agent/types";
import { runMathSolver } from "@/lib/solver/engine";
import type { MathSolution } from "@/lib/solver/types";
import { createAvatarTalkingVideo, hasHeyGenKey, heygenCallbackUrl, type HeyGenLanguage } from "@/lib/studio/heygen";
import { newQueuedJob, upsertHeyGenJob } from "@/lib/studio/heygenJobs";
import { createId } from "@/lib/ids";
import { teamMessages } from "@/lib/i18n/ns/team";
import { parseJsonObject } from "./gemini";
import { sendOwnerWhatsApp } from "./ownerWhatsApp";

const BLOCK_RE = /```mm-actions\s*([\s\S]*?)```/;

type NarrationSolution = Pick<MathSolution, "avatarScript" | "steps" | "finalAnswer">;
type VideoSolution = NarrationSolution & Partial<Pick<MathSolution, "topic" | "summary" | "finalAnswerLatex" | "timeline">>;

type ExplanationVideoRequest = {
  question?: string;
  solution?: VideoSolution;
  title?: string;
  language?: HeyGenLanguage;
};

export type ExplanationVideoResult = {
  ok: boolean;
  configured: boolean;
  jobId?: string;
  videoUrl?: string;
  detailAr: string;
};

function actionText(key: keyof typeof teamMessages.ar.actions, values: Record<string, string> = {}): string {
  let text = teamMessages.ar.actions[key];
  for (const [name, value] of Object.entries(values)) text = text.replace(`{${name}}`, value);
  return text;
}

function isoOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function str(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function fmtBeirut(iso: string): string {
  return new Date(iso).toLocaleString("ar-LB", {
    timeZone: "Asia/Beirut",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function fallbackQuestion(text: string): string {
  const match = text.match(/(?:سؤال|question)\s*[:：]\s*([\s\S]+)/i);
  return (match?.[1] ?? text).trim().slice(0, 2000);
}

function isNarrationSolution(value: unknown): value is VideoSolution {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<VideoSolution>;
  return Boolean(item.avatarScript && Array.isArray(item.steps) && typeof item.finalAnswer === "string");
}

/** Uses the solver's Arabic avatar script, with a readable step-by-step fallback. */
export function narrationFromSolution(solution: NarrationSolution): string {
  const script = solution.avatarScript?.ar?.trim();
  if (script) return script.slice(0, 4000);
  const steps = solution.steps
    .map((step, index) => {
      const title = step.titleAr?.trim() || step.title.trim() || `الخطوة ${index + 1}`;
      const explanation = step.explanationAr?.trim() || step.explanationEn.trim() || step.explanationFr.trim();
      const math = step.latex.trim() ? `\n\(${step.latex.trim()}\)` : "";
      return `${index + 1}. ${title}: ${explanation}${math}`.trim();
    })
    .filter(Boolean);
  const answer = solution.finalAnswer.trim();
  return [...steps, answer ? `الجواب النهائي: ${answer}` : ""].filter(Boolean).join("\n\n").slice(0, 4000);
}

/** Starts one real HeyGen job; no demo job is claimed when the provider is not configured. */
export async function startMohamedExplanationVideo(input: ExplanationVideoRequest): Promise<ExplanationVideoResult> {
  if (!hasHeyGenKey()) {
    return { ok: false, configured: false, detailAr: actionText("videoNotConfigured") };
  }
  const suppliedQuestion = str(input.question, 2000);
  const solution = input.solution ?? (suppliedQuestion ? await runMathSolver({ question: suppliedQuestion, language: "ar" }) : undefined);
  if (!solution) return { ok: false, configured: hasHeyGenKey(), detailAr: actionText("videoNoQuestion") };
  const script = narrationFromSolution(solution);
  if (!script) return { ok: false, configured: hasHeyGenKey(), detailAr: actionText("videoNoQuestion") };

  const lessonId = `team-explanation-${createId("lesson")}`;
  const title = str(input.title, 160) || `MathMentor · ${solution.topic || "explanation"}`;
  let job = await upsertHeyGenJob(
    newQueuedJob({
      lessonId,
      title,
      script,
      notes: solution.summary ?? "",
      mathExamples: solution.finalAnswerLatex ?? "",
      language: input.language ?? "ar",
      speed: 1,
      timelineJson: JSON.stringify(solution.timeline),
      demo: false,
    }),
  );
  try {
    const heygen = await createAvatarTalkingVideo({
      script,
      language: input.language ?? "ar",
      title,
      speed: 1,
      callbackId: job.id,
      callbackUrl: heygenCallbackUrl(),
    });
    job = await upsertHeyGenJob({
      ...job,
      status: heygen.status === "failed" ? "failed" : "processing",
      heygenVideoId: heygen.videoId,
      videoUrl: heygen.videoUrl,
      thumbnailUrl: heygen.thumbnailUrl,
      message: heygen.message,
      demo: false,
    });
    return {
      ok: true,
      configured: true,
      jobId: job.id,
      videoUrl: job.videoUrl,
      detailAr: actionText("videoStarted", { id: job.id }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "HeyGen generate failed.";
    await upsertHeyGenJob({ ...job, status: "failed", error: message, message, demo: false });
    return { ok: false, configured: true, jobId: job.id, detailAr: actionText("videoFailed", { id: job.id }) };
  }
}

function explainVideoRequests(data: Record<string, unknown>): Record<string, unknown>[] {
  const raw = data.explainVideo ?? data.video;
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return values.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object").slice(0, 1);
}

export async function applyMohamedActions(reply: string, requestText = ""): Promise<{ text: string; recorded: string[] }> {
  const match = reply.match(BLOCK_RE);
  if (!match) return { text: reply, recorded: [] };
  const text = reply.replace(BLOCK_RE, "").trim();
  const data = parseJsonObject(match[1]);
  const recorded: string[] = [];
  if (!data) return { text, recorded };
  const now = new Date().toISOString();
  const appointments = Array.isArray(data.appointments) ? data.appointments.slice(0, 5) : [];
  for (const raw of appointments) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const dateTime = isoOrNull(item.dateTime);
    const title = str(item.title);
    if (!dateTime || !title) continue;
    await saveAppointment({
      id: createId("appt"),
      title,
      dateTime,
      contactPerson: str(item.contactPerson) || undefined,
      notes: str(item.notes, 500) || undefined,
      status: "scheduled",
      createdAt: now,
      updatedAt: now,
      source: "hub",
    });
    recorded.push(`موعد: ${title} — ${fmtBeirut(dateTime)} (بتوقيت بيروت)`);
  }
  const reminders = Array.isArray(data.reminders) ? data.reminders.slice(0, 5) : [];
  for (const raw of reminders) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const dueDate = isoOrNull(item.dueDate);
    const task = str(item.task);
    if (!dueDate || !task) continue;
    const priority: ActionReminderPriority =
      item.priority === "low" || item.priority === "medium" || item.priority === "high" ? item.priority : "medium";
    await saveReminder({ id: createId("rem"), task, dueDate, priority, status: "open", createdAt: now, updatedAt: now, source: "hub" });
    recorded.push(`تذكير: ${task} — ${fmtBeirut(dueDate)} (بتوقيت بيروت)`);
  }
  // «محمد» يرسل إلى واتساب رقم المنصة (نص و/أو ملف) — بطلب صريح من الأستاذ منذر فقط.
  const whatsapp = Array.isArray(data.whatsapp) ? data.whatsapp.slice(0, 2) : [];
  for (const raw of whatsapp) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const body = str(item.text, 2000);
    const attachmentId = str(item.attachmentId, 80);
    const link = str(item.link, 500);
    if (!body && !attachmentId && !link) continue;
    const result = await sendOwnerWhatsApp({
      text: body,
      file:
        attachmentId || link
          ? {
              attachmentId: attachmentId || undefined,
              link: link || undefined,
              filename: str(item.filename, 120) || undefined,
              mimeType: str(item.mimeType, 120) || undefined,
            }
          : undefined,
    });
    recorded.push(`واتساب: ${result.detailAr}`);
  }
  for (const item of explainVideoRequests(data)) {
    const question = str(item.question, 2000) || fallbackQuestion(requestText);
    const solution = isNarrationSolution(item.solution) ? item.solution : undefined;
    try {
      const result = await startMohamedExplanationVideo({
        question,
        solution,
        title: str(item.title, 160) || undefined,
        language: item.language === "en" || item.language === "fr" || item.language === "ar" ? item.language : "ar",
      });
      recorded.push(result.detailAr);
    } catch {
      recorded.push(actionText("videoFailed", { id: "غير متاح" }));
    }
  }
  return { text, recorded };
}
