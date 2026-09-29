/**
 * Staff API: send ONE file to ONE allowed WhatsApp number (instructor allowlist, or a
 * sender who messaged within 24h). Auth: staff session or AGENT_WEBHOOK_SECRET.
 *
 * JSON:      { to, type?, link? | mediaId? | fileBase64? | storedFileId?, mimeType?, filename?, caption? }
 *            { to, generate: "mock_exam", track? }
 * Multipart: to, file, caption?, type?
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { sendMockExam } from "@/lib/agent/media/dispatch";
import { requireStaffOrSecret } from "@/lib/agent/media/strictAuth";
import { whatsappConfigured } from "@/lib/whatsapp/adapter";
import { baseMime, categoryForMime, type MediaCategory } from "@/lib/whatsapp/media/policy";
import { sendWhatsAppMedia, type SendMediaInput } from "@/lib/whatsapp/media/send";
import { checkMediaRecipient } from "@/lib/whatsapp/media/recipientPolicy";
import { getMediaRecord, readMediaBytes } from "@/lib/whatsapp/media/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const categorySchema = z.enum(["image", "document", "audio", "video"]);

const jsonSchema = z.object({
  to: z.string().min(7).max(20),
  type: categorySchema.optional(),
  link: z.string().url().optional(),
  mediaId: z.string().min(1).max(200).optional(),
  fileBase64: z.string().min(4).optional(),
  storedFileId: z.string().min(3).max(120).optional(),
  mimeType: z.string().max(160).optional(),
  filename: z.string().max(240).optional(),
  caption: z.string().max(1024).optional(),
  generate: z.enum(["mock_exam"]).optional(),
  track: z.string().max(40).optional(),
});

type SendRequest = { to: string; media: SendMediaInput } | { to: string; generate: "mock_exam"; track?: string };

function bad(error: string, errorAr: string, status = 400) {
  return NextResponse.json({ ok: false, error, errorAr }, { status });
}

function resolveType(explicit: MediaCategory | undefined, mimeType: string | undefined): MediaCategory | null {
  if (explicit) return explicit;
  return categoryForMime(mimeType);
}

async function fromMultipart(request: Request): Promise<SendRequest | NextResponse> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    // Next.js middleware buffers request bodies (~10MB); bigger uploads arrive truncated.
    return bad(
      "multipart body could not be parsed (uploads above ~10MB: use link or storedFileId)",
      "الملف كبير كتير للرفع المباشر (الحد تقريباً 10 ميغابايت). استعمل رابط أو ملف محفوظ.",
      413,
    );
  }
  const to = form.get("to");
  const file = form.get("file");
  if (typeof to !== "string" || !to.trim()) return bad("to is required", "رقم المستلم مطلوب.");
  if (!file || typeof file === "string") return bad("file is required", "الملف مطلوب.");
  const mimeType = baseMime(file.type);
  const typeField = form.get("type");
  const parsedType = categorySchema.safeParse(typeof typeField === "string" ? typeField : undefined);
  const type = resolveType(parsedType.success ? parsedType.data : undefined, mimeType);
  if (!type) return bad(`unsupported mime ${mimeType || "(none)"}`, "نوع الملف غير مدعوم.");
  const caption = form.get("caption");
  return {
    to,
    media: {
      type,
      bytes: Buffer.from(await file.arrayBuffer()),
      mimeType,
      filename: file.name,
      caption: typeof caption === "string" ? caption.slice(0, 1024) : undefined,
    },
  };
}

async function fromJson(request: Request): Promise<SendRequest | NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return bad("invalid JSON", "صيغة الطلب غير صحيحة.");
  }
  const parsed = jsonSchema.safeParse(raw);
  if (!parsed.success) return bad(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), "حقول الطلب غير صحيحة.");
  const body = parsed.data;
  if (body.generate === "mock_exam") return { to: body.to, generate: "mock_exam", track: body.track };

  let bytes: Buffer | undefined;
  let mimeType = body.mimeType;
  let filename = body.filename;
  if (body.storedFileId) {
    const record = await getMediaRecord(body.storedFileId);
    if (!record) return bad("storedFileId not found", "الملف غير موجود.", 404);
    const stored = await readMediaBytes(record);
    if (!stored) return bad("stored file bytes missing (ephemeral disk?)", "محتوى الملف غير متوفر على الخادم.", 410);
    bytes = stored;
    mimeType = mimeType || record.mimeType;
    filename = filename || record.filename;
  } else if (body.fileBase64) {
    bytes = Buffer.from(body.fileBase64, "base64");
  }
  if (!bytes && !body.link && !body.mediaId) {
    return bad("one of link, mediaId, fileBase64, storedFileId is required", "يجب تحديد الملف (رابط، معرّف، أو محتوى).");
  }
  const type = resolveType(body.type, mimeType);
  if (!type) return bad("type is required (image|document|audio|video)", "نوع الوسائط مطلوب.");
  return {
    to: body.to,
    media: { type, bytes, link: body.link, mediaId: body.mediaId, mimeType, filename, caption: body.caption },
  };
}

export async function POST(request: Request) {
  // Demo bypass only when WhatsApp is not configured (sends are then log-only).
  const auth = await requireStaffOrSecret(request, { allowDemo: !whatsappConfigured() });
  if (!auth.ok) return auth.error;

  try {
    const contentType = request.headers.get("content-type") || "";
    const parsed = contentType.includes("multipart/form-data") ? await fromMultipart(request) : await fromJson(request);
    if (parsed instanceof NextResponse) return parsed;

    if ("generate" in parsed) {
      const allowed = await checkMediaRecipient(parsed.to);
      if (!allowed.ok) return NextResponse.json({ ok: false, error: allowed.error, errorAr: "المستلم غير مسموح." }, { status: 403 });
      const result = await sendMockExam({ to: allowed.to, track: parsed.track });
      return NextResponse.json({
        ok: result.ok,
        generated: "mock_exam",
        attachment: result.reply?.attachment ?? null,
        outboundWhatsApp: result.reply?.outbound ?? null,
        task: result.reply?.task ?? null,
        error: result.error ?? null,
      });
    }

    const result = await sendWhatsAppMedia(parsed.to, parsed.media);
    const status =
      result.status === "skipped" ? 403 : result.status !== "failed" ? 200 : result.failureStage === "validation" ? 400 : 502;
    return NextResponse.json({ ok: result.status === "sent" || result.status === "logged", result }, { status });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "send failed", errorAr: "تعذّر إرسال الملف." },
      { status: 500 },
    );
  }
}
