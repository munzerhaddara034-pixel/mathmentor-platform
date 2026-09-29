import { NextResponse } from "next/server";
import { authorizeAgentRequest } from "@/lib/agent/auth";
import { getVoiceTask, listVoiceTasks, patchVoiceTask, saveVoiceTask } from "@/lib/agent/store";
import type { WhatsAppVoiceTask } from "@/lib/agent/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeAgentRequest(request);
  if (!auth.ok) return auth.error;
  const url = new URL(request.url);
  const id = url.searchParams.get("id")?.trim();
  if (id) {
    const task = await getVoiceTask(id);
    if (!task) {
      return NextResponse.json({ ok: false, error: "Voice task not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, auth: auth.mode, task });
  }
  const limit = Math.min(80, Math.max(1, Number(url.searchParams.get("limit") || 30)));
  const tasks = await listVoiceTasks(limit);
  return NextResponse.json({ ok: true, auth: auth.mode, tasks });
}

/**
 * PATCH /api/agent/voice-tasks
 * Body: { id, ...partial WhatsAppVoiceTask fields } — upserts when missing.
 */
export async function PATCH(request: Request) {
  const auth = await authorizeAgentRequest(request);
  if (!auth.ok) return auth.error;

  try {
    const body = (await request.json()) as Partial<WhatsAppVoiceTask> & { id?: string };
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) {
      return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
    }
    const { id: _id, ...patch } = body;
    const updated = await patchVoiceTask(id, patch);
    return NextResponse.json({ ok: true, auth: auth.mode, task: updated });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "patch failed" },
      { status: 500 },
    );
  }
}

/** POST upsert full task or { action: "complete", id, ... } */
export async function POST(request: Request) {
  const auth = await authorizeAgentRequest(request);
  if (!auth.ok) return auth.error;

  try {
    const body = (await request.json()) as Partial<WhatsAppVoiceTask> & {
      id?: string;
      action?: string;
    };
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) {
      return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
    }

    if (body.action === "complete" || body.status === "completed") {
      const updated = await patchVoiceTask(id, {
        ...body,
        status: "completed",
        updatedAt: new Date().toISOString(),
      });
      return NextResponse.json({ ok: true, auth: auth.mode, task: updated });
    }

    const existing = await getVoiceTask(id);
    if (existing) {
      const updated = await patchVoiceTask(id, body);
      return NextResponse.json({ ok: true, auth: auth.mode, task: updated });
    }

    const now = new Date().toISOString();
    const task: WhatsAppVoiceTask = {
      id,
      audioLog: body.audioLog ?? { receivedAt: now },
      whisperTranscript: body.whisperTranscript ?? "",
      transcriptSource: body.transcriptSource ?? "typed",
      transcriptWarning: body.transcriptWarning,
      intent: body.intent ?? {
        kind: "general_task",
        confidence: 0.5,
        parameters: {},
        source: "heuristic",
      },
      status: body.status ?? "completed",
      automatedReplyText: body.automatedReplyText ?? "",
      relatedIds: body.relatedIds ?? [],
      outboundWhatsApp: body.outboundWhatsApp,
      createdAt: body.createdAt ?? now,
      updatedAt: now,
    };
    const saved = await saveVoiceTask(task);
    return NextResponse.json({ ok: true, auth: auth.mode, task: saved, created: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "post failed" },
      { status: 500 },
    );
  }
}
