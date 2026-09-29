import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAgentRequest } from "@/lib/agent/auth";
import {
  approveAndDeploy,
  listAwaitingApprovals,
  rejectApproval,
  appendRevisionNote,
} from "@/lib/agent/approvalWorkflow";
import { listApprovalItems } from "@/lib/agent/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeAgentRequest(request);
  if (!auth.ok) return auth.error;
  const url = new URL(request.url);
  const awaitingOnly = url.searchParams.get("awaiting") === "1";
  const items = awaitingOnly ? await listAwaitingApprovals(30) : await listApprovalItems(40);
  return NextResponse.json({ ok: true, auth: auth.mode, approvals: items });
}

const bodySchema = z.object({
  id: z.string().min(3),
  action: z.enum(["approve", "reject", "revise"]),
  note: z.string().optional(),
});

export async function POST(request: Request) {
  const auth = await authorizeAgentRequest(request);
  if (!auth.ok) return auth.error;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { id, action, note } = parsed.data;
  if (action === "approve") {
    const result = await approveAndDeploy(id, { actor: `hub:${auth.mode}`, note });
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, approval: result.item });
  }
  if (action === "reject") {
    const result = await rejectApproval(id, { actor: `hub:${auth.mode}`, note });
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, approval: result.item });
  }
  const revised = await appendRevisionNote(id, note || "hub revise");
  if (!revised) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, approval: revised });
}
