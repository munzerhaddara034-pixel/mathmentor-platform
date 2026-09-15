import { NextResponse } from "next/server";
import { webhookSecretOk } from "@/lib/studio/heygenAuth";
import { mapHeyGenStatus } from "@/lib/studio/heygen";
import { getHeyGenJob, patchHeyGenJob } from "@/lib/studio/heygenJobs";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "heygen-webhook" });
}

type LooseRecord = Record<string, unknown>;

function asRecord(value: unknown): LooseRecord {
  return value && typeof value === "object" ? (value as LooseRecord) : {};
}

function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function parseHeyGenWebhook(body: unknown) {
  const root = asRecord(body);
  const data = asRecord(root.data ?? root.event_data ?? root.payload);
  const eventType = pickString(root.event_type, root.event, root.type) ?? "";
  const videoId = pickString(data.video_id, root.video_id, data.id);
  const callbackId = pickString(data.callback_id, root.callback_id);
  const videoUrl = pickString(data.video_url, data.url, root.video_url, root.url);
  const thumbnailUrl = pickString(data.thumbnail_url, data.gif_url);
  let status = mapHeyGenStatus(data.status ?? root.status);
  if (/fail|error/i.test(eventType)) status = "failed";
  if (/success|complete|done/i.test(eventType) || videoUrl) status = "completed";
  return { videoId, callbackId, videoUrl, thumbnailUrl, status, eventType };
}

export async function POST(request: Request) {
  let body: unknown = {};
  const contentType = request.headers.get("content-type") || "";
  try {
    if (contentType.includes("json")) {
      body = await request.json();
    } else {
      const text = await request.text();
      body = text ? JSON.parse(text) : {};
    }
  } catch {
    body = {};
  }

  if (!webhookSecretOk(request, body)) {
    return NextResponse.json({ error: "Invalid webhook secret." }, { status: 401 });
  }

  const parsed = parseHeyGenWebhook(body);
  const job =
    (parsed.callbackId ? await getHeyGenJob(parsed.callbackId) : undefined) ??
    (parsed.videoId ? await getHeyGenJob(parsed.videoId) : undefined);

  if (!job) {
    return NextResponse.json({ ok: true, ignored: true, reason: "No matching job." });
  }

  const completed = parsed.status === "completed" && Boolean(parsed.videoUrl || job.videoUrl);
  const updated = await patchHeyGenJob(job.id, {
    heygenVideoId: parsed.videoId ?? job.heygenVideoId,
    videoUrl: parsed.videoUrl ?? job.videoUrl,
    thumbnailUrl: parsed.thumbnailUrl ?? job.thumbnailUrl,
    status: completed ? "completed" : parsed.status === "failed" ? "failed" : job.status === "queued" ? "processing" : job.status,
    studentEnabled: completed ? true : job.studentEnabled,
    message: completed
      ? "HeyGen webhook: video completed. Lesson enabled for students."
      : parsed.status === "failed"
        ? "HeyGen webhook: generation failed."
        : job.message,
    error: parsed.status === "failed" ? parsed.eventType || "failed" : undefined,
  });

  return NextResponse.json({ ok: true, job: updated });
}
