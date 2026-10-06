import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";
import { userHasAiAccess, type PublicUser } from "@/lib/auth/store";
import { clientIpFrom, createRateLimiter } from "@/lib/security/rateLimit";
import { readInlineUpload, readUploadFile } from "@/lib/security/uploads";
import { listMathQueries, persistUploadedImage, recordSolution, runMathSolver } from "@/lib/solver";
import { GUEST_MAX_QUESTION_CHARS, readGuestQuota, recordGuestSolve } from "@/lib/solver/guestTrial";
import type { EngineInput } from "@/lib/solver/engine";
import type { MathQueryRecord } from "@/lib/solver/types";
import type { CertificateTrack, LessonLanguage } from "@/lib/studio/timeline";

export const runtime = "nodejs";

/**
 * Two ways in: a member (staff or an active AI subscription) who gets a saved history, and a guest
 * who gets a few free solves per day with no account. The guest path exists so a visitor sees the
 * product before being asked to sign up — the single biggest conversion lever on the platform.
 */
const guestBurstLimiter = createRateLimiter({ windowMs: 10 * 60_000, max: 8 });
const GUEST_VIEWER: Pick<PublicUser, "id" | "name" | "email"> = { id: "guest", name: "Guest", email: "" };
const GUEST_LIMIT_REPLY = {
  en: "You've used today's free solves. Create a free account to keep solving, or subscribe for unlimited solutions.",
  ar: "استهلكت الحلول المجانية لليوم. أنشئ حساباً مجانياً لمتابعة الحلّ، أو اشترك لحلول غير محدودة.",
};

function asLanguage(value: FormDataEntryValue | string | null): LessonLanguage | undefined {
  const text = typeof value === "string" ? value : "";
  if (text === "fr" || text === "en" || text === "ar") return text;
  return undefined;
}

function asTrack(value: FormDataEntryValue | string | null): CertificateTrack | undefined {
  const text = typeof value === "string" ? value : "";
  const allowed: CertificateTrack[] = ["brevet", "ls", "se", "gs", "lh", "eb7", "eb8", "s1", "sat", "university"];
  return allowed.includes(text as CertificateTrack) ? (text as CertificateTrack) : undefined;
}

function asText(value: FormDataEntryValue | string | null | undefined, max = 40): string | undefined {
  const text = typeof value === "string" ? value.trim().slice(0, max) : "";
  return text || undefined;
}

type SolverMode = "member" | "guest";
type ParsedInput = { ok: true; input: EngineInput } | { ok: false; response: NextResponse };

function badInput(message: string, messageAr: string, status = 400): ParsedInput {
  return { ok: false, response: NextResponse.json({ error: message, errorAr: messageAr }, { status }) };
}

/** multipart body → validated fields. A guest photo stays in memory: nothing is written to public/. */
async function readFormInput(request: Request, mode: SolverMode): Promise<ParsedInput> {
  const form = await request.formData();
  const base: EngineInput = {
    question: String(form.get("question") ?? "").trim(),
    latex: String(form.get("latex") ?? "").trim(),
    language: asLanguage(form.get("language")),
    track: asTrack(form.get("track")),
    curriculum: asText(form.get("curriculum")),
    platformCurriculum: asText(form.get("platformCurriculum")),
  };
  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0) return { ok: true, input: base };
  if (mode === "guest") {
    const read = await readUploadFile(file, ["image"]);
    if (!read.ok) return badInput(read.error, read.errorAr, read.status);
    return {
      ok: true,
      input: { ...base, imageBase64: read.bytes.toString("base64"), mimeType: read.mime, imageName: read.originalName },
    };
  }
  const saved = await persistUploadedImage(file);
  if (!saved.ok) return badInput(saved.error, saved.errorAr, saved.status);
  return {
    ok: true,
    input: { ...base, imageUrl: saved.imageUrl, imageName: saved.imageName, imageBase64: saved.imageBase64, mimeType: saved.mimeType },
  };
}

/** JSON body → validated fields (the owner's `{ problem }` contract is still accepted). */
async function readJsonInput(request: Request, mode: SolverMode): Promise<ParsedInput> {
  let json: {
    question?: string;
    problem?: string;
    latex?: string;
    language?: string;
    track?: string;
    imageBase64?: string;
    mimeType?: string;
    imageName?: string;
    curriculum?: string;
    platformCurriculum?: string;
  };
  try {
    json = (await request.json()) as typeof json;
  } catch {
    return badInput("Invalid JSON or form body.", "طلب غير صالح.");
  }
  const input: EngineInput = {
    question: (json.question ?? json.problem)?.trim() ?? "",
    latex: json.latex?.trim() ?? "",
    language: asLanguage(json.language ?? null),
    track: asTrack(json.track ?? null),
    curriculum: asText(json.curriculum),
    platformCurriculum: asText(json.platformCurriculum),
  };
  if (!json.imageBase64) return { ok: true, input };
  const inline = readInlineUpload(json.imageBase64, ["image"]);
  if (!inline.ok) return badInput(inline.error, inline.errorAr, inline.status);
  return {
    ok: true,
    input: {
      ...input,
      imageBase64: inline.bytes.toString("base64"),
      mimeType: inline.mime,
      imageName: json.imageName || inline.originalName,
    },
  };
}

async function readSolverInput(request: Request, mode: SolverMode): Promise<ParsedInput> {
  const contentType = request.headers.get("content-type") ?? "";
  const parsed = contentType.includes("multipart/form-data")
    ? await readFormInput(request, mode)
    : await readJsonInput(request, mode);
  if (!parsed.ok) return parsed;
  const { question, latex, imageBase64 } = parsed.input;
  if (!question && !latex && !imageBase64) {
    return badInput("Write a question, LaTeX, or attach an image.", "اكتب سؤالاً أو لاحقة أو أرفق صورة.");
  }
  if (mode === "guest" && `${question ?? ""}${latex ?? ""}`.length > GUEST_MAX_QUESTION_CHARS) {
    return badInput(
      `The free trial takes shorter questions (up to ${GUEST_MAX_QUESTION_CHARS} characters). Create an account to send longer ones.`,
      `التجربة المجانية تقبل أسئلة أقصر (حتى ${GUEST_MAX_QUESTION_CHARS} حرفاً). أنشئ حساباً لإرسال أسئلة أطول.`,
    );
  }
  return parsed;
}

function solverPayload(record: MathQueryRecord, extra: Record<string, unknown> = {}) {
  return {
    ok: true,
    id: record.id,
    query: record,
    summary: record.summary,
    finalAnswer: record.finalAnswer,
    finalAnswerLatex: record.finalAnswerLatex,
    steps: record.steps,
    avatarScript: record.avatarScript,
    canvasTimeline: record.canvasTimeline,
    timeline: record.timeline,
    source: record.source,
    warning: record.warning,
    videoStatus: record.videoStatus,
    needsRetake: record.needsRetake,
    retakeMessageEn: record.retakeMessageEn,
    retakeMessageAr: record.retakeMessageAr,
    given: record.given,
    topicTag: record.topicTag,
    curriculum: record.curriculum,
    needsReview: record.needsReview,
    playerPath: `/lessons/interactive-explanation?id=${encodeURIComponent(record.id)}`,
    resultPath: `/math-solver/result/${encodeURIComponent(record.id)}`,
    ...extra,
  };
}

async function solveAsMember(request: Request, user: PublicUser) {
  const parsed = await readSolverInput(request, "member");
  if (!parsed.ok) return parsed.response;
  const solution = await runMathSolver(parsed.input);
  const record = await recordSolution(user, parsed.input, solution);
  if (!record.needsRetake) {
    const { recordActivity } = await import("@/lib/gamification/store");
    await recordActivity({
      userId: user.id,
      name: user.name,
      kind: "solver",
      topic: record.topicTag?.includes("prob") ? "probability" : "calculus",
    });
  }
  return NextResponse.json(solverPayload(record));
}

async function solveAsGuest(request: Request) {
  const ip = clientIpFrom(request.headers);
  const burst = guestBurstLimiter.hit(`ip:${ip}`);
  if (!burst.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Try again in a few minutes.", errorAr: "محاولات كثيرة. حاول بعد دقائق.", retryAfterSec: burst.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(burst.retryAfterSec) } },
    );
  }
  const quota = await readGuestQuota(ip);
  if (quota.remaining <= 0) {
    return NextResponse.json(
      {
        ok: false,
        guestLimitReached: true,
        needSignIn: true,
        signUpUrl: "/signup?next=%2Fmath-solver",
        subscribeUrl: "/subscribe",
        guestLimit: quota.limit,
        remaining: 0,
        error: GUEST_LIMIT_REPLY.en,
        errorAr: GUEST_LIMIT_REPLY.ar,
      },
      { status: 429 },
    );
  }
  const parsed = await readSolverInput(request, "guest");
  if (!parsed.ok) return parsed.response;
  const solution = await runMathSolver(parsed.input);
  // Guests keep the answer but no account history: the record is stored under the guest identity.
  const record = await recordSolution(GUEST_VIEWER, parsed.input, solution);
  const after = await recordGuestSolve(ip);
  return NextResponse.json(solverPayload(record, { guest: true, guestLimit: after.limit, remaining: after.remaining }));
}

export async function GET() {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  const staff = isStaffRole(guard.live.user.role);
  const queries = await listMathQueries(staff ? { limit: 200 } : { userId: guard.live.user.id, limit: 50 });
  return NextResponse.json({ queries });
}

export async function POST(request: Request) {
  const session = await apiSession();
  const user = session.error ? null : session.live.user;
  if (user && (isStaffRole(user.role) || (await userHasAiAccess(user)))) return solveAsMember(request, user);
  return solveAsGuest(request);
}
