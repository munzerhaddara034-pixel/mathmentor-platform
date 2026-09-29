import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAgentRequest } from "@/lib/agent/auth";
import {
  buildPersuasionPack,
  handleObjection,
  parsePersuasionRegion,
  type ObjectionKey,
} from "@/lib/agent/schoolPersuasionEngine";
import { createStagedApproval } from "@/lib/agent/approvalWorkflow";

export const runtime = "nodejs";

const bodySchema = z.object({
  region: z.string().optional(),
  objection: z
    .enum([
      "too_expensive",
      "teachers_resist_ai",
      "data_privacy",
      "already_have_lms",
      "results_unproven",
    ])
    .optional(),
  stageOutreach: z.boolean().optional(),
});

export async function GET(request: Request) {
  const auth = await authorizeAgentRequest(request);
  if (!auth.ok) return auth.error;
  const url = new URL(request.url);
  const region = parsePersuasionRegion(url.searchParams.get("region"));
  return NextResponse.json({ ok: true, pack: buildPersuasionPack(region) });
}

export async function POST(request: Request) {
  const auth = await authorizeAgentRequest(request);
  if (!auth.ok) return auth.error;
  let json: unknown = {};
  try {
    json = await request.json();
  } catch {
    /* */
  }
  const parsed = bodySchema.safeParse(json ?? {});
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
  const region = parsePersuasionRegion(parsed.data.region);
  const pack = buildPersuasionPack(region);
  const objection = parsed.data.objection
    ? handleObjection(region, parsed.data.objection as ObjectionKey)
    : null;

  let staged = null;
  if (parsed.data.stageOutreach) {
    const result = await createStagedApproval({
      kind: "school_outreach",
      titleAr: `رسالة إقناع مدارس · ${pack.regionLabelAr}`,
      previewAr: pack.outreachLetterAr,
      previewEn: pack.outreachLetterEn,
      payload: { region, whatsappScriptAr: pack.whatsappScriptAr },
    });
    staged = result.item;
  }

  return NextResponse.json({
    ok: true,
    auth: auth.mode,
    pack,
    objection,
    staged,
    whishUnchanged: "96170772968",
  });
}
